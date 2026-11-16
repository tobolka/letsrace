/**
 * Germany and Austria 2027: races and corrections read by hand from the organisers' own pages
 * on 2026-11-16. Each change names the page that says it (see README.md beside this file).
 *
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs reports/de-at-2027-2026-11-16/apply.ts [--apply]
 *
 * Dry run by default. Before/after rows go to applied.json; a field the organiser stated is locked
 * so a calendar reader cannot put the old value back. Merges use the normal merge routine, so
 * scripts/restore-event-merge.ts undoes one.
 */
import { readFileSync, writeFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

const APPLY = process.argv.includes("--apply");
const BY = "de-at-2027 hand reading 2026-11-16";

type Update = { id: string; name: string; set: Record<string, unknown>; lock?: string[]; why: string; source: string };
type Merge = { keep: string; drop: string; name: string; why: string };
type Create = { name: string; start: string; end?: string; locationId: string; fields: Record<string, unknown>; lock: string[]; why: string; source: string };

const UPDATES: Update[] = [
  {
    id: "d5c275f9-8259-4527-bece-d060774f5221", name: "Canyon Rhein Hunsrück Gravel Marathon",
    set: { name: "CANYON Rhein-Hunsrück Bike Marathon", disciplines: ["mtb", "xcm", "gravel"], formats: ["xcm"], event_type: "race", registration_url: null },
    lock: ["name", "disciplines", "formats", "event_type"],
    why: "Organiser: 'Bikemarathon mit MTB, Gravel, RTF + Kids-Race', 'Termin 2027: 05. + 06. Juni 2027'. The entry link was the 2026 Kids-Race form (raceresult 383989); 2027 sign-up is not open.",
    source: "https://www.mtb-rhens.de/",
  },
  {
    id: "717e94dc-2e41-4f44-b0f8-87d625c10ea0", name: "Alpentour Schladming Dachstein",
    set: { disciplines: ["mtb", "xcm"], formats: ["xcm"], age_categories: ["elite", "amateur"], website_url: "https://alpen-tour.at/" },
    lock: ["disciplines", "formats"],
    why: "Organiser: 'one of Europe’s toughest ... mountain bike stage races', 4 stages, 17.-20. June 2027, 'Whether you’re a professional or a passionate amateur'.",
    source: "https://alpen-tour.at/",
  },
  {
    id: "23b63e35-476a-4418-b635-1351534decff", name: "ARBÖ Kärnten Radmarathon",
    set: { name: "ARBÖ Kärnten Radmarathon Bad Kleinkirchheim", disciplines: ["road", "gran_fondo"], formats: ["gran_fondo"], event_type: "gran_fondo", website_url: "https://www.kaernten-radmarathon.at/", registration_url: "https://entry.racetime.pro/event/1472" },
    lock: ["name", "disciplines", "formats", "website_url"],
    why: "A road marathon, filed as XCM because the federation reader took any 'marathon' for MTB. Organiser: '6. Juni 2027 07:30 Uhr', entry on racetime event 1472 ('ARBÖ Kärnten Radmarathon, 06. Juni 2027').",
    source: "https://www.kaernten-radmarathon.at/",
  },
  {
    id: "c4ba0a71-6c75-47cb-a329-4a5762ae8147", name: "Imster Radmarathon",
    set: { disciplines: ["road", "gran_fondo"], formats: ["gran_fondo"] },
    lock: ["disciplines", "formats"],
    why: "A road Radmarathon filed as XCM by the same 'marathon' rule.",
    source: "https://www.imster-radmarathon.at/",
  },
  {
    id: "806ee1bd-ceaf-40bb-8735-3275a0be9370", name: "ADAC Velotour Eschborn",
    set: { end_date: "2027-05-01", registration_url: "https://in.timeto.com/adac-velotour-2027", website_url: "https://adac-velotour.de/" },
    lock: ["end_date"],
    why: "Organiser: 'ADAC Velotour Eschborn-Frankfurt / 1 Mai 2027', 'Die Anmeldung für die ADAC Velotour 2027 ist jetzt geöffnet!'. The entry link pointed at a UCI calendar page.",
    source: "https://adac-velotour.de/",
  },
  {
    id: "b8141764-3d56-419a-91a2-3651a6e30248", name: "Arlberg Giro Kriterium",
    set: { start_date: "2027-07-31", end_date: "2027-07-31" },
    lock: ["start_date", "end_date"],
    why: "Federation entry now reads 'Sa, 31. Juli 2027'; the organiser lists the international criterium on the Saturday of the Arlberg Giro weekend (Giro on 1 August 2027). 19 June was an earlier date.",
    source: "https://www.cyclingaustria.at/index.php?option=com_events&view=event&id=12B0C9A21F7641899018A28997A3897D",
  },
  {
    id: "4d0e57fa-1674-4b60-ae7f-3eea600fa15b", name: "24h-Radmarathon Grieskirchen",
    set: { website_url: "https://rmg.rc-grieskirchen.at/" },
    why: "Organiser's race site; the /wp/ path was an old install.",
    source: "https://rmg.rc-grieskirchen.at/event/24h/",
  },
  {
    id: "bb1399cd-3baf-4f88-84b8-740bf49afe56", name: "Dolomiten Radrundfahrt",
    set: { registration_url: "https://events.racetime.pro/de/event/1523", regulations_url: "https://www.dolomitensport.at/images/dolomitenradrundfahrt-supergirodolomiti/2027/DRR_SGD_Ausschreibung_2027_DE.pdf" },
    why: "2027 programme page: 'Download Ausschreibung' (2027 PDF) and 'Jetzt anmelden!' to racetime 1523. The old link was the Tiroler Rennrad Cup season entry.",
    source: "https://www.dolomitensport.at/de/dolomitenradrundfahrt-rennen-programm.html",
  },
  {
    id: "e2258c9f-8aed-4cad-a73e-5f26275c82d9", name: "SuperGiroDolomiti",
    set: { registration_url: "https://events.racetime.pro/de/event/1523", regulations_url: "https://www.dolomitensport.at/images/dolomitenradrundfahrt-supergirodolomiti/2027/DRR_SGD_Ausschreibung_2027_DE.pdf" },
    why: "Same 2027 programme, entry and regulations as the Dolomitenradrundfahrt.",
    source: "https://www.dolomitensport.at/de/supergirodolomiti-rennen-programm.html",
  },
  {
    id: "ad9ff574-89b8-40ef-a362-37a1f0709546", name: "Rohanské stezky",
    set: { end_date: "2027-06-19", registration_url: "https://my.raceresult.com/387179/registration?regname=Single%20Registration" },
    why: "Propozice 2027: 'Sobota 19. 6. 2027', 'Přihlášky Předem ONLINE'.",
    source: "https://rohanskestezky.cz/mtb-zavod/propozice/",
  },
];

const MERGES: Merge[] = [
  { keep: "717e94dc-2e41-4f44-b0f8-87d625c10ea0", drop: "4922db6b-041b-4792-847d-38f51cf9d998", name: "Alpentour Schladming Dachstein", why: "Hidden one-day copy of the same 2027 stage race." },
  { keep: "23b63e35-476a-4418-b635-1351534decff", drop: "53f8ace7-add2-413b-9f07-b43363a03969", name: "Kärnten Radmarathon", why: "Hidden copy filed under Czechia; same race, same day, same town." },
  { keep: "b8141764-3d56-419a-91a2-3651a6e30248", drop: "6079dce1-842d-4cae-a14b-aa32745f1804", name: "Arlberg Giro Kriterium", why: "Hidden copy on the correct day (31 July 2027), placed only in 'Vorarlberg'." },
];

const CREATES: Create[] = [
  {
    name: "Münsterland Giro – Stadtwerke-Kids-Cup", start: "2027-10-03", locationId: "7aa3415d-4ff4-40d6-a183-6ba20b3fee92",
    fields: { disciplines: ["road"], formats: [], audience: "kids", age_categories: ["kids"], age_confidence: "previous", event_type: "race", competition_type: "community", level: "local", website_url: "https://muensterland-giro.de/leezencups/leezenkids-stadtwerke-kids-cup/" },
    lock: ["name", "start_date", "location_id", "audience"],
    why: "2027 preliminary schedule on the LeezenCups page: '15.00 Uhr: Start Stadtwerke-Kids-Cup 1'. Ranked: 'Mädchen und Jungen werden getrennt gewertet', 'Pokale für die drei Erstplatzierten', ages 5–12 in three classes (2026 page, so ages marked as last year's). The Girolino balance-bike run ('Es gibt nur Gewinner') is not a race and is left out.",
    source: "https://muensterland-giro.de/leezencups/",
  },
  {
    name: "St. Anton night:sprint", start: "2027-07-30", locationId: "8e958954-53d0-44cd-a31f-ae46e8872b25",
    fields: { disciplines: ["road"], formats: [], audience: "adults", age_categories: ["amateur"], age_confidence: "default", event_type: "race", competition_type: "other", level: "local", website_url: "https://arlberg-giro.com/at/home", registration_url: "https://www.pentek-payment.at/ppay.php?p=1738&s_p=1" },
    lock: ["name", "start_date", "location_id"],
    why: "Organiser: 'Die Anmeldung für den St. Anton night:sprint am 30. Juli 2027 ist geöffnet.' A sprint through the pedestrian zone, open 'unabhängig von deiner Teilnahme am Arlberg Giro'.",
    source: "https://arlberg-giro.com/at/anmeldung",
  },
  {
    name: "Dolomitenradrundfahrt – Kinderradrennen", start: "2027-06-12", locationId: "b6d185b1-f215-473a-8019-7445a746fc18",
    fields: { disciplines: ["road"], formats: [], audience: "kids", age_categories: ["kids"], age_confidence: "default", event_type: "race", competition_type: "community", level: "local", website_url: "https://www.dolomitensport.at/de/dolomitenradrundfahrt-rennen-programm.html" },
    lock: ["name", "start_date", "location_id", "audience"],
    why: "2027 programme: 'Samstag, 12. Juni 2027 ... 10:00 Uhr: Kinderradrennen am Lienzer Hauptplatz'. Categories for 2027 are not published (only a 2026 image).",
    source: "https://www.dolomitensport.at/de/dolomitenradrundfahrt-rennen-programm.html",
  },
];

const WATCH = {
  url: "https://events.endure-cycling.com/events.json",
  kind: "aggregator",
  notes: "ENDURE Events: whole calendar as one JSON file (robots allow, published for machines in llms.txt). Read by adapter:endure — cycling only, confirmed dates only, RTF and unranked German Radmarathons held as rides.",
};

async function main() {
  const { createServerSupabase } = await import("../../src/lib/supabase/server");
  const { mergeEventPair } = await import("../../src/lib/catalog/merge-duplicates");
  const { fingerprint, normalizeName, slugifyEvent } = await import("../../src/lib/domain");
  const db = createServerSupabase();
  const log: unknown[] = [];
  const now = new Date().toISOString();

  async function lock(eventId: string, values: Record<string, unknown>) {
    if (!Object.keys(values).length) return;
    const { data: existing } = await db.from("event_overrides").select("fields,locked_fields").eq("event_id", eventId).maybeSingle();
    const fields = { ...((existing?.fields as Record<string, unknown>) ?? {}), ...values };
    const locked = [...new Set([...((existing?.locked_fields as string[]) ?? []), ...Object.keys(values)])];
    const { error } = await db.from("event_overrides").upsert({ event_id: eventId, fields: fields as never, locked_fields: locked, updated_by: BY, updated_at: now }, { onConflict: "event_id" });
    if (error) throw new Error(`lock ${eventId}: ${error.message}`);
  }

  for (const u of UPDATES) {
    const { data: row, error } = await db.from("events").select("*").eq("id", u.id).maybeSingle();
    if (error || !row) { console.log(`SKIP ${u.name}: not found`); continue; }
    if (row.merged_into_id) { console.log(`SKIP ${u.name}: merged`); continue; }
    if (!String(row.name).startsWith(u.name.slice(0, 12))) { console.log(`SKIP ${u.name}: name is now "${row.name}"`); continue; }
    const { data: ov } = await db.from("event_overrides").select("locked_fields").eq("event_id", u.id).maybeSingle();
    const lockedBefore = new Set((ov?.locked_fields as string[]) ?? []);
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(u.set)) {
      if (lockedBefore.has(k)) { console.log(`  keep locked ${u.name}.${k}`); continue; }
      if (JSON.stringify(row[k as keyof typeof row]) !== JSON.stringify(v)) set[k] = v;
    }
    if (typeof set.name === "string") set.name_normalized = normalizeName(set.name);
    const before = Object.fromEntries(Object.keys(set).map(k => [k, row[k as keyof typeof row]]));
    console.log(`${APPLY ? "UPDATE" : "DRY update"} ${row.start_date} ${row.name}: ${JSON.stringify(set)}`);
    log.push({ action: "update", id: u.id, before, after: set, why: u.why, source: u.source });
    if (!APPLY || !Object.keys(set).length) continue;
    const res = await db.from("events").update({ ...set, updated_at: now }).eq("id", u.id);
    if (res.error) throw new Error(`update ${u.name}: ${res.error.message}`);
    await lock(u.id, Object.fromEntries((u.lock ?? []).filter(k => k in set).map(k => [k, set[k]])));
  }

  for (const m of MERGES) {
    const { data: rows } = await db.from("events").select("id,name,start_date,merged_into_id").in("id", [m.keep, m.drop]);
    const drop = rows?.find(r => r.id === m.drop), keep = rows?.find(r => r.id === m.keep);
    if (!drop || !keep || drop.merged_into_id || keep.merged_into_id) { console.log(`SKIP merge ${m.name}`); continue; }
    console.log(`${APPLY ? "MERGE" : "DRY merge"} ${drop.start_date} "${drop.name}" → ${keep.start_date} "${keep.name}"`);
    log.push({ action: "merge", ...m });
    if (APPLY) await mergeEventPair(m.keep, m.drop);
  }

  for (const c of CREATES) {
    const fp = fingerprint({ startDate: c.start, name: c.name });
    const slug = slugifyEvent(c.name, c.start);
    const { data: clash } = await db.from("events").select("id,name").or(`fingerprint.eq.${fp},slug.eq.${slug}`).is("merged_into_id", null);
    if (clash?.length) { console.log(`SKIP create ${c.name}: exists ${clash.map(r => r.id).join(",")}`); continue; }
    console.log(`${APPLY ? "CREATE" : "DRY create"} ${c.start} ${c.name} (${slug})`);
    if (!APPLY) { log.push({ action: "create", name: c.name, slug, why: c.why, source: c.source }); continue; }
    const { data, error } = await db.from("events").insert({
      slug, name: c.name, name_normalized: normalizeName(c.name), fingerprint: fp, start_date: c.start, end_date: c.end ?? c.start,
      location_id: c.locationId, status: "scheduled", visibility: "public", source_kind: "official", season: "2027",
      created_at: now, updated_at: now, last_seen_at: now, ...c.fields,
    } as never).select("id").single();
    if (error) throw new Error(`create ${c.name}: ${error.message}`);
    const id = (data as { id: string }).id;
    const src = await db.from("event_sources").insert({ event_id: id, source_url: c.source, kind: "official", is_canonical: true, external_id: `hand-${slug}` });
    if (src.error) console.log(`  source row: ${src.error.message}`);
    await lock(id, Object.fromEntries(c.lock.map(k => [k, k === "name" ? c.name : k === "start_date" ? c.start : k === "location_id" ? c.locationId : c.fields[k]])));
    log.push({ action: "create", id, name: c.name, slug, why: c.why, source: c.source });
  }

  const { data: watched } = await db.from("watched_urls").select("id,status").eq("url", WATCH.url).maybeSingle();
  console.log(`${watched ? `watch exists (${watched.status})` : APPLY ? "WATCH add" : "DRY watch add"} ${WATCH.url}`);
  if (APPLY && !watched) {
    const { error } = await db.from("watched_urls").insert({ url: WATCH.url, kind: WATCH.kind, status: "paused", added_by: "admin", notes: WATCH.notes, next_poll_at: now });
    if (error) throw new Error(`watch: ${error.message}`);
    log.push({ action: "watch", url: WATCH.url });
  }

  writeFileSync(`reports/de-at-2027-2026-11-16/${APPLY ? "applied" : "dry-run"}.json`, JSON.stringify(log, null, 2));
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
