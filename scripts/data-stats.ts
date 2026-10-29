import { catalogueWindow } from "../src/lib/catalog/overview-quality";
/**
 * Legacy category diagnostics through the end of next year, by country.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/data-stats.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

async function main() {
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const supabase = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const until = catalogueWindow(today).until;
  const rows: { age_categories: string[] | null; age_confidence: string | null; disciplines: string[] | null; website_url: string | null; location: { country_code: string | null } | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("events")
      .select("age_categories, age_confidence, disciplines, website_url, location:locations(country_code)")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .gte("start_date", today)
      .lte("start_date", until)
      .order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as typeof rows));
    if (!data || data.length < 1000) break;
  }
  const by = new Map<string, { total: number; noCat: number; explicit: number; guess: number; noDisc: number; noWeb: number }>();
  for (const r of rows) {
    for (const key of ["ALL", r.location?.country_code ?? "?"]) {
      const s = by.get(key) ?? { total: 0, noCat: 0, explicit: 0, guess: 0, noDisc: 0, noWeb: 0 };
      s.total += 1;
      if (!(r.age_categories ?? []).length) s.noCat += 1;
      if (r.age_confidence === "explicit") s.explicit += 1;
      else if ((r.age_categories ?? []).length) s.guess += 1;
      if (!(r.disciplines ?? []).length) s.noDisc += 1;
      if (!r.website_url) s.noWeb += 1;
      by.set(key, s);
    }
  }
  const table = [...by.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 16)
    .map(([k, s]) => ({ country: k, ...s, noCatPct: `${Math.round((s.noCat / s.total) * 100)}%` }));
  console.table(table);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
