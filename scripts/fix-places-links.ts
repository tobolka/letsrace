/**
 * Tidy places and links already in the catalogue.
 *  - "Gliwice, Gliwice" → "Gliwice"
 *  - tracking parameters (utm_*, fbclid…) off website and registration links
 *  - upcoming races whose place is only a country, listed for review
 *    node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/fix-places-links.ts [--apply]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Update } from "../src/lib/supabase/tables";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

function stripTracking(url: string): string {
  const q = url.indexOf("?");
  if (q < 0) return url;
  const hash = url.indexOf("#");
  const end = hash >= 0 && hash > q ? hash : url.length;
  const kept = url
    .slice(q + 1, end)
    .split("&")
    .filter((pair) => pair && !/^(utm_|fbclid|gclid|mc_|_hs)/i.test(pair));
  return url.slice(0, q) + (kept.length ? `?${kept.join("&")}` : "") + url.slice(end);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { dedupeCommaParts, isGarbagePlace } = await import("../src/lib/dedup");
  const s = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const locs: { id: string; name: string | null; municipality: string | null; geocode_query: string | null; lat: number | null; lng: number | null; country_code: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await s.from("locations").select("id,name,municipality,geocode_query,lat,lng,country_code").range(from, from + 999);
    locs.push(...((data ?? []) as typeof locs));
    if (!data || data.length < 1000) break;
  }
  let doubled = 0;
  for (const l of locs) {
    const patch: Record<string, string> = {};
    for (const k of ["name", "municipality", "geocode_query"] as const) {
      const v = l[k];
      if (v && v.includes(",")) {
        const d = dedupeCommaParts(v);
        if (d !== v) patch[k] = d;
      }
    }
    if (!Object.keys(patch).length) continue;
    doubled += 1;
    console.log(`${apply ? "SET" : "DRY"}  place  ${l.municipality}  →  ${patch.municipality ?? l.municipality}`);
    if (apply) await s.from("locations").update(patch as Update<"locations">).eq("id", l.id);
  }

  let links = 0;
  for (const col of ["website_url", "registration_url"] as const) {
    for (let from = 0; ; from += 1000) {
      const { data } = await s.from("events").select(`id, ${col}`).gte("start_date", today).not(col, "is", null).range(from, from + 999);
      for (const e of (data ?? []) as unknown as Record<string, string>[]) {
        const clean = stripTracking(e[col]!);
        if (clean === e[col]) continue;
        links += 1;
        console.log(`${apply ? "SET" : "DRY"}  ${col}  ${e[col]!.slice(0, 80)}  →  ${clean.slice(0, 80)}`);
        if (apply) await s.from("events").update({ [col]: clean } as Update<"events">).eq("id", e.id);
      }
      if (!data || data.length < 1000) break;
    }
  }

  const byId = new Map(locs.map((l) => [l.id, l]));
  const { data: ev } = await s.from("events").select("name,start_date,location_id").eq("visibility", "public").is("merged_into_id", null).gte("start_date", today).limit(5000);
  const countryOnly = (ev ?? []).filter((e) => byId.has(e.location_id as string) && isGarbagePlace(byId.get(e.location_id as string)!.municipality));
  console.log(`\nPlace is only a country (${countryOnly.length}):`);
  for (const e of countryOnly) {
    const l = byId.get(e.location_id as string)!;
    console.log(`  ${e.start_date}  ${e.name}  | ${l.municipality} ${l.country_code} ${l.lat != null ? `(${l.lat.toFixed(2)},${l.lng!.toFixed(2)})` : "(no point)"}`);
  }
  console.log({ doubledPlaces: doubled, trackedLinks: links, dry: !apply });
}
main().catch((e) => { console.error(e); process.exit(1); });
