import { createServerSupabase } from "@/lib/supabase/server";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { distanceKm, isGarbagePlace } from "@/lib/dedup";
import { mergeEventPair, mergeKeeper, type MergeDuplicateRow } from "@/lib/catalog/merge-duplicates";
import { askJson, addUsage, NO_USAGE, SONNET, type LlmUsage } from "@/lib/llm/anthropic";

const PAGE = 1000;
const BATCH = 15;
const SURE = 0.9;

type Row = MergeDuplicateRow & { age_categories: string[] | null };

const SELECT =
  "id, name, start_date, end_date, website_url, registration_url, series_id, fingerprint, disciplines, age_categories, location:locations(lat, lng, name, municipality, country_code), series:series!events_series_id_fkey(name), sources:event_sources(id, watched_url_id, external_id, source_url)";

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

const SYSTEM =
  "You de-duplicate a catalogue of cycling races collected from many calendars. For each numbered pair, decide whether A and B are the SAME event (one race listed twice: by two sources, in two languages, once by its own name and once as a series round, with or without the venue) or DIFFERENT events (even at one venue on one day: a kids' race beside the main race, an e-bike or hobby heat, a different discipline, a ride next to a race, two rounds of different cups, a festival vs one race within it when both are listed on purpose). " +
  "For riders the catalogue lists events, not every start: an event and a race or distance within it (a festival and its enduro race, a gravel weekend and its 100 km ride, a series round listed by its own name and as the round) at the same venue on overlapping days are the SAME event. " +
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
    const { data } = await supabase.from("duplicate_reviews").select("left_id, right_id").range(from, from + PAGE - 1);
    for (const r of data ?? []) known.add(`${r.left_id}|${r.right_id}`);
    if (!data || data.length < PAGE) break;
  }
  const pairs = candidatePairs(rows, known).slice(0, opts?.maxPairs ?? 400);
  const result: DuplicateJudgeResult = { pairs: pairs.length, same: 0, merged: 0, different: 0, unsure: 0, failed: 0, usage: NO_USAGE };
  const gone = new Set<string>();

  for (let i = 0; i < pairs.length; i += BATCH) {
    const batch = pairs.slice(i, i + BATCH);
    const user = batch.map(([a, b], k) => `${k + 1}.\nA: ${describe(a)}\nB: ${describe(b)}`).join("\n\n");
    let verdicts: { n?: number; verdict?: string; confidence?: number; reason?: string }[] = [];
    try {
      const { json, usage } = await askJson<{ pairs?: typeof verdicts }>({ system: SYSTEM, user, maxTokens: 3000, model: SONNET });
      result.usage = addUsage(result.usage, usage);
      verdicts = json?.pairs ?? [];
    } catch (e) {
      result.failed += batch.length;
      opts?.log?.(`FAIL batch: ${e instanceof Error ? e.message : e}`);
      if (e instanceof Error && e.name === "LlmUnavailable") break;
      continue;
    }
    for (const v of verdicts) {
      const pair = typeof v.n === "number" ? batch[v.n - 1] : undefined;
      if (!pair) continue;
      const [a, b] = pair;
      const conf = typeof v.confidence === "number" ? v.confidence : 0;
      const line = `${a.start_date}  "${a.name}"  ⟷  "${b.name}"  (${v.reason ?? ""}, ${conf})`;
      const da = a.disciplines ?? [], db = b.disciplines ?? [];
      const disjoint = da.length > 0 && db.length > 0 && !da.some((d) => db.includes(d)) && !(["mtb", "xco", "xcm", "xcc", "enduro", "dh"].some((d) => da.includes(d)) && ["mtb", "xco", "xcm", "xcc", "enduro", "dh"].some((d) => db.includes(d)));
      if (v.verdict === "same" && conf >= SURE && disjoint) {
        result.unsure += 1;
        opts?.log?.(`UNSURE  ${line}  — disciplines differ (${da.join(",")} / ${db.join(",")})`);
      } else if (v.verdict === "same" && conf >= SURE) {
        result.same += 1;
        if (gone.has(a.id) || gone.has(b.id)) continue;
        const keep = mergeKeeper(a, b);
        const drop = keep.id === a.id ? b : a;
        opts?.log?.(`${opts?.dryRun ? "DRY" : "MERGE"}  ${line}  → keep "${keep.name}"`);
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
        if (opts?.dryRun) continue;
        await supabase
          .from("duplicate_reviews")
          .upsert({ left_id: a.id, right_id: b.id, verdict: "separate", note: `model: ${(v.reason ?? "").slice(0, 200)}` }, { onConflict: "left_id,right_id" });
      } else {
        result.unsure += 1;
        opts?.log?.(`UNSURE  ${line}`);
      }
    }
  }
  return result;
}
