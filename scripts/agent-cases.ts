/**
 * Cases for the agent, written as files it can read. Reads the Mac's copy of the catalogue only.
 *
 *   tsx scripts/agent-cases.ts --out=<directory> [--plan=<cycle plan.json>] [--regulations=20] [--duplicates=20]
 *
 * find_regulations: a coming public race without a regulations link.
 * decide_duplicate: a new race the cycle held as "may already be listed", with the listed race it resembles.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { assessDuplicate, datesCompatible, type DedupEvent } from "../src/lib/dedup";
import { isNonRaceEventName } from "../src/lib/event-visibility";
import { classifyEventForAgentQueue, extractSourceCategories, looksLikeRide } from "../src/lib/pipeline2/rides";
import { groupCalendars, groupSameRace, pairKey } from "../src/lib/pipeline2/agent-case-groups";
import { candidateRowToExistingEdition, filterExistingNextDateCases, type ExistingEditionRecord, type PipelineCandidateRow } from "../src/lib/pipeline2/agent-next-date-filter";
import { resolveDetailSources, type DetailPageSnapshot } from "../src/lib/pipeline2/agent-detail-sources";
import { readDocument } from "../src/lib/catalog/regulation-ages";
import { pageAsText } from "../src/lib/watcher/extractors/llm-calendar";

const BIN = process.env.LOCAL_PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin";
const sql = <T>(query: string): T => JSON.parse(execFileSync(`${BIN}/psql`, ["-h", "127.0.0.1", "-p", "54329", "-U", "postgres", "-d", "letsrace", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", query], { encoding: "utf8", maxBuffer: 2 ** 28 }).trim() || "null");
const arg = (key: string) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);

type Row = {
  id: string; name: string; start_date: string; end_date: string | null; status: string | null; visibility: string | null; disciplines: string[] | null; event_type: string | null;
  class_label: string | null; competition_type: string | null; uci_class: string | null; description: string | null; formats: string[] | null;
  website_url: string | null; registration_url: string | null; regulations_url: string | null; series: string | null;
  municipality: string | null; place: string | null; country_code: string | null; lat: number | null; lng: number | null; sources: string[] | null;
};
const SELECT = `select e.id,e.name,e.start_date,e.end_date,e.status,e.visibility,e.disciplines,e.event_type,e.class_label,e.competition_type,e.uci_class,e.description,e.formats,e.website_url,e.registration_url,e.regulations_url,
  s.name series,l.municipality,l.name place,l.country_code,l.lat,l.lng,
  (select array_agg(distinct x.source_url) from public.event_sources x where x.event_id=e.id and x.source_url is not null) sources
  from public.events e left join public.locations l on l.id=e.location_id left join public.series s on s.id=e.series_id`;
const rows = (where: string) => sql<Row[]>(`select coalesce(json_agg(t),'[]') from (${SELECT} where ${where}) t`);

/** What the agent is told about a race: what a person would have in front of them, no internals. */
const shown = (race: Row) => ({
  id: race.id, name: race.name, date: race.start_date, end_date: race.end_date, place: race.municipality ?? race.place, country: race.country_code,
  disciplines: race.disciplines, series: race.series, website: race.website_url, registration: race.registration_url, found_on: (race.sources ?? []).slice(0, 6),
});
const asDedup = (race: Row): DedupEvent => ({
  name: race.name, startDate: race.start_date, endDate: race.end_date, countryCode: race.country_code, placeText: race.municipality ?? race.place,
  lat: race.lat, lng: race.lng, disciplines: race.disciplines as DedupEvent["disciplines"], urls: [race.website_url],
});

const IDENTITY = /^(?:fingerprint|same_url|same_canonical_name|name_sim_high|name_sim_mid|name_substring|series_alias|same_round|weak_name_absorbed|venue_format_mirror|national_championship_mirror)$/;

async function main() {
  const out = arg("out"); if (!out) throw Error("--out=<directory> is needed");
  mkdirSync(out, { recursive: true });
  const cases: object[] = [];
  // A case that already has an answer is not asked again; --skip names the folder of answers.
  const skip = arg("skip"); const answered = (name: string) => Boolean(skip) && existsSync(join(skip!, `${name}.json`));
  // Pairs already judged, under either case name and in either order.
  const earlier = skip ? join(skip, "earlier") : null;
  const previouslyAsked = new Set(earlier && existsSync(earlier) ? readdirSync(earlier)
    .flatMap(name => name.match(/(nextdate-[0-9a-f]{8})\.json$/)?.[1] ?? []) : []);
  const answeredPairs = new Set<string>(skip && existsSync(skip) ? readdirSync(skip).filter(name => /^(?:duplicate|pair)-[0-9a-f]{8}\.json$/.test(name)).flatMap(name => {
    try { const { a, b } = JSON.parse(readFileSync(join(skip, name), "utf8")).answer ?? {}; return a && b ? [pairKey(a, b)] : []; } catch { return []; }
  }) : []);
  const answeredAs = (name: string, verdict: string) => { try { return answered(name) && JSON.parse(readFileSync(join(skip!, `${name}.json`), "utf8")).answer?.verdict === verdict; } catch { return false; } };

  const classifyRow = (race: Pick<Row, "id" | "name" | "start_date" | "end_date" | "event_type" | "class_label" | "competition_type" | "uci_class" | "description" | "formats">) =>
    classifyEventForAgentQueue({
      id: race.id,
      name: race.name,
      startDate: race.start_date,
      endDate: race.end_date,
      eventType: race.event_type,
      sourceCategories: [
        ...extractSourceCategories({ class_label: race.class_label, competition_type: race.competition_type, uci_class: race.uci_class }),
        ...(race.formats ?? []),
      ],
      sourceText: race.description,
    });
  const queuedRideCases = new Set<string>();
  const queueDecideRide = (race: Row) => {
    const rideCase = `ride-${race.id.slice(0, 8)}`;
    if (queuedRideCases.has(rideCase) || answered(rideCase)) return;
    queuedRideCases.add(rideCase);
    cases.push({ case: rideCase, kind: "decide_ride", in_catalogue: true, race: shown(race) });
  };

  // Regulations: nearest race first, Czech and Slovak races first on the same day.
  const wantRegulations = Number(arg("regulations") ?? 20);
  const missing = rows(`e.visibility='public' and e.merged_into_id is null and e.start_date between current_date+2 and current_date+60 and e.regulations_url is null and coalesce(e.status,'') not in ('cancelled','completed')
    order by e.start_date, (l.country_code in ('CZ','SK')) desc, e.id limit ${wantRegulations * 6}`).filter(race => !answered(`regulations-${race.id.slice(0, 8)}`));
  const classifiedMissing = missing.map(race => ({ race, decision: classifyRow(race) }));
  // Non-competitive events (source category or ride name) are skipped; ambiguous ones are sent to decide_ride.
  const realRaces = groupSameRace(
    classifiedMissing
      .filter(({ race, decision }) => decision.action === "process_race" && !answeredAs(`ride-${race.id.slice(0, 8)}`, "ride"))
      .map(({ race }) => ({ case: `regulations-${race.id.slice(0, 8)}`, kind: "find_regulations", race: shown(race) as ReturnType<typeof shown> & { same_race_ids?: string[] } })),
  )
    .filter(item => !(item.race.same_race_ids ?? []).some(id => answered(`regulations-${id.slice(0, 8)}`))).slice(0, wantRegulations);
  cases.push(...realRaces);
  for (const { race } of classifiedMissing.filter(({ decision }) => decision.action === "decide_ride").slice(0, 10)) queueDecideRide(race);

  // Each pair once, whether a held new race or the catalogue raised it and whichever way round.
  const seenPairs = new Set<string>();
  // Duplicates: the held new races, each with the listed race the cycle's own check stumbled on.
  const wantDuplicates = Number(arg("duplicates") ?? 20);
  if (wantDuplicates && arg("plan")) {
    const plan = JSON.parse(readFileSync(arg("plan")!, "utf8")) as { newRaces: { held: { name: string; date: string; because: string[] }[] } };
    const held = plan.newRaces.held.filter(item => item.because.length === 1 && item.because[0] === "may_already_be_listed");
    let made = 0;
    for (const item of held) {
      if (made >= wantDuplicates) break;
      const name = item.name.replace(/'/g, "''");
      const [race] = rows(`e.name='${name}' and e.start_date='${item.date}' and e.merged_into_id is null order by e.created_at desc limit 1`);
      if (!race || answered(`duplicate-${race.id.slice(0, 8)}`)) continue;
      const near = rows(`e.id<>'${race.id}' and e.merged_into_id is null and e.start_date between date '${race.start_date}' - 3 and date '${race.start_date}' + 3`);
      const scored = near.filter(known => datesCompatible({ startDate: known.start_date, endDate: known.end_date }, { startDate: race.start_date, endDate: race.end_date }, 1))
        .map(known => ({ known, match: assessDuplicate(asDedup(race), asDedup(known)) }))
        // The same test the cycle used to hold the race: a shared weekend alone is not a resemblance.
        .filter(pair => pair.match.decision === "match" || pair.match.decision === "review" && (pair.match.reasons.some(reason => IDENTITY.test(reason)) || pair.match.reasons.includes("same_place") && pair.match.reasons.includes("name_sim_low"))
          || Boolean(race.website_url) && race.website_url === pair.known.website_url && race.start_date === pair.known.start_date)
        .sort((a, b) => (b.match.score ?? 0) - (a.match.score ?? 0));
      const best = scored[0]; if (!best) continue;
      // Each pair once: "a like b" and "b like a" are one question.
      const key = pairKey(race.id, best.known.id); if (seenPairs.has(key) || answeredPairs.has(key)) continue; seenPairs.add(key);
      cases.push({ case: `duplicate-${race.id.slice(0, 8)}`, kind: "decide_duplicate", a: shown(race), b: shown(best.known), why_unsure: best.match.reasons });
      made++;
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const short = (value: string) => createHash("md5").update(value).digest("hex").slice(0, 8);
  const plan = arg("plan") ? JSON.parse(readFileSync(arg("plan")!, "utf8")) as { newRaces: { held: { name: string; date: string; because: string[] }[] } } : null;

  // Details are a separate lane and rotate with the other desk cases.
  if (process.env.AGENT_DETAILS_FALLBACK === "1") {
    const practical = sql<(Row & { practical_details: Record<string, { value: unknown; sourceUrl: string }> })[]>(`
      select coalesce(json_agg(t),'[]') from (
        select e.id,e.name,e.start_date,e.end_date,e.status,e.visibility,e.disciplines,e.event_type,e.class_label,e.competition_type,e.uci_class,e.description,e.formats,e.registration_url,e.regulations_url,e.website_url,e.practical_details,s.name series,
          l.municipality,l.name place,l.country_code,l.lat,l.lng,
          (select array_agg(distinct x.source_url) from public.event_sources x where x.event_id=e.id and x.source_url is not null) sources
        from public.events e left join public.locations l on l.id=e.location_id left join public.series s on s.id=e.series_id
        where e.visibility='public' and e.merged_into_id is null and e.start_date between current_date and current_date+120
          and coalesce(e.status,'') not in ('cancelled','completed') and e.event_type is distinct from 'ride'
          and (e.regulations_url is not null or e.practical_details <> '{}')
        order by e.start_date,e.id limit 800
      ) t`);
    const fields = ["venue","organizer","parking","schedule","fees","routes","categories"];
    const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0,16);
    const gateFile = join(out,"..","..","details-gate.json");
    const gate: Record<string,{at:string;fields:Record<string,{value:string;at?:string}>}> = existsSync(gateFile) ? JSON.parse(readFileSync(gateFile,"utf8")) : {};
    const detailNotesFile = join(out, "..", "detail-source-notes.json");
    const detailNotes: Record<string, { reason: string; at: string }> = existsSync(detailNotesFile) ? JSON.parse(readFileSync(detailNotesFile, "utf8")) : {};
    let detailNotesChanged = false;
    const pageCache = new Map<string, DetailPageSnapshot | null>();
    const fetchPage = async (url: string): Promise<DetailPageSnapshot | null> => {
      if (pageCache.has(url)) return pageCache.get(url) ?? null;
      const source = await readDocument(url, { maxBytes: 4 * 1024 * 1024 }).catch(() => null);
      if (!source) { pageCache.set(url, null); return null; }
      const parsed = source.html ? pageAsText(source.html, url) : { text: source.text ?? "", links: [] as string[] };
      const snap: DetailPageSnapshot = { url, text: parsed.text, links: [...parsed.links].map(href => ({ href })) };
      pageCache.set(url, snap);
      return snap;
    };
    let extracts = 0, checks = 0;
    for (const row of practical) {
      const queueDecision = classifyRow(row);
      if (queueDecision.action === "skip_non_competitive" || answeredAs(`ride-${row.id.slice(0, 8)}`, "ride")) continue;
      if (queueDecision.action === "decide_ride") { queueDecideRide(row); continue; }
      const race = { id:row.id,name:row.name,date:row.start_date,end_date:row.end_date,place:row.municipality };
      const stored = row.practical_details ?? {};
      if (extracts < 8 && row.regulations_url && fields.some(field=>!stored[field])) {
        const previousMissingReason = detailNotes[row.id]?.reason ?? null;
        const resolved = await resolveDetailSources(
          { ...race, municipality: row.municipality, series: row.series },
          { fetchPage, allowedUrls: [row.regulations_url, row.website_url, ...(row.sources ?? []).slice(0, 4)], previousMissingReason },
        );
        if (resolved.missingDetailReason) {
          detailNotes[row.id] = { reason: resolved.missingDetailReason, at: new Date().toISOString() };
          detailNotesChanged = true;
        } else if (detailNotes[row.id]) {
          delete detailNotes[row.id];
          detailNotesChanged = true;
        }
        const urls = resolved.urls.length ? resolved.urls : [...new Set([row.regulations_url,row.website_url].filter((url): url is string=>Boolean(url)))];
        const name = `details-${short(JSON.stringify([race,urls]))}`;
        if (!answered(name)) {
          cases.push({
            case: name,
            kind: "extract_details",
            race,
            urls,
            ...(resolved.officialDetailUrl ? { officialDetailUrl: resolved.officialDetailUrl } : {}),
            ...(resolved.missingDetailReason ? { missingDetailReason: resolved.missingDetailReason } : {}),
            ...(resolved.previousMissingReason ? { previousMissingReason: resolved.previousMissingReason } : {}),
          });
          extracts++;
        }
      }
      for (const field of fields) {
        const fact = stored[field];
        if (checks >= 8 || !fact?.sourceUrl) continue;
        const storedHash = hash(fact.value ?? null);
        const storedFactHash = hash(fact);
        const previous = gate[row.id];
        if (previous?.fields[field]?.value === storedHash && Date.now()-Date.parse(previous.fields[field]?.at ?? previous.at)<14*86400000) continue;
        const name = `detailcheck-${short(JSON.stringify([race,field,storedFactHash, today.slice(0,7)]))}`;
        if (!answered(name)) {
          cases.push({case:name,kind:"verify_details",race,field,storedHash,storedFactHash,stored_value:fact.value,urls:[fact.sourceUrl]});
          checks++;
          break;
        }
      }
      if (extracts >= 8 && checks >= 8) break;
    }
    if (detailNotesChanged) {
      writeFileSync(detailNotesFile + ".tmp", JSON.stringify(detailNotes, null, 1));
      renameSync(detailNotesFile + ".tmp", detailNotesFile);
    }
  }

  // Ride or race: new races the cycle held only because their source lists them as rides.
  let rides = 0; const wantRides = Number(arg("rides") ?? 10);
  for (const item of plan?.newRaces.held.filter(held => held.because.length === 1 && held.because[0] === "listed_as_a_ride") ?? []) {
    if (rides >= wantRides) break;
    const [race] = rows(`e.name='${item.name.replace(/'/g, "''")}' and e.start_date='${item.date}' and e.merged_into_id is null and e.start_date>current_date order by e.created_at desc limit 1`);
    if (!race || answered(`ride-${race.id.slice(0, 8)}`)) continue;
    cases.push({ case: `ride-${race.id.slice(0, 8)}`, kind: "decide_ride", race: shown(race) }); rides++;
  }

  // Next edition: last season's races whose own pages mention the coming year without a date we could take.
  const archive = arg("editions"); let editions = 0; const wantEditions = Number(arg("next-dates") ?? 15);
  if (archive && existsSync(join(archive, "edition-status.json")) && existsSync(join(archive, "race-review.json"))) {
    const status = JSON.parse(readFileSync(join(archive, "edition-status.json"), "utf8")) as { summary: { season: number }; rows: { race: string; state: string }[] };
    const wantedYear = Number(status.summary.season);
    const review = new Map((JSON.parse(readFileSync(join(archive, "race-review.json"), "utf8")) as { id: string; name: string; start_date: string; website_url: string | null; location?: { country_code?: string; municipality?: string }; checkedUrls?: string[] }[]).map(race => [race.id, race]));
    const reviewed = existsSync(join(archive, "reviewed-answers.json")) ? JSON.parse(readFileSync(join(archive, "reviewed-answers.json"), "utf8")) as Record<string, unknown> : {};
    const waiting = status.rows.filter(row => (["waiting", "year_only"].includes(row.state) ||
      row.state === "not_announced" && previouslyAsked.has("nextdate-" + row.race.slice(0, 8))) && !reviewed[row.race]).map(row => review.get(row.race)).filter((race): race is NonNullable<typeof race> => Boolean(race))
      .sort((a, b) => Number(["CZ", "SK"].includes(b.location?.country_code ?? "")) - Number(["CZ", "SK"].includes(a.location?.country_code ?? "")) || a.start_date.slice(5).localeCompare(b.start_date.slice(5)));
    const waitingIds = waiting.map(race => race.id).filter(id => /^[a-f0-9-]{36}$/i.test(id));
    type WaitingMeta = { id: string; disciplines: string[] | null; series: string | null; organizer: string | null; registration_url: string | null; municipality: string | null; place: string | null; sources: string[] | null };
    const waitingMeta = new Map((waitingIds.length ? sql<WaitingMeta[]>(`select coalesce(json_agg(t),'[]') from (
      select e.id, e.disciplines, s.name series,
        nullif(trim(coalesce(e.practical_details->'organizer'->'value'->>'name', '')), '') organizer,
        e.registration_url, l.municipality, l.name place,
        (select array_agg(distinct x.source_url) from public.event_sources x where x.event_id=e.id and x.source_url is not null) sources
      from public.events e left join public.locations l on l.id=e.location_id left join public.series s on s.id=e.series_id
      where e.id in (${waitingIds.map(id => `'${id}'`).join(",")})
    ) t`) : []).map(row => [row.id, row]));
    const existingEditions: ExistingEditionRecord[] = Number.isInteger(wantedYear) ? [
      ...sql<ExistingEditionRecord[]>(`select coalesce(json_agg(t),'[]') from (
        select e.id, 'catalogue' source, e.name, e.start_date, e.end_date,
          l.name place, l.municipality, l.country_code country,
          e.disciplines, s.name series,
          nullif(trim(coalesce(e.practical_details->'organizer'->'value'->>'name', '')), '') organizer,
          e.website_url website, e.registration_url registration,
          (select array_agg(distinct x.source_url) from public.event_sources x where x.event_id=e.id and x.source_url is not null) sources
        from public.events e left join public.locations l on l.id=e.location_id left join public.series s on s.id=e.series_id
        where e.merged_into_id is null and extract(year from e.start_date) = ${wantedYear} and coalesce(e.status, '') <> 'hidden'
      ) t`),
      ...sql<PipelineCandidateRow[]>(`select coalesce(json_agg(t),'[]') from (
        select c.id, c.source_url, c.country, c.season, c.payload
        from public.pipeline_candidates c
        where c.status in ('pending', 'waiting', 'publishing')
          and (c.season = ${wantedYear} or coalesce(c.payload->>'startDate', c.payload->>'start_date', '') like '${wantedYear}-%')
      ) t`).map(candidateRowToExistingEdition).filter((item): item is ExistingEditionRecord => Boolean(item)),
    ] : [];
    // "ČP MTB XCM - Malevil cup" and "ČP MTB XCM — Malevil Cup" on one day are one search, not two.
    // Skip any race whose target-year edition is already in the catalogue or pending proposals.
    const searches = filterExistingNextDateCases(
      groupSameRace(waiting.filter(race => !isNonRaceEventName(race.name) && !looksLikeRide(race.name)).map(race => {
        const meta = waitingMeta.get(race.id);
        return { case: `nextdate-${race.id.slice(0, 8)}`, kind: "find_next_date", wanted_year: wantedYear,
          race: { id: race.id, name: race.name, last_date: race.start_date, place: race.location?.municipality ?? meta?.municipality ?? meta?.place ?? null, country: race.location?.country_code ?? null,
            disciplines: meta?.disciplines ?? null, series: meta?.series ?? null, organizer: meta?.organizer ?? null,
            website: race.website_url, registration: meta?.registration_url ?? null, sources: meta?.sources ?? null,
            pages_we_read: (race.checkedUrls ?? []).slice(0, 5) } as { id: string; name: string; last_date: string; place?: string | null; country?: string | null; disciplines?: string[] | null; series?: string | null; organizer?: string | null; website?: string | null; registration?: string | null; sources?: string[] | null; pages_we_read: string[]; same_race_ids?: string[] } & Record<string, unknown> };
      })),
      wantedYear,
      existingEditions,
    );
    // A shared series site gets one reading context, but each round keeps its own evidence and answer.
    const byWebsite = new Map<string, typeof searches>();
    for (const search of searches) {
      let website: URL;
      try { website = new URL(String(search.race.website)); } catch { continue; }
      if (!/^https?:$/.test(website.protocol)) continue;
      website.hash = "";
      const key = website.href.replace(/\/$/, "");
      const group = byWebsite.get(key) ?? [];
      group.push(search);
      byWebsite.set(key, group);
    }
    const peers = new Map(searches.map(search => [search.case, [search]]));
    for (const group of byWebsite.values()) for (const search of group) peers.set(search.case, group);
    const queued = new Set<string>();
    for (const search of searches.flatMap(item => peers.get(item.case) ?? [item])) {
      if (editions >= wantEditions) break;
      if (queued.has(search.case)) continue;
      queued.add(search.case);
      if ([search.race.id, ...(search.race.same_race_ids ?? [])].some(id => answered(`nextdate-${id.slice(0, 8)}`))) continue;
      const relatedRaces = (peers.get(search.case) ?? []).filter(peer => peer !== search)
        .slice(0, 12).map(peer => ({ name: peer.race.name, last_date: peer.race.last_date, place: peer.race.place }));
      cases.push({ ...search, ...(relatedRaces.length ? { relatedRaces } : {}) });
      editions++;
    }
  }

  // Missing races: calendars and federations we read, with what we hold from each.
  const wantCalendars = Number(arg("calendars") ?? 5);
  const calendars = sql<{ id: string; url: string; kind: string; have: { name: string; date: string }[] | null }[]>(`select coalesce(json_agg(t),'[]') from (
    select w.id, w.url, w.kind, (select json_agg(json_build_object('name', e.name, 'date', e.start_date) order by e.start_date) from public.event_sources x join public.events e on e.id=x.event_id
      where x.watched_url_id=w.id and e.start_date>=current_date and e.merged_into_id is null) have
    from public.watched_urls w where w.status='active' and w.kind in ('calendar','federation') and coalesce(w.http_status,200) < 400
      and w.url not ilike '%portal.czechcyclingfederation.com%' -- drawn by a script in the browser; the Mac reads it through Chrome, an agent's fetch sees an empty page
    order by w.last_fetched_at desc nulls last) t`);
  // Filtered views of one calendar (Cycling Austria's "all", "road", a region, page 3) are one read.
  const views = groupCalendars(calendars.map(calendar => ({ case: `calendar-${short(calendar.url)}`, kind: "find_races", from_date: today, source: { url: calendar.url, kind: calendar.kind } as { url: string; kind: string; also?: string[] }, we_have: calendar.have ?? [] })));
  let asked = 0;
  for (const view of views) {
    if (asked >= wantCalendars) break;
    if ([view.source.url, ...(view.source.also ?? [])].some(url => answered(`calendar-${short(url)}`))) continue;
    cases.push({ ...view, we_have: view.we_have.slice(0, 150) }); asked++;
  }

  // Doubles inside the catalogue: two public coming races the rules could neither join nor tell apart.
  const wantPairs = Number(arg("pairs") ?? 10);
  if (wantPairs) {
    // Rides are not judged as doubles: several starts of one ride look like separate entries, and none of them belongs in the catalogue.
    const coming = rows(`e.visibility='public' and e.merged_into_id is null and e.start_date between current_date and current_date + 240 and coalesce(e.status,'') not in ('cancelled','completed','hidden') and coalesce(e.event_type,'') <> 'ride' order by e.start_date, e.id`).filter(race => !looksLikeRide(race.name));
    const known = new Set(sql<string[]>(`select coalesce(json_agg(left_id||'|'||right_id),'[]') from public.duplicate_reviews`));
    let pairs = 0;
    for (let i = 0; i < coming.length && pairs < wantPairs; i++) for (let j = i + 1; j < coming.length && pairs < wantPairs; j++) {
      const a = coming[i]!, b = coming[j]!;
      if (Date.parse(b.start_date) - Date.parse(a.start_date) > 86_400_000) break;
      const key = pairKey(a.id, b.id); if (known.has(key) || answeredPairs.has(key) || seenPairs.has(key) || answered(`pair-${short(key)}`)) continue;
      const match = assessDuplicate(asDedup(a), asDedup(b));
      if (match.decision !== "review" || !match.reasons.some(reason => IDENTITY.test(reason))) continue;
      seenPairs.add(key);
      cases.push({ case: `pair-${short(key)}`, kind: "decide_duplicate", in_catalogue: true, a: shown(a), b: shown(b), why_unsure: match.reasons }); pairs++;
    }
  }

  // New websites the explorer suggested: watch them or let them go. This used to wait for the owner's click in the admin.
  const wantSites = Number(arg("sites") ?? 10);
  if (wantSites) {
    const sites = sql<{ url: string; hint_kind: string | null; linked_from: string | null; same_site: string[] | null }[]>(`select coalesce(json_agg(t),'[]') from (
      select d.url, d.hint_kind, w.url linked_from,
        (select json_agg(x.url) from (select o.url from public.watched_urls o where o.url ilike '%' || split_part(regexp_replace(d.url, '^https?://(www\\.)?', ''), '/', 1) || '%' limit 10) x) same_site
      from public.discovered_links d left join public.watched_urls w on w.id=d.from_watched_url_id
      where d.status='pending' order by d.created_at, d.url) t`);
    let asked = 0;
    for (const site of sites) {
      if (asked >= wantSites) break;
      const name = `site-${short(site.url)}`;
      if (answered(name)) continue;
      cases.push({ case: name, kind: "judge_source", link: { url: site.url, found_as: site.hint_kind, linked_from: site.linked_from }, we_already_watch_on_this_site: site.same_site ?? [] });
      asked++;
    }
  }

  const previousIndex = existsSync(join(out, "index.json"))
    ? new Set((JSON.parse(readFileSync(join(out, "index.json"), "utf8")) as { case: string }[]).map(row => row.case))
    : new Set<string>();
  for (const item of cases as { case: string }[]) {
    const file = join(out, `${item.case}.json`);
    const previous = previousIndex.has(item.case) && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
    const queuedAt = previous?.queuedAt ?? new Date().toISOString();
    writeFileSync(file + ".tmp", JSON.stringify({ ...item, queuedAt }, null, 1));
    renameSync(file + ".tmp", file);
  }
  // Two regulations to one pair, so neither kind waits behind the whole of the other.
  // Round the kinds in turn, so none waits behind the whole of another.
  const all = cases as { case: string; kind: string }[], order: typeof all = [];
  const lanes = ["regulations", "nextdate", "duplicate", "ride", "regulations", "nextdate", "pair", "calendar", "site", "details", "detailcheck"].map(prefix => ({ prefix }));
  const byPrefix = new Map<string, typeof all>(); for (const item of all) { const prefix = item.case.split("-")[0]!; byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), item]); }
  for (const prefix of byPrefix.keys()) if (!lanes.some(lane => lane.prefix === prefix)) lanes.push({ prefix });
  while ([...byPrefix.values()].some(list => list.length)) for (const lane of lanes) { const next = byPrefix.get(lane.prefix)?.shift(); if (next) order.push(next); }
  writeFileSync(join(out, "index.json.tmp"), JSON.stringify(order.map(item => ({ case: item.case, kind: item.kind })), null, 1));
  renameSync(join(out, "index.json.tmp"), join(out, "index.json"));
  const count: Record<string, number> = {}; for (const item of order) count[item.kind] = (count[item.kind] ?? 0) + 1;
  console.log(JSON.stringify({ out, cases: order.length, ...count }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
