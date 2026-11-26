/**
 * What the Mac did, and what it changed, in words the owner can read.
 *
 *   tsx scripts/mac-activity-report.ts [--since=ISO] [--until=ISO] [--hours=24] [--out=DIR]
 *
 * Writes one HTML page (DIR/latest.html and DIR/<date>.html, default reports/mac-activity/,
 * kept out of git because race contacts appear in it):
 *   1. what the Mac ran: every step of its cycle, how often, how it ended, and why not;
 *   2. what reached the server, race by race: a new race, a field "before → after", added
 *      categories, sources and evidence; taken from the server's own record of each batch
 *      (pipeline_sync_batches), the gate's decisions (pipeline_proposals) and merges;
 *   3. what was held back for review instead of being sent.
 *
 * Reads only. Nothing is written anywhere except the report files.
 *
 * Careful with pipeline_sync_batches.journal: it is the UNDO list. An entry "delete" means
 * the batch inserted that row; "insert" means it deleted it; for "update", `before` holds the
 * new value and `after` the old one (scripts/local-sync.sql).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "dotenv";

const arg = (key: string) => process.argv.find((value) => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const DATA = process.env.LETSRACE_DATA_DIR || join(homedir(), "Library/Application Support/LetsRace/data");
const ROOT = resolve(__dirname, "..");

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Row = Record<string, Json>;
type JournalEntry = { tab: string; op: "insert" | "update" | "delete"; pk: Row; owner: string | null; before: Row | null; after: Row | null };

/* ---------- words ---------- */

const STEP: Record<string, string> = {
  completePast: "Uzavírá proběhlé závody",
  resumePublishing: "Dokončuje přerušená zveřejnění",
  resumeServerPublishing: "Dokončuje ověřená zveřejnění",
  candidateFollowup: "Znovu ověřuje čekající závody",
  discovery: "Hledá nové weby pořadatelů",
  discoveryHandoff: "Předává nové zdroje ke kontrole",
  siteDetails: "Doplňuje údaje z webů závodů",
  calendarDocuments: "Hledá propozice v kalendářích",
  siteDocuments: "Hledá propozice na webech závodů",
  findDocuments: "Hledá propozice (fronta a brána)",
  signups: "Čte přihlašovací portály",
  winspace: "Čte české pořadatele z kalendáře",
  pzkol: "Čte polskou federaci",
  federciclismo: "Čte italskou federaci",
  radNetNew: "Přidává chybějící německé závody (rad-net)",
  radNet: "Čte německé závody (rad-net)",
  drn: "Čte německé mládežnické závody (DRN)",
  radgate: "Čte evropské závody (radgate.de)",
  radsportEvents: "Čte závody (radsport-events.de)",
  euPortals: "Čte SK/PL/AT portály (SZC, Competit, Datasport, Time2Win, ENDU)",
  itPortals: "Čte italské portály (MTBonline, WinningTime)",
  chPortals: "Čte švýcarské a alpské portály (TrackMaxx, Datasport)",
  dePlPortals: "Čte německé a polské portály (dsergebnis.de, b4sportonline.pl)",
  czTiming: "Čte české timing portály (Cykloman, Irontime, Sportovní servis)",
  movedRaces: "Slučuje rakouské závody přesunuté na jiný den",
  regulations: "Čte propozice a doplňuje údaje (AI)",
  checkDetails: "Kontroluje nalezené údaje",
  regulationAges: "Doplňuje věkové kategorie z propozic",
  internationalKids: "Hlídá dětské kategorie u mezinárodních závodů",
  uciDirectory: "Čte kalendář UCI",
  websiteSearch: "Hledá weby závodům, které žádný nemají",
  agent: "Připravuje úkoly pro agenta a ověřuje jeho odpovědi",
  agentApply: "Předává ověřené nálezy agenta",
  localRegulations: "Předává nalezené odkazy na propozice",
  geocode: "Doplňuje místa na mapě",
  dateProposals: "Hledá změny dat (jen náhled)",
  dateSend: "Posílá doložené změny dat a zrušení",
  regulationDisagreements: "Porovnává propozice se záznamy (jen náhled)",
  sourceYield: "Měří, co z kalendářů v katalogu chybí",
  sourceYieldGaps: "Vybírá chybějící závody z kalendářů",
  sourceHealth: "Kontroluje zdroje, které zmlkly",
  structuredDetails: "Čte strukturované údaje závodů",
};
const OUTCOME: Record<string, string> = {
  done: "hotovo", partial: "část (vypršel čas)", waiting: "čekal na svůj termín", failed: "selhalo", blocked: "zablokováno", deferred: "odloženo", skipped: "přeskočeno",
};
const REASON: Record<string, string> = {
  own_time_budget: "došel čas vyhrazený kroku", robot_check: "web chce ověření „nejsem robot“", exit_1: "skript skončil chybou",
  crashed: "spadl", not_due: "ještě nebyl čas", ai_budget_day: "došel denní rozpočet na AI (0,50 USD)", ai_budget_month: "došel měsíční rozpočet na AI (5 USD)",
};
const FIELD: Record<string, string> = {
  name: "Název", start_date: "Datum začátku", end_date: "Datum konce", status: "Stav", visibility: "Viditelnost",
  website_url: "Web", registration_url: "Přihláška", regulations_url: "Propozice", results_url: "Výsledky",
  registration_opens_at: "Přihlášky od", registration_closes_at: "Přihlášky do", location_id: "Místo",
  age_categories: "Věkové kategorie", age_confidence: "Jistota kategorií", audience: "Pro koho", formats: "Formáty",
  disciplines: "Disciplíny", event_type: "Druh akce", series_id: "Seriál", uci_class: "Třída UCI", class_label: "Třída",
  practical_details: "Praktické údaje", description: "Popis", merged_into_id: "Sloučeno do", source_evidence: "Doklad ze zdroje",
  "practical.schedule": "Program", "practical.routes": "Trasy", "practical.fees": "Startovné", "practical.organizer": "Pořadatel",
  "practical.venue": "Místo konání", "practical.parking": "Parkování", "practical.categories": "Kategorie", "practical.documents": "Dokumenty",
  event_categories: "Kategorie (tabulka)",
};
const PRACTICAL: Record<string, string> = {
  organizer: "Pořadatel", schedule: "Program", fees: "Startovné", routes: "Trasy", venue: "Místo konání", parking: "Parkování",
  categories: "Kategorie", documents: "Dokumenty", contact: "Kontakt",
};
const VALUE: Record<string, string> = {
  scheduled: "plánovaný", completed: "proběhl", cancelled: "zrušený", tbc: "termín nepotvrzen", public: "veřejný", hidden: "skrytý",
  explicit: "z dokumentu", default: "odhad", previous: "jako loni", kids: "děti", adults: "dospělí", mixed: "děti i dospělí",
};
const METHOD: Record<string, string> = {
  agent: "agent (ověřená citace)", federation_page: "stránka federace", site_documents: "dokumenty na webu závodu", search_verified: "ověřené hledání",
  mac_date_proposals: "doložená změna data", registration_links: "odkaz na přihlášku", practical_details: "propozice",
  regulation_categories: "kategorie z propozic", fci_ages: "italská federace", uci_directory: "kalendář UCI", watcher_update_v2: "zdroj",
  watcher_source_evidence: "doklad ze zdroje", hidden_review: "kontrola skrytých závodů", manual_publish: "zveřejnění po kontrole",
  calendar_elapsed: "termín proběhl", catalogue_age_inference: "odhad kategorií", confirmed_series: "potvrzený seriál",
  location_hygiene: "oprava místa", previous_edition: "minulý ročník", cycling_austria_detail: "rakouská federace",
};

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cut = (value: string, max = 160) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);
const prague = (at: string | number) => new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(at));
const hourOf = (at: string) => new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", hour: "2-digit" }).format(new Date(at));
const empty = (value: Json | undefined) => value == null || value === "" || (Array.isArray(value) && !value.length) || (typeof value === "object" && !Array.isArray(value) && !Object.keys(value).length);

/** One value as a person would say it. */
function say(value: Json | undefined, field = "", places: Map<string, string> = new Map()): string {
  if (empty(value)) return "—";
  if (field === "location_id" && typeof value === "string") return places.get(value) ?? "jiné místo";
  if (typeof value === "string") {
    if (VALUE[value]) return VALUE[value]!;
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return prague(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) { const [y, m, d] = value.split("-"); return `${Number(d)}. ${Number(m)}. ${y}`; }
    return cut(value);
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return cut(value.map((item) => (typeof item === "object" && item ? practicalItem(item) : say(item))).join(", "));
  const object = value as Record<string, Json>;
  if ("value" in object) return say(object.value);
  if (typeof object.name === "string") return cut(object.name);
  return cut(JSON.stringify(object));
}
function practicalItem(item: Json): string {
  if (!item || typeof item !== "object" || Array.isArray(item)) return say(item);
  const o = item as Record<string, Json>;
  const parts = [o.label, o.name, o.date && o.time ? `${o.date} ${o.time}` : o.date, o.amount != null ? `${o.amount} ${o.currency ?? ""}`.trim() : null, o.distanceKm != null ? `${o.distanceKm} km` : null, o.url]
    .filter((part): part is string | number => typeof part === "string" || typeof part === "number");
  return parts.length ? parts.join(" ") : cut(JSON.stringify(o), 80);
}

/** Field changes as lines "label: before → after"; practical details are opened up by section. */
function changeLines(oldRow: Row, newRow: Row, places: Map<string, string>): string[] {
  const lines: string[] = [];
  for (const key of new Set([...Object.keys(newRow)])) {
    if (["updated_at", "public_revision", "search_text", "last_seen_at", "fingerprint", "content_hash"].includes(key)) continue;
    const before = oldRow[key], after = newRow[key];
    if (JSON.stringify(before ?? null) === JSON.stringify(after ?? null)) continue;
    if (key === "practical_details" && (typeof before === "object" || typeof after === "object")) {
      const b = (before && typeof before === "object" && !Array.isArray(before) ? before : {}) as Record<string, Json>;
      const a = (after && typeof after === "object" && !Array.isArray(after) ? after : {}) as Record<string, Json>;
      for (const part of new Set([...Object.keys(b), ...Object.keys(a)])) {
        if (JSON.stringify(b[part] ?? null) === JSON.stringify(a[part] ?? null)) continue;
        const label = PRACTICAL[part] ?? part;
        const quote = a[part] && typeof a[part] === "object" && !Array.isArray(a[part]) ? (a[part] as Record<string, Json>).quote : null;
        const sameValue = JSON.stringify((b[part] as Record<string, Json> | undefined)?.value ?? null) === JSON.stringify((a[part] as Record<string, Json> | undefined)?.value ?? null);
        if (sameValue && !empty(a[part])) { lines.push(`${esc(label)}: znovu ověřeno, beze změny`); continue; }
        lines.push(`${label}: ${verb(b[part], a[part])} ${esc(say(b[part]))} → ${esc(say(a[part]))}${typeof quote === "string" ? ` <q>${esc(cut(quote, 120))}</q>` : ""}`);
      }
      continue;
    }
    lines.push(`${FIELD[key] ?? key}: ${verb(before, after)} ${esc(say(before, key, places))} → ${esc(say(after, key, places))}`);
  }
  return lines;
}
const verb = (before: Json | undefined, after: Json | undefined) =>
  empty(before) ? '<b class="add">doplněno</b>' : empty(after) ? '<b class="del">odebráno</b>' : '<b class="chg">změněno</b>';

/* ---------- the Mac's own record ---------- */

type Cycle = { id: string; startedAt: string; finishedAt?: string; seconds?: number; publishedNewRaces?: number; updatedRaces?: number; readSources?: number; sourceFailures?: number; aiCostUsd?: number; heldRaces?: number; problems?: (string | { message?: string })[]; steps?: Record<string, { outcome: string; reason: string | null }>; error?: string; agentApplied?: Record<string, number> | null };

function cycles(since: number, until: number): Cycle[] {
  const dir = join(DATA, "local-cycles");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    try {
      const cycle = JSON.parse(readFileSync(join(dir, name, "result.json"), "utf8")) as Cycle;
      const at = Date.parse(cycle.startedAt);
      return at >= since && at < until ? [cycle] : [];
    } catch { return []; }
  }).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** "https://web.cz/x — HTTP 503" instead of the raw record the cycle keeps. */
function problemText(problem: unknown): string {
  if (typeof problem === "string") return problem;
  if (problem && typeof problem === "object") {
    const o = problem as { url?: string; error?: string; message?: string };
    const error = (o.error ?? o.message ?? "").replace(/write_failed:[^;]*identity_review_required[^;]*/g, "čeká na posouzení totožnosti závodu").replace(/calendar_write_retry_pending/g, "zápis se zkusí znovu");
    return [o.url, error].filter(Boolean).join(" — ") || JSON.stringify(problem);
  }
  return String(problem);
}

/* ---------- main ---------- */

async function main() {
  for (const [key, value] of Object.entries(parse(readFileSync(join(ROOT, ".env.local"), "utf8")))) process.env[key] ??= value;
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const db = createServerSupabase();
  const until = arg("until") ? Date.parse(arg("until")!) : Date.now();
  const since = arg("since") ? Date.parse(arg("since")!) : until - Number(arg("hours") ?? 24) * 3_600_000;
  const sinceIso = new Date(since).toISOString(), untilIso = new Date(until).toISOString();

  // The generated types do not know the private tables this report reads (batches, gate, merges).
  type Query = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> & { gte(c: string, v: string): Query; lt(c: string, v: string): Query; in(c: string, v: string[]): Query; order(c: string): Query; limit(n: number): Query };
  const loose = createServerSupabase() as unknown as { from(table: string): { select(columns: string): Query } };
  const read = async <T>(query: Query): Promise<T[]> => { const { data, error } = await query; if (error) throw Error(error.message); return (data ?? []) as T[]; };

  type Batch = { id: number; created_at: string; summary: Record<string, number> | null; journal: JournalEntry[] | null };
  type Proposal = { event_id: string; field: string; value: Json; source_url: string | null; quote: string | null; reader: string; status: string; reason: string | null; decided_at: string };
  type Merge = { keep_id: string; drop_id: string; before_state: Row | null; created_at: string; restored_at: string | null };
  type Fact = { id: string; event_id: string; field: string; value: Json; previous: Json; source_url: string | null; quote: string | null; method: string; created_at: string };
  const [batches, proposals, merges, facts] = await Promise.all([
    read<Batch>(loose.from("pipeline_sync_batches").select("id,created_at,summary,journal").gte("created_at", sinceIso).lt("created_at", untilIso).order("id")),
    read<Proposal>(loose.from("pipeline_proposals").select("event_id,field,value,source_url,quote,reader,status,reason,decided_at").gte("decided_at", sinceIso).lt("decided_at", untilIso)),
    read<Merge>(loose.from("pipeline_merge_history").select("keep_id,drop_id,before_state,created_at,restored_at").gte("created_at", sinceIso).lt("created_at", untilIso)),
    read<Fact>(loose.from("event_facts").select("id,event_id,field,value,previous,source_url,quote,method,created_at").gte("created_at", sinceIso).lt("created_at", untilIso).limit(5000)),
  ]);

  type RaceLog = { inserted?: Row; removed?: Row; lines: string[]; sources: string[]; categories: string[]; evidence: { label: string; source: string | null; quote: string | null }[] };
  const races = new Map<string, RaceLog>();
  const race = (id: string) => { let log = races.get(id); if (!log) { log = { lines: [], sources: [], categories: [], evidence: [] }; races.set(id, log); } return log; };
  const placeIds = new Set<string>(), otherLines: string[] = [], viaSync = new Set<string>();
  const held = { applied: 0, unchanged: 0, conflict: 0, group_held: 0 };

  const entries: JournalEntry[] = [];
  for (const batch of batches) {
    for (const [state, n] of Object.entries((batch.summary ?? {}) as Record<string, number>)) if (state in held) held[state as keyof typeof held] += n;
    for (const entry of (batch.journal ?? []) as JournalEntry[]) entries.push(entry);
  }
  for (const entry of entries) for (const row of [entry.before, entry.after]) if (row && typeof row.location_id === "string") placeIds.add(row.location_id);
  const places = new Map<string, string>();
  const placeList = [...placeIds];
  for (let i = 0; i < placeList.length; i += 200) {
    const { data, error } = await db.from("locations").select("id,name,municipality,country_code").in("id", placeList.slice(i, i + 200));
    if (error) throw Error(error.message);
    for (const place of data ?? []) places.set(place.id, [place.municipality ?? place.name, place.country_code].filter(Boolean).join(", "));
  }

  for (const entry of entries) {
    // Undo list, read the right way round.
    const did = entry.op === "delete" ? "insert" : entry.op === "insert" ? "delete" : "update";
    const now = (entry.op === "update" ? entry.before : entry.op === "delete" ? entry.before : null) ?? {};
    const old = (entry.op === "update" ? entry.after : entry.op === "insert" ? entry.after : null) ?? {};
    const row = did === "delete" ? old : now;
    const owner = entry.owner ?? (entry.tab === "public.events" ? String(entry.pk.id) : null);
    if (entry.tab === "public.events") {
      const log = race(owner!);
      if (did === "insert") log.inserted = now;
      else if (did === "delete") log.removed = old;
      else log.lines.push(...changeLines(old, now, places));
    } else if (entry.tab === "public.event_sources" && owner) {
      race(owner).sources.push(`${did === "delete" ? "odebrán" : did === "insert" ? "přidán" : "upraven"} zdroj ${esc(cut(String(row.source_url ?? row.url ?? ""), 90))}`);
    } else if (entry.tab === "public.event_categories" && owner) {
      race(owner).categories.push(`${did === "delete" ? "−" : did === "insert" ? "+" : "~"} ${esc(cut(String(row.label ?? row.name ?? row.category ?? ""), 60))}`);
    } else if (entry.tab === "public.event_facts" && owner) {
      if (typeof row.id === "string") viaSync.add(row.id);
      if (did === "insert" && row.field !== "source_evidence") race(owner).evidence.push({ label: FIELD[String(row.field)] ?? String(row.field), source: typeof row.source_url === "string" ? row.source_url : null, quote: typeof row.quote === "string" ? row.quote : null });
    } else if (entry.tab === "public.locations") {
      otherLines.push(`${did === "insert" ? "Nové místo" : did === "delete" ? "Odebrané místo" : "Upravené místo"}: ${esc(String(row.municipality ?? row.name ?? ""))}${row.country_code ? `, ${row.country_code}` : ""}`);
    } else {
      otherLines.push(`${entry.tab.replace("public.", "")}: ${did === "insert" ? "přidáno" : did === "delete" ? "odebráno" : "změněno"} ${esc(cut(String(row.name ?? row.url ?? JSON.stringify(entry.pk)), 100))}`);
    }
  }

  // Changes written to the server directly (gate, publication, server jobs), each with its record.
  const direct = new Map<string, { field: string; method: string; previous: Json; value: Json; source: string | null; quote: string | null; at: string }[]>();
  for (const fact of facts) {
    if (viaSync.has(fact.id) || fact.field === "source_evidence") continue;
    if (JSON.stringify(fact.previous ?? null) === JSON.stringify(fact.value ?? null) && fact.method === "hidden_review") continue; // a check that kept a race hidden as it was
    const list = direct.get(fact.event_id) ?? [];
    list.push({ field: fact.field, method: fact.method, previous: fact.previous as Json, value: fact.value as Json, source: fact.source_url, quote: fact.quote, at: fact.created_at });
    direct.set(fact.event_id, list);
  }
  const hiddenChecks = (facts).filter((fact) => fact.method === "hidden_review" && JSON.stringify(fact.previous) === JSON.stringify(fact.value)).length;

  // Names of every race mentioned.
  const ids = [...new Set([...races.keys(), ...direct.keys(), ...(proposals).map((p) => p.event_id), ...(merges).flatMap((m) => [m.keep_id, m.drop_id])])].filter(Boolean) as string[];
  const names = new Map<string, { name: string; start_date: string; slug: string | null; visibility: string | null }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from("events").select("id,name,start_date,slug,visibility").in("id", ids.slice(i, i + 200));
    if (error) throw Error(error.message);
    for (const event of data ?? []) names.set(event.id, event);
  }
  const title = (id: string, fallback?: Row) => {
    const event = names.get(id);
    const name = event?.name ?? (typeof fallback?.name === "string" ? fallback.name : "neznámý závod");
    const date = event?.start_date ?? (typeof fallback?.start_date === "string" ? fallback.start_date : "");
    const links = [event?.slug ? `<a href="https://letsrace.cz/cs/e/${esc(event.slug)}">web</a>` : "", `<a href="https://letsrace.cz/admin/events/${esc(id)}">admin</a>`].filter(Boolean).join(" · ");
    return `<strong>${esc(name)}</strong> <span class="muted">${esc(say(date))}${event?.visibility === "hidden" ? " · skrytý" : ""} · ${links}</span>`;
  };

  // The Mac's cycles.
  const runs = cycles(since, until);
  const steps = new Map<string, Map<string, { n: number; reasons: Set<string> }>>();
  const problems = new Map<string, number>();
  const hours = new Map<string, { runs: number; read: number; fails: number; created: number; updated: number; busy: Set<string> }>();
  let totals = { read: 0, fails: 0, created: 0, updated: 0, ai: 0, seconds: 0 };
  for (const run of runs) {
    totals = { read: totals.read + (run.readSources ?? 0), fails: totals.fails + (run.sourceFailures ?? 0), created: totals.created + (run.publishedNewRaces ?? 0), updated: totals.updated + (run.updatedRaces ?? 0), ai: totals.ai + (run.aiCostUsd ?? 0), seconds: totals.seconds + (run.seconds ?? 0) };
    const hour = hourOf(run.startedAt);
    const h = hours.get(hour) ?? { runs: 0, read: 0, fails: 0, created: 0, updated: 0, busy: new Set<string>() };
    h.runs++; h.read += run.readSources ?? 0; h.fails += run.sourceFailures ?? 0; h.created += run.publishedNewRaces ?? 0; h.updated += run.updatedRaces ?? 0;
    for (const [name, step] of Object.entries(run.steps ?? {})) {
      const byOutcome = steps.get(name) ?? new Map();
      const slot = byOutcome.get(step.outcome) ?? { n: 0, reasons: new Set<string>() };
      slot.n++; if (step.reason) slot.reasons.add(REASON[step.reason] ?? step.reason);
      byOutcome.set(step.outcome, slot); steps.set(name, byOutcome);
      if (step.outcome !== "waiting") h.busy.add(STEP[name] ?? name);
    }
    hours.set(hour, h);
    for (const problem of run.problems ?? []) { const text = cut(problemText(problem), 220); problems.set(text, (problems.get(text) ?? 0) + 1); }
    if (run.error) problems.set(cut(run.error, 200), (problems.get(cut(run.error, 200)) ?? 0) + 1);
  }

  /* ---------- page ---------- */
  const newRaces = [...races].filter(([, log]) => log.inserted);
  const changed = [...races].filter(([, log]) => !log.inserted && !log.removed && (log.lines.length || log.categories.length || log.sources.length || log.evidence.length));
  const removed = [...races].filter(([, log]) => log.removed);
  const applied = (proposals).filter((p) => p.status === "applied");
  const refused = (proposals).filter((p) => p.status !== "applied");

  const raceBlock = ([id, log]: [string, RaceLog]) => `<li>${title(id, log.inserted ?? log.removed)}
    ${log.lines.length ? `<ul>${log.lines.map((line) => `<li>${line}</li>`).join("")}</ul>` : ""}
    ${log.categories.length ? `<p class="small">Kategorie: ${log.categories.join(", ")}</p>` : ""}
    ${log.sources.length ? `<p class="small">${log.sources.join("<br>")}</p>` : ""}
    ${log.evidence.length ? `<details><summary>Doklady (${log.evidence.length})</summary><ul>${log.evidence.map((e) => `<li>${esc(e.label)}${e.quote ? `: <q>${esc(cut(e.quote, 160))}</q>` : ""}${e.source ? ` <a href="${esc(e.source)}">zdroj</a>` : ""}</li>`).join("")}</ul></details>` : ""}
  </li>`;

  const stepRows = [...steps].sort((a, b) => (STEP[a[0]] ?? a[0]).localeCompare(STEP[b[0]] ?? b[0], "cs")).map(([name, byOutcome]) => {
    const worked = [...byOutcome].filter(([outcome]) => outcome !== "waiting");
    const bad = worked.some(([outcome]) => ["failed", "blocked"].includes(outcome));
    return `<tr class="${bad ? "bad" : worked.length ? "" : "muted"}"><td>${esc(STEP[name] ?? name)}</td><td>${[...byOutcome].map(([outcome, slot]) => `${OUTCOME[outcome] ?? outcome} ${slot.n}×${slot.reasons.size ? ` <span class="muted">(${[...slot.reasons].map(esc).join("; ")})</span>` : ""}`).join("<br>")}</td></tr>`;
  }).join("");

  const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Co dělal Mac</title>
<style>
:root{--fg:#18181b;--muted:#71717a;--bg:#fff;--line:#e4e4e7;--add:#15803d;--del:#b91c1c;--chg:#a16207;--soft:#f4f4f5}
@media (prefers-color-scheme:dark){:root{--fg:#f4f4f5;--muted:#a1a1aa;--bg:#18181b;--line:#3f3f46;--add:#4ade80;--del:#f87171;--chg:#facc15;--soft:#27272a}}
body{font:15px/1.5 system-ui,sans-serif;color:var(--fg);background:var(--bg);max-width:960px;margin:0 auto;padding:24px 16px}
h1{font-size:26px;margin:0}h2{font-size:19px;margin:32px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}
.muted{color:var(--muted)}.small{font-size:13px;margin:4px 0}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
.bad td{color:var(--del)}.add{color:var(--add)}.del{color:var(--del)}.chg{color:var(--chg)}q{color:var(--muted);font-style:italic}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:16px 0}.card{background:var(--soft);border-radius:8px;padding:12px}.card b{display:block;font-size:24px}
ul.races>li{margin:12px 0}a{color:inherit}details summary{cursor:pointer;color:var(--muted);font-size:13px}
</style></head><body>
<h1>Co dělal Mac</h1>
<p class="muted">${esc(prague(since))} – ${esc(prague(until))} · vytvořeno ${esc(prague(Date.now()))}</p>

<div class="cards">
<div class="card"><b>${runs.length}</b>běhů sběru</div>
<div class="card"><b>${totals.read}</b>přečtených zdrojů${totals.fails ? ` <span class="del">(${totals.fails} nečitelných)</span>` : ""}</div>
<div class="card"><b>${newRaces.length}</b>nových závodů na webu</div>
<div class="card"><b>${changed.length + direct.size}</b>závodů se změnou</div>
<div class="card"><b>${removed.length}</b>závodů odebráno</div>
<div class="card"><b>${held.group_held + held.conflict}</b>změn zadrženo ke kontrole</div>
</div>
<p class="muted">Čísla ze serveru jsou to, co se na web opravdu dostalo. Mac sám u sebe hlásil ${totals.created} nových a ${totals.updated} upravených závodů; rozdíl jsou změny, které server odmítl nebo zadržel.</p>

<h2>1. Co Mac spouštěl</h2>
<p class="muted">Každý krok má svůj rytmus; „čekal na svůj termín“ znamená, že ho běh přeskočil, protože ještě nebyl na řadě. Červeně jsou kroky, které selhaly nebo byly zablokované.</p>
<table><thead><tr><th>Krok</th><th>Jak dopadl</th></tr></thead><tbody>${stepRows || '<tr><td colspan="2">Žádný běh v tomto období.</td></tr>'}</tbody></table>
${problems.size ? `<h3>Hlášené problémy</h3><ul>${[...problems].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([text, n]) => `<li>${esc(text)} <span class="muted">${n}×</span></li>`).join("")}</ul>` : ""}
<details><summary>Po hodinách</summary><table><thead><tr><th>Hodina</th><th>Běhů</th><th>Přečteno</th><th>Nové / upravené</th><th>Co dělal</th></tr></thead><tbody>
${[...hours].map(([hour, h]) => `<tr><td>${esc(hour)}</td><td>${h.runs}</td><td>${h.read}${h.fails ? ` <span class="del">(${h.fails}✗)</span>` : ""}</td><td>${h.created} / ${h.updated}</td><td class="small">${[...h.busy].map(esc).join(", ") || '<span class="muted">jen kontrola, nic nebylo na řadě</span>'}</td></tr>`).join("")}
</tbody></table></details>

<h2>2. Nové závody (${newRaces.length})</h2>
${newRaces.length ? `<ul class="races">${newRaces.map(raceBlock).join("")}</ul>` : "<p>Žádné.</p>"}

<h2>3. Změny u existujících závodů (${changed.length})</h2>
<p class="muted">Poslal je Mac v dávkách. U každé změny je, co tam bylo a co tam je teď.</p>
${changed.length ? `<ul class="races">${changed.map(raceBlock).join("")}</ul>` : "<p>Žádné.</p>"}

${removed.length ? `<h2>Odebrané závody (${removed.length})</h2><ul class="races">${removed.map(raceBlock).join("")}</ul>` : ""}

<h2>4. Změny přes bránu a serverové úlohy (${direct.size} závodů)</h2>
<p class="muted">Tyto změny nešly v dávce, ale každá prošla kontrolou na serveru (citace, zámky, pravidla). ${hiddenChecks ? `Navíc ${hiddenChecks}× kontrola skrytého závodu, který zůstal skrytý.` : ""}</p>
${direct.size ? `<ul class="races">${[...direct].map(([id, list]) => `<li>${title(id)}<ul>${list.map((f) => `<li>${esc(FIELD[f.field] ?? f.field)}: ${verb(f.previous, f.value)} ${esc(say(f.previous, f.field, places))} → ${esc(say(f.value, f.field, places))} <span class="muted">· ${esc(METHOD[f.method] ?? f.method)}</span>${f.quote ? ` <q>${esc(cut(f.quote, 140))}</q>` : ""}${f.source ? ` <a href="${esc(f.source)}">zdroj</a>` : ""}</li>`).join("")}</ul></li>`).join("")}</ul>` : "<p>Žádné.</p>"}
${refused.length ? `<details><summary>Návrhy, které brána nepřijala (${refused.length})</summary><ul>${refused.map((p) => `<li>${title(p.event_id)}: ${esc(FIELD[p.field] ?? p.field)} → ${esc(say(p.value as Json, p.field))} <span class="muted">· ${esc(p.status)}${p.reason ? `, ${esc(p.reason)}` : ""}</span></li>`).join("")}</ul></details>` : ""}
${applied.length ? `<p class="muted">Brána přijala ${applied.length} návrhů; jsou v seznamu výše.</p>` : ""}

<h2>5. Sloučené duplicity (${(merges).length})</h2>
${(merges).length ? `<ul>${(merges).map((m) => `<li>${esc(String(m.before_state?.name ?? "závod"))} sloučen do ${title(m.keep_id)}${m.restored_at ? ' <span class="chg">(vráceno)</span>' : ""}</li>`).join("")}</ul>` : "<p>Žádné.</p>"}

<h2>6. Zadrženo, neodesláno</h2>
<p>Dávky: odesláno ${held.applied}, beze změny ${held.unchanged}, <b>zadrženo ke kontrole ${held.group_held}</b>, v rozporu se serverem ${held.conflict}.</p>
<p class="muted">Zadržené změny mění to, co jezdec vidí (datum, název, zrušení), a mohly by patřit jinému závodu, proto čekají. V rozporu jsou změny, které mezitím na serveru změnil někdo jiný; Mac je nepřepíše.</p>
${otherLines.length ? `<details><summary>Ostatní zápisy (${otherLines.length})</summary><ul>${otherLines.map((line) => `<li>${line}</li>`).join("")}</ul></details>` : ""}
</body></html>`;

  const out = resolve(arg("out") ?? join(ROOT, "reports", "mac-activity"));
  mkdirSync(out, { recursive: true });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(new Date(until));
  for (const name of [`${day}.html`, "latest.html"]) { writeFileSync(join(out, name + ".tmp"), html); renameSync(join(out, name + ".tmp"), join(out, name)); }
  console.log("mac_activity_report " + JSON.stringify({ out: join(out, "latest.html"), runs: runs.length, newRaces: newRaces.length, changed: changed.length, direct: direct.size, removed: removed.length, held: held.group_held }));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
