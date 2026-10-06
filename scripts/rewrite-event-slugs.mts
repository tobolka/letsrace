/**
 * One-off: give every live race the readable address `eventSlugCandidates`
 * makes (`ct-author-cup-2026`), keeping the old one in `event_slug_aliases`
 * so it redirects.
 *
 *   npx tsx scripts/rewrite-event-slugs.mts          # dry run: counts and samples
 *   npx tsx scripts/rewrite-event-slugs.mts --apply  # write
 *
 * A name that repeats within a year gets the place (or the date) for every
 * race that shares it — no race gets the bare name for being first.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { eventSlugCandidates } from "../src/lib/domain";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed");
const supabase = createClient(url, key, { auth: { persistSession: false } });
const apply = process.argv.includes("--apply");

type Row = {
  id: string;
  slug: string;
  name: string;
  start_date: string;
  merged_into_id: string | null;
  location: { municipality: string | null; name: string | null } | null;
};

async function readAll<T>(table: string, columns: string, orderBy = "id"): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).order(orderBy).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

const events = await readAll<Row>("events", "id, slug, name, start_date, merged_into_id, location:locations(municipality, name)");
const aliases = await readAll<{ slug: string }>("event_slug_aliases", "slug", "slug");
const live = events.filter((e) => !e.merged_into_id).sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id.localeCompare(b.id));

// Never reuse an address something else answers to: merged races' slugs and
// old addresses already kept. Live races' current slugs become aliases, so
// they are reserved for their own race only.
const reserved = new Set([...events.filter((e) => e.merged_into_id).map((e) => e.slug), ...aliases.map((a) => a.slug)]);
const currentOwner = new Map(live.map((e) => [e.slug, e.id]));

const candidates = new Map(live.map((e) => [e.id, eventSlugCandidates(e.name, e.start_date, e.location?.municipality ?? e.location?.name)]));
const firstChoiceCount = new Map<string, number>();
for (const c of candidates.values()) firstChoiceCount.set(c[0]!, (firstChoiceCount.get(c[0]!) ?? 0) + 1);

const assigned = new Map<string, string>();
const used = new Set<string>();
const free = (slug: string, id: string) =>
  !used.has(slug) && !reserved.has(slug) && (currentOwner.get(slug) ?? id) === id;

for (const e of live) {
  const c = candidates.get(e.id)!;
  // A shared first choice goes to nobody: each race takes a more specific one.
  const options = firstChoiceCount.get(c[0]!)! > 1 ? c.slice(1) : c;
  const slug = options.find((s) => free(s, e.id)) ?? `${c.at(-1)}-${e.id.slice(0, 6)}`;
  used.add(slug);
  assigned.set(e.id, slug);
}

const changes = live.filter((e) => assigned.get(e.id) !== e.slug).map((e) => ({ id: e.id, from: e.slug, to: assigned.get(e.id)! }));
const shapes = { year: 0, place: 0, date: 0, stamp: 0 };
for (const c of changes) {
  const opts = candidates.get(c.id)!;
  const i = opts.indexOf(c.to);
  if (i === 0) shapes.year++;
  else if (i === opts.length - 1) shapes.date++;
  else if (i > 0) shapes.place++;
  else shapes.stamp++;
}
console.log(`live races: ${live.length}, to rename: ${changes.length}`, shapes);
for (const c of changes.filter((_, i) => i % Math.max(1, Math.floor(changes.length / 25)) === 0).slice(0, 25)) {
  console.log(`  ${c.from}  →  ${c.to}`);
}

if (!apply) {
  console.log("\nDry run. Pass --apply to write.");
  process.exit(0);
}

// Old addresses first, so no link is ever without a target.
for (let i = 0; i < changes.length; i += 500) {
  const chunk = changes.slice(i, i + 500).map((c) => ({ slug: c.from, event_id: c.id }));
  const { error } = await supabase.from("event_slug_aliases").upsert(chunk, { onConflict: "slug", ignoreDuplicates: true });
  if (error) throw new Error(`aliases: ${error.message}`);
}
console.log(`aliases kept: ${changes.length}`);

let done = 0;
const failed: string[] = [];
const queue = [...changes];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const { error } = await supabase.from("events").update({ slug: c.to }).eq("id", c.id);
      if (error) failed.push(`${c.from} → ${c.to}: ${error.message}`);
      if (++done % 1000 === 0) console.log(`  ${done}/${changes.length}`);
    }
  }),
);
console.log(`renamed: ${changes.length - failed.length}, failed: ${failed.length}`);
for (const f of failed) console.log(`  ${f}`);
