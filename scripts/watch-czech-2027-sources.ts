/**
 * Start watching the organisers' own pages for the 2027 Czech season.
 * Source: the 2027 calendar compiled by the maintainer on 2026-10-23.
 * Hosts already watched are left to their existing rows.
 *
 * Usage: npx tsx scripts/watch-czech-2027-sources.ts [--dry] [host-fragment]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { watchOne } from "../src/lib/watcher/run";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const DRY = process.argv.includes("--dry");
const FILTER = process.argv.slice(2).find((a) => !a.startsWith("--"))?.toLowerCase();

const TARGETS: { url: string; kind: string; note: string }[] = [
  { url: "https://pruhonaci.cz/terminovka/", kind: "series", note: "Jízda zručnosti Průhoňáci 2027" },
  { url: "https://www.vesani.cz/propozice/", kind: "race", note: "Rohálovská 50ka 2027" },
  { url: "https://bike-paradise.cz/", kind: "series", note: "Bike Paradise: May Divide, Trojmezí, V4, Půl Paradise 2027" },
  { url: "https://www.tjsokolchotebuz.cz/index.php?Itemid=36&id=17&option=com_content&view=article", kind: "race", note: "Chotěbuzský kopec 2027" },
  { url: "https://www.400ultra.cz/", kind: "race", note: "400 Ultra / 200 Hard 2027" },
  { url: "https://www.maratony.eu/", kind: "aggregator", note: "Mamut Tour 2027" },
  { url: "https://www.gravel-epic.cz/", kind: "race", note: "Gravel Epic Šternberk 2027" },
  { url: "https://okolo-stejskala.webnode.cz/", kind: "race", note: "Okolo Stejskala 2027" },
  { url: "https://www.cyklomaratontour.cz/", kind: "series", note: "Decathlon Cyklomaraton Tour 2027" },
  { url: "https://lost-ride.cz/", kind: "race", note: "Lost Ride 2027" },
  { url: "https://www.roadstage.cz/registrace", kind: "series", note: "Road Stage 2027" },
  { url: "https://kalendar.winspace.cz/kalendar", kind: "aggregator", note: "Winspace calendar: Visegrad 4 GP, Ratajská 40" },
  { url: "https://www.dokolamtb.cz/", kind: "race", note: "DoKola! 2027" },
  { url: "https://www.rusavska50.cz/propozice", kind: "race", note: "Rusavská 50 2027" },
  { url: "https://krakonosuvcyklomaraton.cz/", kind: "race", note: "Krakonošův cyklomaraton 2027" },
  { url: "https://www.svckostelec.cz/organizace-skolniho-roku", kind: "race", note: "Dětské závody na pumptracku Kostelec 2027" },
  { url: "https://wolf-man.cz/cyklisticke-zavody-2/", kind: "race", note: "WOLFman 2027" },
  { url: "https://dlbajk.cz/", kind: "race", note: "Dolnolhotský BAJK 2027" },
  { url: "https://www.vinarska50.cz/", kind: "race", note: "Vinařská 50 2027" },
  { url: "https://www.1000miles.cz/", kind: "race", note: "1000 Miles Adventure 2027" },
  { url: "https://www.lipnosportfestival.cz/cyklo-/", kind: "race", note: "Cyklozávod ČEZ Kolem Lipna 2027" },
  { url: "https://zavodnicasomira.cz/zavody", kind: "series", note: "Tour de Kosová 2027" },
  { url: "https://tourdejedlova.cz/", kind: "race", note: "Tour de Jedlová 2027" },
  { url: "https://www.zelenak.cz/", kind: "race", note: "Tour de Zeleňák 2027" },
  { url: "https://www.cyklobrani.cz/o-zavodu/propozice-zavodu", kind: "race", note: "Author Valtické Cyklobraní 2027" },
  { url: "https://www.cyklokros.cz/kalendar", kind: "series", note: "Český svaz cyklistiky cyklokros calendar 2027" },
];

async function main() {
  const supabase = createServerSupabase();
  const list = FILTER ? TARGETS.filter((t) => t.url.toLowerCase().includes(FILTER)) : TARGETS;
  for (const t of list) {
    let { data: row } = await supabase.from("watched_urls").select("*").eq("url", t.url).maybeSingle();
    if (!row) {
      if (DRY) { console.log("WOULD ADD", t.kind, t.url); continue; }
      const ins = await supabase
        .from("watched_urls")
        .insert({ url: t.url, kind: t.kind, status: "active", added_by: "admin", notes: t.note })
        .select("*").single();
      if (ins.error) { console.log("ADD FAILED", t.url, ins.error.message); continue; }
      row = ins.data;
    } else if (DRY) { console.log("EXISTS", row.status, t.url); continue; }
    const out = await watchOne({
      id: row.id, url: row.url, etag: null, last_modified: null, content_hash: null,
      kind: row.kind, last_extract_status: row.last_extract_status,
    });
    console.log(out.ok ? "OK " : "ERR", t.url, "events:", out.eventsUpserted, out.error ?? "");
    for (const e of out.preview ?? []) console.log("     ", e.startDate, e.name);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
