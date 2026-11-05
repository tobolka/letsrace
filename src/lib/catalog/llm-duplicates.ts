import { createServerSupabase } from "@/lib/supabase/server";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { DEDUP_THRESHOLD, distanceKm, isGarbagePlace, scoreDuplicate, hasIdentityConflict, placesNearby, sharesDisciplineFamily } from "@/lib/dedup";
import { isSeparateRace, mergeEventPair, mergeKeeper, asDedup, type MergeDuplicateRow } from "@/lib/catalog/merge-duplicates";
import { canonicalizeDisciplines, disciplineFamily } from "@/lib/taxonomy";
import { askJson, LlmUnavailable, LlmResponseError, addUsage, NO_USAGE, SONNET, type LlmUsage } from "@/lib/llm/anthropic";
import { cachedExtraction } from "@/lib/llm/extraction-cache";
import { readDocument } from "@/lib/catalog/regulation-ages";

const PAGE = 1000;
const BATCH = 15;
const SURE = 0.9;

type Row = MergeDuplicateRow & { age_categories: string[] | null; created_at?: string | null };

const SELECT =
  "id, created_at, name, start_date, end_date, website_url, registration_url, series_id, fingerprint, disciplines, age_categories, location:locations(lat, lng, name, municipality, country_code), series:series!events_series_id_fkey(name), sources:event_sources(id, watched_url_id, external_id, source_url), overrides:event_overrides(locked_fields)";

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const STOP = new Set(["race", "rennen", "zavod", "cup", "pohar", "serie", "series", "the", "and", "und", "del", "della", "di", "der", "die", "das", "mtb", "cross", "gravel", "road", "2026", "2027", "edition", "trophy", "trofeo", "memorial", "grand", "prix", "gran", "premio"]);
const words = (s: string) => new Set(fold(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w)));

function days(r: Row): [number, number] {
  const a = Date.parse(`${r.start_date}T12:00:00Z`);
  const b = Date.parse(`${r.end_date ?? r.start_date}T12:00:00Z`);
  return [a, b];
}

/**
 * Pairs worth asking about: their days touch (a day apart at most) and
 * something ties them — near each other, a place we cannot trust, the same
 * series, or a distinctive word in common. Cheap and generous on purpose:
 * the model is the judge, this only keeps it from reading every pair.
 */
export function candidatePairs(rows: Row[], known: Set<string>): [Row, Row][] {
  const sorted = [...rows].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const out: [Row, Row][] = [];
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]!;
    const [as, ae] = days(a);
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j]!;
      const [bs, be] = days(b);
      if (bs > ae + 86_400_000) break;
      if (be < as - 86_400_000) continue;
      const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
      if (known.has(key)) continue;
      if (hasIdentityConflict(scoreDuplicate(asDedup(a), asDedup(b)).reasons)) continue;
      const la = a.location, lb = b.location;
      const near =
        la?.lat != null && la?.lng != null && lb?.lat != null && lb?.lng != null
          ? distanceKm({ lat: la.lat, lng: la.lng }, { lat: lb.lat, lng: lb.lng }) <= 40
          : false;
      const vague = isGarbagePlace(la?.municipality) || isGarbagePlace(lb?.municipality) || la?.lat == null || lb?.lat == null;
      const sameSeries = Boolean(a.series_id && a.series_id === b.series_id);
      const wa = words(a.name), wb = words(b.name);
      const shared = [...wa].some((w) => wb.has(w));
      if (near || (vague && shared) || (sameSeries && (near || vague)) ) out.push(a.id < b.id ? [a, b] : [b, a]);
    }
  }
  return out;
}

function describe(r: Row): string {
  const place = [r.location?.municipality || r.location?.name, r.location?.country_code].filter(Boolean).join(", ");
  const src = ((r.sources ?? []) as { source_url?: string | null }[]).map((s) => s.source_url).filter(Boolean).slice(0, 2).join(" ");
  return [
    `"${r.name}"`,
    `${r.start_date}${r.end_date && r.end_date !== r.start_date ? `..${r.end_date}` : ""}`,
    place || "place unknown",
    (r.disciplines ?? []).join("/") || "?",
    r.series?.name ? `series: ${r.series.name}` : "",
    (r.age_categories ?? []).length ? `classes: ${(r.age_categories ?? []).join(",")}` : "",
    r.website_url ? `web: ${r.website_url}` : "",
    src ? `listed at: ${src}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

/**
 * A race's own pages: its site and the pages it was listed on — only those no
 * other race in the catalogue shares. A series' calendar or a federation's
 * list names every race on it, so it proves nothing about any two of them.
 */
/** Two titles that are the same words, give or take numbers, years and punctuation. */
export function sameTitle(a: string, b: string): boolean {
  const toks = (x: string) => new Set(fold(x).replace(/\b(19|20)\d{2}\b/g, " ").split(/[^a-z]+/).filter((w) => w.length >= 3));
  // Round, distance and class numbers carry identity. Do not erase them with years.
  const numbers = (x: string) => fold(x).replace(/\b(19|20)\d{2}\b/g, " ").match(/\d+/g) ?? [];
  if (JSON.stringify([...new Set(numbers(a))].sort()) !== JSON.stringify([...new Set(numbers(b))].sort())) return false;
  const ta = toks(a), tb = toks(b);
  if (!ta.size || !tb.size) return false;
  const common = [...ta].filter((w) => tb.has(w)).length;
  return common / Math.max(ta.size, tb.size) >= 0.85;
}

export function pagesOf(r: Row, shared?: Map<string, number>): string[] {
  const urls = [r.website_url, ...((r.sources ?? []) as { source_url?: string | null }[]).map((x) => x.source_url)].filter(
    (u): u is string => Boolean(u) && !/#/.test(u!) && (!shared || (shared.get(u!) ?? 0) <= 1),
  );
  return [...new Set(urls)].slice(0, 3);
}

type Evidence = { how: string; url: string; text: string };

const EVIDENCE_SYSTEM =
  "Two listings of cycling races share a date and a place. You get text from each one's own pages. Decide from that text only whether A and B are ONE race listed twice. " +
  "Answer same only when a page states it: that this race IS the other one — e.g. A's page says A is the round of B's series held here ('5. závod seriálu …'), or names B as this race's other name, or the organiser a series round's page names is the other listing's own name for that day (a round run by club LKS Bryksjusz and a race called Puchar Bryksjusza), or both pages give the same entry form for the same race. " +
  "A page that merely mentions both, a programme of several races on one day, a festival with several races, a kids' race beside the main race, or the same organiser running two races is NOT same. " +
  'Quote the exact sentence that proves it, copied from the page text. JSON only: {"verdict":"same|different|unknown","quote":"…","from":"A|B"}';

/** The model reads both pages; its "same" counts only with a quote that is really there. */
export async function modelEvidence(a: Row, b: Row, docs: Map<string, string>, shared: Map<string, number>): Promise<{ ev: Evidence | null; usage: LlmUsage }> {
  // Where a page talks about these races: around this day's date and the
  // names' words — a page's first lines are its menu.
  const [y, mo, d] = a.start_date.split("-").map(Number) as [number, number, number];
  const terms = [
    `${d}.${mo}.`, `${d}. ${mo}.`, `${String(d).padStart(2, "0")}.${String(mo).padStart(2, "0")}.`, `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    ...[...words(a.name), ...words(b.name)].filter((w) => w.length >= 5).map((w) => w.slice(0, 5)),
  ];
  const windows = (text: string) => {
    const flat = text.replace(/\s+/g, " ");
    const f = fold(flat);
    const spans: [number, number][] = [];
    for (const t of terms) {
      let i = f.indexOf(fold(t));
      for (let k = 0; i >= 0 && k < 3; k++, i = f.indexOf(fold(t), i + 1)) spans.push([Math.max(0, i - 400), i + 600]);
    }
    if (!spans.length) return flat.slice(0, 1500);
    spans.sort((p, q) => p[0] - q[0]);
    const merged: [number, number][] = [];
    for (const sp of spans) {
      const last = merged[merged.length - 1];
      if (last && sp[0] <= last[1]) last[1] = Math.max(last[1], sp[1]);
      else merged.push([...sp]);
    }
    return merged.map(([p, q]) => flat.slice(p, q)).join(" … ").slice(0, 3500);
  };
  const pageText = (r: Row) =>
    pagesOf(r, shared)
      .map((u) => (docs.get(u) ? `--- ${u}\n${windows(docs.get(u)!)}` : ""))
      .filter(Boolean)
      .join("\n");
  const ta = pageText(a), tb = pageText(b);
  if (!ta && !tb) return { ev: null, usage: NO_USAGE };
  const request = { system: EVIDENCE_SYSTEM, user: `A: ${describe(a)}\n${ta || "(no page text)"}\n\nB: ${describe(b)}\n${tb || "(no page text)"}`, model: SONNET, maxTokens: 700 };
  const { value: json, usage } = await cachedExtraction(request, async () => {
    const { json, usage } = await askJson<{ verdict?: string; quote?: string; from?: string }>(request);
    return { value: json, usage };
  });
  const quote = (json?.quote ?? "").trim();
  if (process.env.LLM_DEBUG) console.log("  evidence model:", JSON.stringify(json));
  if (json?.verdict !== "same" || quote.length < 15) return { ev: null, usage };
  // Letters and digits only: a quote copied across a line break or around a
  // quotation mark is still the page's words.
  const norm = (x: string) => fold(x).replace(/[^a-z0-9]+/g, "");
  const src = json.from === "B" ? b : a;
  const url = pagesOf(src, shared).find((u) => docs.get(u) && norm(docs.get(u)!).includes(norm(quote)));
  return { ev: url ? { how: "model, quoted", url, text: quote } : null, usage };
}

const coreTokens = (name: string) => fold(name)
  .replace(/\b(?:rr|rm|tt|itt)\s+\d+(?:[.,]\d+)?\s*km\b/g, " ")
  .replace(/\b\d+(?:[.,]\d+)?\s*km\b/g, " ")
  .replace(/\b20\d{2}\b/g, " ")
  .split(/[^a-z0-9]+/)
  .filter(Boolean);
const siteOf = (url: string | null | undefined) => {
  try { return new URL(url ?? "").hostname.replace(/^www\./, ""); } catch { return ""; }
};

/**
 * Most duplicates come from a calendar and the organiser, and no page says the two are one race.
 * The model's opinion counts here only with an independent signal in the names themselves.
 */
export function namesSupportMerge(a: Pick<Row, "name" | "website_url">, b: Pick<Row, "name" | "website_url">, confidence: number): boolean {
  const distance = (name: string) => fold(name).match(/\d+(?:[.,]\d+)?\s*km\b/)?.[0]?.replace(/\s/g, "");
  const da = distance(a.name), db = distance(b.name);
  if (da && db && da !== db) return false;
  const left = coreTokens(a.name), right = coreTokens(b.name);
  if (!left.length || !right.length || isSeparateRace(left.join(" "), right.join(" "))) return false;
  if (left.join(" ") === right.join(" ")) return confidence >= 0.7;
  const [short, long] = left.length <= right.length ? [left, right] : [right, left];
  const site = siteOf(a.website_url);
  return short.length >= 2 && short.every(token => long.includes(token)) && Boolean(site) && site === siteOf(b.website_url) && confidence >= 0.85;
}

/** Name-based evidence is enough only when the other recorded facts also agree. */
export function recordsSupportNameMerge(a: MergeDuplicateRow, b: MergeDuplicateRow, confidence: number): boolean {
  if (!namesSupportMerge(a, b, confidence) || a.start_date !== b.start_date ||
    (a.end_date ?? a.start_date) !== (b.end_date ?? b.start_date)) return false;
  const left = asDedup(a), right = asDedup(b);
  if (!left.countryCode || left.countryCode !== right.countryCode ||
    !sharesDisciplineFamily(left.disciplines, right.disciplines)) return false;
  // A shared organiser's host and a model's confidence cannot substitute for a venue.
  if (!placesNearby(left, right, 15)) return false;
  const { score, reasons } = scoreDuplicate({ ...left, urls: [], fingerprint: undefined }, { ...right, urls: [], fingerprint: undefined });
  return score >= DEDUP_THRESHOLD && !hasIdentityConflict(reasons) && !reasons.includes("series_conflict");
}

const SYSTEM =
  "You de-duplicate a catalogue of cycling races collected from many calendars. For each numbered pair, decide whether A and B are the SAME event (one race listed twice: by two sources, in two languages, once by its own name and once as a series round, with or without the venue) or DIFFERENT events (even at one venue on one day: a kids' race beside the main race, an e-bike or hobby heat, a different discipline, a ride next to a race, two rounds of different cups, a festival vs one race within it). " +
  "Two distances or age starts within the SAME race can be one event; a festival and one race within it are not interchangeable. A series round listed twice under its own name and the series name can be the SAME event, with source evidence. " +
  "They are DIFFERENT when they are separate events that merely share a venue or a weekend: two different organisers, two different series, a kids' cup round on another day, or a different discipline (road race vs. MTB). " +
  "Different towns are different events unless one record clearly has a wrong or vague place. Do not reason your way to 'same' from a shared series or venue alone. " +
  'Answer JSON only: {"pairs":[{"n":1,"verdict":"same|different|unsure","confidence":0.0-1.0,"reason":"short"}]}. Use "unsure" when the records do not let you tell.';

export type DuplicateJudgeResult = {
  pairs: number;
  same: number;
  merged: number;
  different: number;
  unsure: number;
  failed: number;
  deferred: number;
  stopped: boolean;
  usage: LlmUsage;
};

/**
 * Duplicates judged by a language model instead of a rule per case.
 *
 * Merges what it is sure is one race, files what it is sure are two races so
 * neither it nor a person is asked again, and leaves the rest for /admin.
 */
export async function judgeDuplicates(opts?: {
  maxPairs?: number;
  dryRun?: boolean;
  /** Only pairs with a race created this recently: cheap enough for every cycle. */
  newerThanHours?: number;
  log?: (line: string) => void;
}): Promise<DuplicateJudgeResult> {
  const supabase = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("events")
      .select(SELECT)
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", today)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < PAGE) break;
  }
  const known = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from("duplicate_reviews").select("left_id, right_id").order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`Reading duplicate reviews: ${error.message}`);
    for (const r of data ?? []) known.add(`${r.left_id}|${r.right_id}`);
    if (!data || data.length < PAGE) break;
  }
  const recentFrom = opts?.newerThanHours ? Date.now() - opts.newerThanHours * 3_600_000 : null;
  const isRecent = (row: Row) => recentFrom == null || Date.parse(row.created_at ?? "") >= recentFrom;
  const pairs = candidatePairs(rows, known).filter(([a, b]) => isRecent(a) || isRecent(b)).slice(0, opts?.maxPairs ?? 400);
  // How many races each page belongs to: a page shared by several proves nothing.
  const shared = new Map<string, number>();
  for (const r of rows) {
    const urls = new Set([r.website_url, ...((r.sources ?? []) as { source_url?: string | null }[]).map((x) => x.source_url)].filter((u): u is string => Boolean(u)));
    for (const u of urls) shared.set(u, (shared.get(u) ?? 0) + 1);
  }
  // "cx" and "cyclocross" are one discipline under two spellings.
  const fam = (ds: string[] | null | undefined) => new Set(canonicalizeDisciplines(ds ?? []).map((d) => disciplineFamily(d)));
  const result: DuplicateJudgeResult = { pairs: pairs.length, same: 0, merged: 0, different: 0, unsure: 0, failed: 0, deferred: 0, stopped: false, usage: NO_USAGE };
  const gone = new Set<string>();

  for (let i = 0; i < pairs.length; i += BATCH) {
    const batch = pairs.slice(i, i + BATCH);
    const user = batch.map(([a, b], k) => `${k + 1}.\nA: ${describe(a)}\nB: ${describe(b)}`).join("\n\n");
    let verdicts: { n?: number; verdict?: string; confidence?: number; reason?: string }[] = [];
    try {
      const request = { system: SYSTEM, user, maxTokens: 3000, model: SONNET };
      const { value: json, usage } = await cachedExtraction(request, async () => {
        const { json, usage } = await askJson<{ pairs?: typeof verdicts }>(request);
        return { value: json, usage };
      });
      result.usage = addUsage(result.usage, usage);
      verdicts = json?.pairs ?? [];
    } catch (e) {
      if (e instanceof LlmResponseError) result.usage = addUsage(result.usage, e.usage);
      if (e instanceof LlmUnavailable) {
        result.stopped = true;
        result.deferred = pairs.length - i;
        opts?.log?.(`STOP: ${e.message}; ${result.deferred} pairs remain unreviewed`);
        break;
      }
      result.failed += batch.length;
      opts?.log?.(`FAIL batch: ${e instanceof Error ? e.message : e}`);
      continue;
    }
    for (const v of verdicts) {
      const pair = typeof v.n === "number" ? batch[v.n - 1] : undefined;
      if (!pair) continue;
      const [a, b] = pair;
      const conf = typeof v.confidence === "number" ? v.confidence : 0;
      const line = `${a.start_date}  "${a.name}"  ⟷  "${b.name}"  (${v.reason ?? ""}, ${conf})`;
      const da = a.disciplines ?? [], db = b.disciplines ?? [];
      const fa = fam(da), fb = fam(db);
      const disjoint = fa.size > 0 && fb.size > 0 && ![...fa].some((f) => fb.has(f));
      if (v.verdict === "same" && disjoint) {
        result.unsure += 1;
        opts?.log?.(`UNSURE  ${line}  — disciplines differ (${da.join(",")} / ${db.join(",")})`);
      } else if (v.verdict === "unsure" || (v.verdict === "different" && conf < SURE)) {
        // A page quote cannot overrule a model that does not call them one race.
        result.unsure += 1;
        opts?.log?.(`UNSURE  ${line}  — not called one race`);
      } else if (v.verdict === "same") {
        // Names and places only make a pair worth checking; the pages decide —
        // unless the two titles are the same words (one race typed twice).
        if (gone.has(a.id) || gone.has(b.id)) continue;
        const docs = new Map<string, string>();
        for (const url of [...pagesOf(a, shared), ...pagesOf(b, shared)]) {
          if (docs.has(url)) continue;
          const doc = await readDocument(url).catch(() => null);
          if (doc?.text) docs.set(url, doc.text);
        }
        let ev: Evidence | null = null;
        if (!ev) {
          const m = await modelEvidence(a, b, docs, shared).catch(error => ({ ev: null, usage: error instanceof LlmResponseError ? error.usage : NO_USAGE }));
          result.usage = addUsage(result.usage, m.usage);
          ev = m.ev;
        }
        if (!ev && recordsSupportNameMerge(a, b, conf)) ev = { how: "model and matching name, date, venue and discipline", url: a.website_url ?? b.website_url ?? "", text: `${a.name} = ${b.name}` };
        if (!ev) {
          result.unsure += 1;
          opts?.log?.(`UNSURE  ${line}  — no page says they are one race`);
          continue;
        }
        result.same += 1;
        const keep = mergeKeeper(a, b);
        const drop = keep.id === a.id ? b : a;
        opts?.log?.(`${opts?.dryRun ? "DRY" : "MERGE"}  ${line}  → keep "${keep.name}"\n        evidence (${ev.how}): ${ev.url}\n        „${ev.text.slice(0, 220)}“`);
        if (opts?.dryRun) continue;
        try {
          await mergeEventPair(keep.id, drop.id);
          gone.add(drop.id);
          result.merged += 1;
        } catch (e) {
          result.failed += 1;
          opts?.log?.(`  merge failed: ${e instanceof Error ? e.message : e}`);
        }
      } else if (v.verdict === "different" && conf >= SURE) {
        result.different += 1;
        // Model confidence is not a permanent negative identity review.
        // Later source corrections must be able to bring this pair back.
      }
    }
  }
  return result;
}
