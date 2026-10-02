/**
 * How complete the catalogue is, per country and field, for the next 12 months.
 * Saves a snapshot, and with --compare=<file> prints before → after.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/coverage-snapshot.ts [--label=x] [--compare=tmp/coverage-x.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

const FIELDS = ["races", "pin", "discipline", "statedCats", "web", "registration", "regulations"] as const;
type Row = Record<(typeof FIELDS)[number], number>;

async function main() {
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { ACTIVE_EVENT_STATUSES } = await import("../src/lib/event-visibility");
  const s = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  const by: Record<string, Row> = {};
  const add = (c: string, k: (typeof FIELDS)[number]) => {
    by[c] ??= Object.fromEntries(FIELDS.map((f) => [f, 0])) as Row;
    by[c]![k] += 1;
  };
  for (let from = 0; ; from += 1000) {
    const { data } = await s
      .from("events")
      .select("disciplines, age_categories, age_confidence, website_url, registration_url, regulations_url, location:locations(country_code, lat)")
      .eq("visibility", "public").is("merged_into_id", null).in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", today).lte("start_date", until).order("id").range(from, from + 999);
    type E = { disciplines: string[] | null; age_categories: string[] | null; age_confidence: string | null; website_url: string | null; registration_url: string | null; regulations_url: string | null; location: { country_code: string | null; lat: number | null } | null };
    for (const e of (data ?? []) as unknown as E[]) {
      for (const c of ["ALL", e.location?.country_code ?? "?"]) {
        add(c, "races");
        if (e.location?.lat != null) add(c, "pin");
        if ((e.disciplines ?? []).length) add(c, "discipline");
        if ((e.age_categories ?? []).length && e.age_confidence === "explicit") add(c, "statedCats");
        if (e.website_url) add(c, "web");
        if (e.registration_url) add(c, "registration");
        if (e.regulations_url) add(c, "regulations");
      }
    }
    if (!data || data.length < 1000) break;
  }
  const label = process.argv.find((a) => a.startsWith("--label="))?.slice(8) ?? new Date().toISOString().slice(0, 16).replace(":", "");
  writeFileSync(`tmp/coverage-${label}.json`, JSON.stringify(by, null, 1));
  const cmp = process.argv.find((a) => a.startsWith("--compare="))?.slice(10);
  const before: Record<string, Row> | null = cmp ? JSON.parse(readFileSync(cmp, "utf8")) : null;
  const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "–");
  const countries = Object.keys(by).sort((a, b) => (a === "ALL" ? -1 : b === "ALL" ? 1 : by[b]!.races - by[a]!.races)).filter((c) => by[c]!.races >= 15 || c === "ALL");
  const table = countries.map((c) => {
    const now = by[c]!;
    const was = before?.[c];
    const cell = (k: (typeof FIELDS)[number]) =>
      k === "races"
        ? was ? `${was.races} → ${now.races}` : String(now.races)
        : was ? `${pct(was[k], was.races)} → ${pct(now[k], now.races)}` : pct(now[k], now.races);
    return { country: c, ...Object.fromEntries(FIELDS.map((k) => [k, cell(k)])) };
  });
  console.table(table);
  console.log(`saved tmp/coverage-${label}.json`);
}
main().catch((e) => { console.error(e); process.exit(1); });
