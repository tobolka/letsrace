/**
 * Seed the Czech 2027 races whose organiser pages state the date but that the
 * parsers missed. Source: the maintainer's 2027 calendar CSV (2026-10-23); each
 * row's link was fetched and shows the date. Existing rows (also hidden ones
 * with a junk title) are repaired in place, never duplicated. Name and dates are
 * locked so another source cannot move them.
 *
 * Usage: npx tsx scripts/seed-czech-2027-from-csv.ts [--dry]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { fingerprint, normalizeName, slugifyEvent } from "../src/lib/domain";
import type { Json } from "../src/lib/supabase/tables";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const DRY = process.argv.includes("--dry");
const BY = "czech 2027 csv seed 2026-10-23";

type Race = {
  start: string; end?: string; name: string; place: string; url: string;
  disciplines: string[]; level?: string; match: RegExp; matchDays?: string[];
};
const RACES: Race[] = [
  { start: "2027-05-01", name: "May Divide", place: "Buškovský mlýn", url: "https://bike-paradise.cz/", disciplines: ["mtb"], match: /may divide/i },
  { start: "2027-05-01", end: "2027-05-02", name: "Grand Prix West Bohemia", place: "Kyšice", url: "https://www.uci.org/competition-details/2027/ROA/80572", disciplines: ["road_race"], level: "national", match: /west bohemia/i },
  { start: "2027-05-06", end: "2027-05-09", name: "Závod míru juniorů", place: "Severní Čechy", url: "https://www.uci.org/competition-details/2027/ROA/81168", disciplines: ["road_race"], level: "national", match: /z[áa]vod m[íi]ru/i },
  { start: "2027-05-08", name: "Chotěbuzský kopec", place: "Chotěbuz", url: "https://www.tjsokolchotebuz.cz/index.php?Itemid=36&id=17&option=com_content&view=article", disciplines: ["road"], match: /chot[ěe]buz/i },
  { start: "2027-05-21", end: "2027-05-23", name: "400 Ultra / 200 Hard", place: "Mostek", url: "https://www.400ultra.cz/", disciplines: ["mtb"], match: /400 ultra|200 hard/i },
  { start: "2027-05-22", name: "Gravel Epic Šternberk", place: "Dalov", url: "https://www.gravel-epic.cz/", disciplines: ["gravel"], match: /gravel epic/i },
  { start: "2027-05-30", name: "Decathlon Cyklomaraton Hradec Králové", place: "Hradec Králové", url: "https://www.cyklomaratontour.cz/", disciplines: ["xcm"], match: /cyklomaraton hradec/i },
  { start: "2027-06-12", name: "Rusavská 50", place: "Rusava", url: "https://www.rusavska50.cz/propozice", disciplines: ["xcm"], match: /rusavsk|^propozice$/i },
  { start: "2027-06-18", name: "WOLFman", place: "Orlické hory", url: "https://wolf-man.cz/cyklisticke-zavody-2/", disciplines: ["mtb", "gravel"], match: /wolfman/i, matchDays: ["2027-06-17", "2027-06-18"] },
  { start: "2027-06-20", name: "BSK Giro Pičín", place: "Pičín", url: "https://maraton.cz/terminovka", disciplines: ["xcm"], match: /pi[čc][íi]n/i },
  { start: "2027-07-04", name: "1000 Miles Adventure", place: "Hranice", url: "https://www.1000miles.cz/", disciplines: [], match: /1000 miles/i },
  { start: "2027-07-10", name: "Ratajská 40", place: "Rataje nad Sázavou", url: "https://kalendar.winspace.cz/kalendar", disciplines: ["mtb"], match: /ratajsk/i },
  { start: "2027-08-01", name: "V4", place: "Dolní Bousov", url: "https://bike-paradise.cz/", disciplines: ["mtb"], match: /^v4$/i },
  { start: "2027-08-12", end: "2027-08-15", name: "Czech Tour", place: "Kroměříž", url: "https://www.czechtour.com/", disciplines: ["road_race"], level: "national", match: /czech tour/i },
  { start: "2027-08-15", name: "Cyklozávod ČEZ Kolem Lipna", place: "Lipno nad Vltavou", url: "https://www.lipnosportfestival.cz/cyklo-/", disciplines: ["mtb", "gravel"], match: /kolem lipna/i },
  { start: "2027-08-21", name: "Bike Paradise", place: "Máchalův mlýn", url: "https://bike-paradise.cz/", disciplines: ["mtb"], match: /^bike paradise$/i },
  { start: "2027-08-21", name: "Půl Paradise", place: "Máchalův mlýn", url: "https://bike-paradise.cz/", disciplines: ["mtb"], match: /p[ůu]l paradise/i },
  { start: "2027-09-24", name: "Author Valtické Cyklobraní", place: "Valtice", url: "https://www.cyklobrani.cz/o-zavodu/propozice-zavodu", disciplines: ["mtb", "gravel"], match: /cyklobran/i },
];

const s = createServerSupabase();

async function location(place: string): Promise<string> {
  const { data } = await s.from("locations").select("id").eq("country_code", "CZ").or(`name.eq.${place},municipality.eq.${place}`).limit(1);
  if (data?.[0]) return data[0].id as string;
  const ins = await s.from("locations").insert({ name: place, municipality: place, country_code: "CZ" }).select("id").single();
  if (ins.error) throw new Error(`location ${place}: ${ins.error.message}`);
  return ins.data.id as string;
}

async function findExisting(r: Race): Promise<{ id: string } | null> {
  const days = r.matchDays ?? [r.start];
  const { data } = await s.from("events").select("id,name").in("start_date", days).is("merged_into_id", null);
  const hits = (data ?? []).filter((e) => r.match.test(e.name as string));
  return hits.length === 1 ? { id: hits[0]!.id as string } : null;
}

(async () => {
  const now = new Date().toISOString();
  for (const r of RACES) {
    const found = await findExisting(r);
    if (DRY) { console.log(found ? "UPDATE" : "CREATE", r.start, r.name); continue; }
    const loc = await location(r.place);
    const end = r.end ?? r.start;
    const fp = fingerprint({ startDate: r.start, name: r.name });
    const common = {
      name: r.name, name_normalized: normalizeName(r.name), start_date: r.start, end_date: end,
      disciplines: r.disciplines, location_id: loc, website_url: r.url, status: "scheduled", visibility: "public",
      season: "2027", level: r.level ?? "local", updated_at: now, last_seen_at: now,
    };
    let id = found?.id;
    if (id) {
      const { error } = await s.from("events").update({ ...common, fingerprint: fp }).eq("id", id);
      if (error) { console.log("UPDATE ERR", r.name, error.message); continue; }
    } else {
      const { data, error } = await s.from("events").insert({
        ...common, slug: slugifyEvent(r.name, r.start), fingerprint: fp, audience: "mixed",
        source_kind: "official", event_type: "race", competition_type: "community", created_at: now,
      }).select("id").single();
      if (error) { console.log("CREATE ERR", r.name, error.message); continue; }
      id = data.id as string;
    }
    const { data: ex } = await s.from("event_overrides").select("fields,locked_fields").eq("event_id", id).maybeSingle();
    const fields = { ...((ex?.fields as Record<string, unknown>) ?? {}), name: r.name, start_date: r.start, end_date: end };
    const locked = [...new Set([...((ex?.locked_fields as string[]) ?? []), "name", "start_date", "end_date"])];
    await s.from("event_overrides").upsert({ event_id: id, fields: fields as Json, locked_fields: locked, updated_by: BY }, { onConflict: "event_id" });
    console.log(found ? "OK updated" : "OK created", r.start, r.name);
  }
})().catch((e) => { console.error(e); process.exit(1); });
