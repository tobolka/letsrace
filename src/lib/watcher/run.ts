import { randomUUID } from "node:crypto";
import type { NewRaceLocationPlan, WatcherSeriesPlan } from "@/lib/watcher/write-event";
import { overviewIssues, isCountryOnlyPlace } from "@/lib/catalog/overview-quality";
import { isWholeCalendarHost } from "@/lib/watcher/extractors/adapters";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  fingerprint,
  fingerprintVariants,
  normalizeName,
  type ParsedEvent,
} from "@/lib/domain";
import {
  extractEvents,
  withoutLastYearsTable,
  canReconcileMissingEvents,
  watchReaderVersion,
  fetchPage,
  nextPollAt,
  errorPollAt,
  reviewPollAt,
  sourcePollAt,
  isPendingSeasonUrl,
  seasonGuessLanded,
  comingDatesOnPage,
  SILENT_CALENDAR_DATES,
} from "@/lib/watcher/core";
import { belongsToThisWorker, hostnameOf, mapPool } from "@/lib/watcher/pool";
import { looksLikeIndependentRaceUrl, queueDiscoveredLink } from "@/lib/watcher/explore";
import { looksLikeTextFragment } from "@/lib/text";
import { dedupeCommaParts, isGarbagePlace } from "@/lib/dedup";
import { freeEventSlug } from "@/lib/event-slug";
import { mergeStatedAges } from "@/lib/catalog/merge-category-evidence";
import { chooseEventType, isDayOfStoredRace, isDifferentDatedRace, isSameCalendarOtherRace, isSamePlace, preserveUnstatedDisciplines, protectOfficialFields, protectSpecificFacts, type PlaceFacts } from "@/lib/watcher/update-policy";
import { calendarRowHash, calendarRowProgress, isEventWriteConflict, MAX_CALENDAR_PROGRESS_ROWS, readCalendarProgress } from "@/lib/watcher/calendar-progress";
import { isBudgetDeferral } from "@/lib/watcher/run-summary";
import { withDatabaseDeadline, withDatabaseRequestCounts, withDatabaseWorkload } from "@/lib/supabase/request-budget";
import { countryFromVenue } from "@/lib/geo/country-label";
import { isArchiveDiscoveryUrl, isAuxiliaryDiscoveryUrl } from "@/lib/watcher/discovery-policy";
import type { Insert, Update } from "@/lib/supabase/tables";
import type { Json } from "@/lib/supabase/database.types";
import type { ReviewDecision, ReviewRow } from "@/lib/discovery/review";

export type WatchOutcome = {
  watchedUrlId: string;
  url: string;
  ok: boolean;
  unchanged?: boolean;
  eventsUpserted: number;
  /** Rows the extractor read, before the per-run write caps. */
  eventsExtracted?: number;
  eventsCreated?: number;
  eventsUpdated?: number;
  eventsRejected?: number;
  eventsFailed?: number;
  eventsDeferred?: number;
  extractionComplete?: boolean;
  issues?: string[];
  usage?: import("@/lib/llm/anthropic").LlmUsage;
  linksDiscovered: number;
  droppedHidden?: number;
  strategy?: string;
  error?: string;
  httpStatus?: number;
  preview?: ParsedEvent[];
};

const MAX_NEW_PER_RUN = 200;
const MAX_NEW_PER_RUN_FCI = 400;
const MAX_NEW_PER_RUN_RR = 400;
/** radsport-events serves its whole calendar in one API crawl — 640 races. */
const MAX_NEW_PER_RUN_RSE = 700;
const MAX_REFRESH_PER_RUN = 250;
/** Stay under Fluid Compute's 300s cap with room for geocode. */
const DEFAULT_BUDGET_MS = 260_000;
const DEFAULT_CONCURRENCY = 10;
const CALENDAR_KINDS = ["series", "federation", "aggregator", "calendar"] as const;
/** The Mac has no platform time limit, so what it has already read is never thrown away for lack of time. */
const MAC_WRITE_ALLOWANCE_MS = 90_000;

/**
 * Pages of one site wait their turn inside a shared time budget. On 5 Nov 2026 a Cycling Austria page
 * was often read with seconds left, saved none of its 30 rows and was read again later, up to eight
 * times, though saving takes under half a minute when it has the time.
 */
export function writeDeadlineFor(deadline: number, now: number, onMac: boolean): number {
  return onMac ? Math.max(deadline, now + MAC_WRITE_ALLOWANCE_MS) : deadline;
}

export async function runDueWatches(
  limit = 120,
  opts?: { concurrency?: number; budgetMs?: number },
): Promise<WatchOutcome[]> {
  const supabase = createServerSupabase();
  const nowIso = new Date().toISOString();

  // A terminated serverless invocation cannot reach watchOne's catch block.
  // Its source claim expires, but the ingest_runs row otherwise says "running"
  // forever. A normal watch is bounded to five minutes; thirty minutes is well
  // beyond both that budget and the local browser-rendered federation scan.
  const abandonedBefore = new Date(Date.now() - 30 * 60_000).toISOString();
  const { error: abandonedError } = await supabase.from("ingest_runs")
    .update({ finished_at: nowIso, ok: false, error: "Abandoned: scan did not finish within 30 minutes", metrics: { timing: "unknown", abandoned: true } })
    .is("finished_at", null)
    .lt("started_at", abandonedBefore);
  if (abandonedError) console.error("Could not close abandoned ingest runs", abandonedError);

  const selectedByHost = new Map<string, number>();
  const selectedIds = new Set<string>();

  async function claimDue(kinds: readonly string[], take: number) {
    if (take <= 0) return [];
    const { data: due, error } = await supabase
      .from("watched_urls")
      .select("*")
      .eq("status", "active")
      .in("kind", [...kinds])
      .lte("next_poll_at", nowIso)
      .order("next_poll_at", { ascending: true })
      // A worker sees only its own hosts, so it has to look further down the queue.
      .limit(process.env.LOCAL_WORKER_SHARD ? 5000 : Math.max(take * 3, 40));
    if (error) throw new Error(error.message);
    // Helper pages are never read, so they would stay "due" for ever and look like work left.
    const neverRead = (due ?? []).filter((row) => row.added_by === "auto-same-domain" && isAuxiliaryDiscoveryUrl(row.url as string));
    if (neverRead.length) {
      const { error: postponeError } = await supabase.from("watched_urls")
        .update({ next_poll_at: new Date(Date.now() + 90 * 24 * 3_600_000).toISOString() })
        .in("id", neverRead.map((row) => row.id));
      if (postponeError) console.error("Could not postpone helper pages", postponeError);
    }
    const dumpHost = /federciclismo\.it|eventivsport\.com|ffc\.fr|ffvelo\.fr/i;
    // The ČSC Blazor grid is rendered by a local Chrome scan. Vercel cannot
    // render it; claiming it here only overwrites a successful local scan with
    // a known error and makes the health signal misleading.
    const eligible = (due ?? []).filter((row) =>
      !(process.env.VERCEL && /portal\.czechcyclingfederation\.com\/Races(?:\/|$)/i.test(row.url as string)) &&
      !(row.added_by === "auto-same-domain" && isAuxiliaryDiscoveryUrl(row.url)) &&
      belongsToThisWorker(hostnameOf(row.url))
    );
    const rest = eligible.filter((row) => !dumpHost.test(row.url as string));
    const dumps = eligible.filter((row) => dumpHost.test(row.url as string)).slice(0, 2);
    // A host with many detail URLs must not consume every slot in a batch.
    // Use the same normalized host as the request gate, including www aliases.
    const claimed: NonNullable<typeof due> = [];
    for (const row of [...rest, ...dumps]) {
      if (claimed.length >= take) break;
      if (selectedIds.has(row.id)) continue;
      const host = hostnameOf(row.url);
      const selected = selectedByHost.get(host) ?? 0;
      // On the Mac a worker owns its sites, and the request gate already spaces their calls.
      if (selected >= (process.env.LOCAL_WORKER_SHARD ? 12 : 2)) continue;
      claimed.push(row);
      selectedIds.add(row.id);
      selectedByHost.set(host, selected + 1);
    }
    return claimed;
  }

  // Calendars first — one series page is worth dozens of race pages.
  //
  // `outbound` belongs with `race`: it is the kind an accepted discovery gets,
  // one organiser's own site. It was in neither list, so fifteen sources the
  // admin had accepted — eight of them never fetched at all — sat active and
  // due and were never once claimed.
  // Broad calendars get most slots; detail/organiser pages must still make progress.
  const calendars = await claimDue(CALENDAR_KINDS, Math.max(1, Math.ceil(limit * 2 / 3)));
  const claimed = [
    ...calendars,
    ...(await claimDue(["race", "outbound"], limit - calendars.length)),
  ];
  if (claimed.length < limit) claimed.push(...await claimDue(CALENDAR_KINDS, limit - claimed.length));

  const deadline = Date.now() + (opts?.budgetMs ?? DEFAULT_BUDGET_MS);
  const concurrency = opts?.concurrency ?? DEFAULT_CONCURRENCY;
  const outcomes = await mapPool(claimed, concurrency, async (row) => {
    if (Date.now() > deadline) {
      return {
        watchedUrlId: row.id,
        url: row.url,
        ok: false,
        eventsUpserted: 0,
        linksDiscovered: 0,
        error: "time budget exceeded",
      } satisfies WatchOutcome;
    }
    return watchOne(row, { deadline, dueBefore: nowIso });
  });

  return outcomes;
}

type SourceReadInput = {
  id: string;
  url: string;
  etag?: string | null;
  last_modified?: string | null;
  content_hash?: string | null;
  kind?: string;
  last_extract_status?: string | null;
  calendar_write_progress?: Json;
  updated_at?: string;
};
export async function watchOne(row: SourceReadInput, opts?: { deadline?: number; dueBefore?: string }): Promise<WatchOutcome> {
  const { withSourceWork } = await import("@/lib/pipeline/source-work");
  return withDatabaseWorkload("watch", () => withDatabaseRequestCounts(counts =>
    withSourceWork(row, () => readClaimedSource(row, counts, opts), { dueBefore: opts?.dueBefore })
  ));
}
async function readClaimedSource(row: SourceReadInput, database: { attempts: number; failed: number }, opts?: { deadline?: number }): Promise<WatchOutcome> {
  const supabase = createServerSupabase();
  const runInsert = await supabase
    .from("ingest_runs")
    .insert({ watched_url_id: row.id })
    .select("id")
    .single();
  if (runInsert.error) throw new Error(`Starting ingest run: ${runInsert.error.message}`);

  const runId = runInsert.data?.id;
  if (!runId) throw Error("Source run was not recorded");
  const startedAt = performance.now();
  const createdIds = new Set<string>();
  const updatedIds = new Set<string>();
  let committedWrites = 0;
  let hidden = 0;
  let sourcePatch: Update<"watched_urls"> = {};
  const { stageSourceReceipt } = await import("@/lib/pipeline/source-work");
  function recordRun(result: {
    ok: boolean; error?: string; linksDiscovered?: number;
    strategy?: string; httpStatus?: number; metrics?: Record<string, Json | undefined>;
  }) {
    stageSourceReceipt({
      runId,
      patch: sourcePatch,
      runResult: {
        ok: result.ok,
        error: result.error ?? null,
        events_upserted: committedWrites,
        links_discovered: result.linksDiscovered ?? 0,
        strategy: result.strategy ?? null,
        http_status: result.httpStatus ?? null,
        metrics: {
          ...result.metrics,
          timing: "measured",
          elapsedMs: Math.round(performance.now() - startedAt),
          // Count through staging this receipt. The final commit happens outside the reader.
          database: { ...database },
          created: createdIds.size,
          updated: updatedIds.size,
          createdIds: [...createdIds],
          updatedIds: [...updatedIds],
          droppedHidden: hidden,
        },
      },
    });
  }

  try {
    // Sources whose adapter reads other pages than the one we watch (a JSON
    // API, the month and race pages behind a landing page): the watched page
    // staying the same says nothing, and odjazd.pl's home page stayed the same
    // while its races changed every day. Always fetched whole, never skipped.
    const FANS_OUT = /odjazd\.pl|rideandrest\.net|trevisomtb\.it|kalendarzrowerowy\.pl|radsport-events\.de|eventivsport\.com|fullgazrace\.de/i.test(row.url);
    const checkpointPrefix = `${watchReaderVersion(row.url)}:`;
    const progressVersion = `calendar-v1:${checkpointPrefix}${row.kind}:${row.url}`;
    const priorProgress = readCalendarProgress(row.calendar_write_progress, progressVersion);
    const hasPendingWrites = [...priorProgress.values()].some(entry => entry.conflicts > 0);
    const currentReader = row.content_hash?.startsWith(checkpointPrefix);
    const fetched = await fetchPage(
      row.url,
      FANS_OUT || hasPendingWrites || !currentReader || row.last_extract_status === "needs_review" || row.last_extract_status === "error" ? undefined : { etag: row.etag, lastModified: row.last_modified, contentHash: row.content_hash!.slice(checkpointPrefix.length) },
    );

    if (fetched.status === 404) {
      // Next-year calendars (`/zavody-2027/`) 404 until published — keep watching.
      if (isPendingSeasonUrl(row.url)) {
        sourcePatch = {
          status: "active",
          http_status: 404,
          last_fetched_at: new Date().toISOString(),
          last_error: null,
          last_extract_status: "off_season",
          next_poll_at: sourcePollAt([]).toISOString(),
        };
        recordRun({
          ok: true,
          error: "404 pending season",
          httpStatus: 404,
        });
        return {
          watchedUrlId: row.id,
          url: row.url,
          ok: true,
          eventsUpserted: 0,
          linksDiscovered: 0,
          strategy: "off_season",
          error: "404 pending season",
          httpStatus: 404,
        };
      }
      sourcePatch = {
        status: "dead",
        http_status: 404,
        last_fetched_at: new Date().toISOString(),
        last_error: "HTTP 404",
        last_extract_status: "dead",
        next_poll_at: nextPollAt().toISOString(),
      };
      recordRun({
        ok: false,
        error: "404",
        httpStatus: 404,
      });
      return {
        watchedUrlId: row.id,
        url: row.url,
        ok: false,
        eventsUpserted: 0,
        linksDiscovered: 0,
        error: "404",
        httpStatus: 404,
      };
    }

    if (fetched.unchanged || fetched.status === 304) {
      const { touchLastSeenForWatchedUrl } = await import("@/lib/catalog/freshness");
      await touchLastSeenForWatchedUrl(row.id);
      sourcePatch = {
        last_fetched_at: new Date().toISOString(),
        http_status: fetched.status,
        next_poll_at: nextPollAt().toISOString(),
        last_extract_status: "unchanged",
        last_error: null,
      };
      recordRun({ ok: true, httpStatus: fetched.status, metrics: { sourceContentUnchanged: true } });
      return {
        watchedUrlId: row.id,
        url: row.url,
        ok: true,
        unchanged: true,
        eventsUpserted: 0,
        linksDiscovered: 0,
        httpStatus: fetched.status,
      };
    }

    if (fetched.status >= 400) {
      throw new Error(`HTTP ${fetched.status}`);
    }

    const deadline = opts?.deadline ?? Date.now() + DEFAULT_BUDGET_MS;
    const read = await extractEvents(row.url, fetched.html, { deadline });
    const extracted = { ...read, events: withoutLastYearsTable(read.events) };
    // Paged: PostgREST caps a select at a thousand rows however many there are,
    // and the largest aggregator here has 1798. Unpaged, 798 races looked new
    // on every single run — they competed for the new-race budget for ever and
    // never counted as known.
    const knownRows: {
      external_id: string | null;
      event: { updated_at: string | null } | { updated_at: string | null }[] | null;
    }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await supabase
        .from("event_sources")
        .select("external_id, event:events(updated_at)")
        .eq("watched_url_id", row.id)
        .not("external_id", "is", null)
        // Ordered, or the ranges overlap and miss rows between them.
        .order("id", { ascending: true })
        .range(from, from + 999);
      if (error) throw new Error(`Reading known source identities: ${error.message}`);
      const rows = page ?? [];
      knownRows.push(...rows);
      if (rows.length < 1000) break;
    }
    /**
     * When each of these was last written, so the refresh sample below can
     * rotate instead of re-reading the same races every run.
     *
     * `updated_at` and not `last_seen_at`: an unchanged poll stamps last_seen
     * on every race of the source at once, which would flatten the order back
     * to a tie the moment the listing sat still for one cycle.
     */
    const writtenAtByExternalId = new Map<string, number>();
    for (const r of knownRows) {
      if (!r.external_id) continue;
      const ev = Array.isArray(r.event) ? r.event[0] : r.event;
      writtenAtByExternalId.set(r.external_id, Date.parse(ev?.updated_at ?? "") || 0);
    }
    const known = new Set(writtenAtByExternalId.keys());

    // A next-season URL that answers with another season's races is a wrong
    // guess, not a calendar. Ingesting it re-imports the current season under a
    // future address and buries the forward calendar in races already past.
    const seasonMismatch = !seasonGuessLanded(row.url, extracted.events);
    const candidates = seasonMismatch
      ? []
      : extracted.events.filter((ev) => ev.confidence >= 0.35);
    const maxNew =
      extracted.strategy?.includes("fci") || row.url.includes("federciclismo")
        ? MAX_NEW_PER_RUN_FCI
        : extracted.strategy?.includes("raceresult") || /raceresult\.com\/events/.test(row.url)
          ? MAX_NEW_PER_RUN_RR
          : /radsport-events\.de/.test(row.url)
            ? MAX_NEW_PER_RUN_RSE
            : MAX_NEW_PER_RUN;
    /**
     * Spend the per-run budget on races people can still enter.
     *
     * A season calendar lists chronologically, and the caps below take the first
     * N in that order — so on a page covering a whole year the past months ate
     * the allowance before the upcoming ones were reached. 69% of newly created
     * rows were races that had already happened, while the forward calendar
     * stayed thin. Sort upcoming first, nearest first; past races still get in,
     * they just stop going first.
     */
    const today = new Date().toISOString().slice(0, 10);
    const forwardFirst = (a: ParsedEvent, b: ParsedEvent) => {
      const aPast = a.startDate < today;
      const bPast = b.startDate < today;
      if (aPast !== bPast) return aPast ? 1 : -1;
      return aPast ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate);
    };
    /**
     * Read the entry deadline off the page we already have.
     *
     * Only for a page describing one race. On a calendar listing 150 races a
     * single "Přihlášky do…" belongs to one of them, and copying it onto all of
     * them would be the same bleed that put one club's propozice on 39
     * unrelated races.
     */
    if (candidates.length === 1) {
      const { parseRegistrationWindow, visibleText } = await import(
        "@/lib/watcher/registration-deadline"
      );
      const only = candidates[0]!;
      if (!only.registrationClosesAt) {
        const window = parseRegistrationWindow(visibleText(fetched.html), only.startDate);
        if (window.closesAt) only.registrationClosesAt = window.closesAt;
        if (window.opensAt) only.registrationOpensAt = window.opensAt;
      }
    }

    // Compare parsed rows, not just the landing page: an adapter can read
    // several documents behind an unchanged calendar homepage.
    const uniqueCandidates = dedupeByExternalId(candidates);
    const trackProgress = CALENDAR_KINDS.some(kind => kind === row.kind) &&
      extracted.complete !== false && extracted.strategy.startsWith("adapter:") && !extracted.strategy.includes("llm") &&
      uniqueCandidates.length <= MAX_CALENDAR_PROGRESS_ROWS;
    const now = Date.now();
    const progress = new Map<string, ReturnType<typeof calendarRowProgress>>();
    const rowHashes = new Map<string, string>();
    const writableCandidates = trackProgress ? uniqueCandidates.filter(ev => {
      if (!ev.externalId) return true;
      const hash = calendarRowHash(ev);
      rowHashes.set(ev.externalId, hash);
      const previous = priorProgress.get(ev.externalId);
      if (previous?.hash !== hash) return true;
      progress.set(ev.externalId, previous);
      return previous.until <= now || (!previous.conflicts && !known.has(ev.externalId));
    }) : candidates;
    const newCandidates = writableCandidates.filter(ev => !ev.externalId || !known.has(ev.externalId));
    const fresh = newCandidates.sort(forwardFirst).slice(0, maxNew);
    const writeBacklog = newCandidates.length > fresh.length ||
      (trackProgress && writableCandidates.length - newCandidates.length > MAX_REFRESH_PER_RUN);
    /**
     * When the page changed, refresh a sample of known races so updates land.
     *
     * The sample used to be the nearest 250 by date, which on a calendar of 623
     * is the same 250 every run: a race in April was written once and never
     * looked at again, and a field added to the extractor reached less than half
     * the catalogue however many times the source was polled. Stalest first
     * rotates through the whole list instead — a race just refreshed goes to the
     * back of the queue by definition.
     */
    const refresh = writableCandidates
      .filter((ev) => ev.externalId && known.has(ev.externalId))
      .sort((a, b) => {
        const written =
          (writtenAtByExternalId.get(a.externalId!) ?? 0) -
          (writtenAtByExternalId.get(b.externalId!) ?? 0);
        return written !== 0 ? written : forwardFirst(a, b);
      })
      .slice(0, MAX_REFRESH_PER_RUN);
    const toUpsert = dedupeByExternalId([...fresh, ...refresh]);

    let upserted = 0;
    // Bounded parallelism for DB upserts (same-host sources stay polite upstream)
    const writeFailures: { externalId: string; error: string }[] = [];
    const writeDeadline = writeDeadlineFor(deadline, Date.now(), Boolean(process.env.LOCAL_WORKER_SHARD));
    const upsertResults = await mapPool(toUpsert, 4, async ev => {
      try {
        if (Date.now() > writeDeadline - 5000) throw new Error("write_time_budget_exhausted");
        const result = await withDatabaseDeadline(writeDeadline - 5000, () => upsertParsedEvent(ev, row.id, row.kind, row.url));
        const hash = rowHashes.get(ev.externalId);
        if (result) {
          committedWrites++;
          if (result.created) createdIds.add(result.id);
          else if (result.changed) updatedIds.add(result.id);
        }
        if (hash && result) progress.set(ev.externalId, calendarRowProgress(hash, now, 0));
        else progress.delete(ev.externalId);
        return result;
      }
      catch (error) {
        let message = error instanceof Error ? error.message : String(error);
        if (process.env.PIPELINE_REVIEW_QUEUE === "1" && /identity_review_required|pipeline_data_review_required/.test(message)) {
          try {
            const { saveCandidate } = await import("@/lib/discovery/review");
            const saved = await saveCandidate(supabase, ev, { sourceUrl: row.url, documentHash: fetched.hash, watchedUrlId: row.id, reason: message });
            // Already ruled out by a reviewer: not a fault of this source, so it
            // must not keep the whole source flagged on every poll.
            if (saved.rejected) return null;
          } catch (queueError) { message += `; review_queue_failed:${queueError instanceof Error ? queueError.message : String(queueError)}`; }
        }
        const hash = rowHashes.get(ev.externalId);
        if (hash && isEventWriteConflict(message)) {
          progress.set(ev.externalId, calendarRowProgress(hash, now, (progress.get(ev.externalId)?.conflicts ?? 0) + 1));
        } else progress.delete(ev.externalId);
        writeFailures.push({ externalId: ev.externalId, error: message });
        return null;
      }
    });
    upserted = upsertResults.filter(Boolean).length;

    let linksDiscovered = 0;
    for (const child of extracted.childUrls) {
      try {
        if (isArchiveDiscoveryUrl(child) || isAuxiliaryDiscoveryUrl(child)) continue;
        if (
          /mtbkalender\.dk|kidsmtbcup\.dk|dgi\.dk|kenniscentrum\.knwu\.nl|mijn\.knwu\.nl|velo\.ffc\.fr|competitions\.ffc\.fr|rfec\.com|orobiecup\.it|mtbsport\.it|jiskra\.potocky\.cz|potocky\.cz/i.test(
            child,
          )
        ) {
          continue;
        }
        // One page of these is the whole calendar; its links are the same
        // calendar again, one watch per race.
        if (isWholeCalendarHost(hostnameOf(child))) continue;
        const sameHost = hostnameOf(child) === hostnameOf(row.url);
        if (
          sameHost &&
          (row.kind === "series" ||
            row.kind === "federation" ||
            row.kind === "aggregator" ||
            row.kind === "calendar")
        ) {
          // FCI /race/detail and ical feeds are covered by the list crawl — don't enqueue them
          if (
            hostnameOf(child).includes("federciclismo.it") &&
            (/\/race\/detail\//i.test(child) || /\/race\/icald\//i.test(child))
          ) {
            continue;
          }
          if (
            hostnameOf(child).includes("federciclismo.it") &&
            !hostnameOf(child).includes("members.")
          ) {
            if (
              !/circuiti-mtb\/italia-bike-cup/i.test(child) &&
              !/circuiti-mtb\/coppa-italia-giovanile\/?(\?|$)/i.test(child)
            ) {
              continue;
            }
          }
          if (hostnameOf(child).includes("ciclisme.cat")) {
            if (!/campionat\/btt\/copa-catalana-internacional-btt|campionat\/btt\/copa-catalunya-btt/i.test(child)) {
              continue;
            }
          }
          if (hostnameOf(child).includes("esmtb.com")) {
            if (!/calendario-de-las-copas-de-espana/i.test(child)) continue;
          }
          // Racement calendars already have every round — skip detail/hub noise
          if (
            hostnameOf(child).includes("kidscup.bike") ||
            hostnameOf(child).includes("rookiescup.bike") ||
            hostnameOf(child).includes("ixsdownhillcup.com")
          ) {
            const path = (() => {
              try {
                return new URL(child).pathname;
              } catch {
                return child;
              }
            })();
            if (!/\/(en\/)?race-calendar|\/rennkalender\/?$/i.test(path)) {
              continue;
            }
          }
          // Prima / ČP / ZAL / Enduro / Praha listings — don't enqueue every CMS page
          if (hostnameOf(child).includes("iprimacup.cz")) {
            try {
              const path = new URL(child).pathname;
              if (!/\/zavody-20\d{2}/i.test(path) && path.replace(/\/$/, "") !== "") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("poharmtb.cz")) {
            try {
              const path = new URL(child).pathname;
              if (!/cross-country|enduro|downhill/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("zapadoceskaamaterskaliga.cz")) {
            try {
              const path = new URL(child).pathname;
              if (!/\/kalendare\//i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("enduroserie.cz")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/" && path !== "/zavody") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("jihoceskymtbpohar.cz")) {
            try {
              const path = new URL(child).pathname;
              if (path.startsWith("/race/")) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("ucimtbworldseries.com")) {
            try {
              const path = new URL(child).pathname;
              if (!/\/calendar\/?$/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("swiss-cycling.ch")) {
            try {
              const path = new URL(child).pathname;
              if (!/\/kalender\/?$/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("swissbikecup.ch")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/^\/(en|de|fr)?$/.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("mtb-cup.ch")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (!/^\/(en\/)?race$/.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("valais-cycling.ch")) {
            try {
              const path = new URL(child).pathname;
              if (!/kids-bike-cup-valais/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("eigerbike.ch")) {
            try {
              const path = new URL(child).pathname;
              if (!/kids-race/i.test(path) && !/\/race\/informations/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("bikekingdom.ch")) {
            try {
              const path = new URL(child).pathname;
              if (!/kids-cup/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("bikeclub-engelberg.ch")) {
            try {
              const path = new URL(child).pathname;
              if (!/valiant-gp/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("brvinfo.ch")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (path !== "/bundicycling-kidscup") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("mso.swiss")) continue;
          if (hostnameOf(child).includes("bratislavskymtbmaraton.biker.sk")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/\/preteky\/(maraton|detske-preteky|kids-zone|bikefest-marathon)/i.test(path)) {
                continue;
              }
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("detskatour.sk")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/" && !/\/category\/propozicie/i.test(path)) {
                if (!(/\/20\d{2}\//.test(path) && /kolo|propoz|dtps|dpts/i.test(path))) {
                  continue;
                }
              }
              if (/ohodno|fotogal|feed|wp-content/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("detskymtbcup.cz")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("skvelopraha.cz")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (path !== "/velky-haj") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("pekloseveru.cz")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (
                !/\/(registrace|registration)$/i.test(path) &&
                !/\/(propozice-serialu|series-regulations)$/i.test(path)
              ) {
                continue;
              }
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("ustimtbcup.cz")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (
            hostnameOf(child).includes("ppkbike.cz") ||
            hostnameOf(child).includes("ppk-hk.cz")
          ) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/" && path !== "/index.html" && path !== "/ppk-races.js") {
                continue;
              }
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("cyclingaustria.at")) {
            try {
              const u = new URL(child);
              if (!/kalender/i.test(u.pathname)) continue;
              if (/[?&]kalender\?/i.test(u.search)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("rad-net.de")) {
            if (!/ga-bl-cyclo-cross/i.test(child)) continue;
          }
          // CUBE Cup homepage lists all races — skip news/detail/anmeldung noise
          if (hostnameOf(child).includes("cup.cube.eu")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          // TBC: only series root + season calendars (not individual /zavod- pages)
          if (hostnameOf(child).includes("tbcserie.cz")) {
            try {
              const path = new URL(child).pathname;
              if (!/^\/?$/.test(path) && !/^\/kalendar-?20\d{2}\/?$/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("cyklistikaszc.sk")) {
            try {
              const path = new URL(child).pathname;
              if (
                !/\/(mtb-cross-country|cestna-cyklistika|cyklokros|bmx-racing|bmx-freestyle|mtb-downhill-fourcross|cyklotrial|drahova-cyklistika)\/kalendar\/?$/i.test(
                  path,
                )
              ) {
                continue;
              }
            } catch {
              continue;
            }
          }
          if (
            hostnameOf(child).includes("albgold-juniorscup.de") ||
            hostnameOf(child).includes("xco-bikecup.de") ||
            hostnameOf(child).includes("schwarzwaelder-mtb-cup.de") ||
            hostnameOf(child).includes("rhein-eifel-mtb-cup.de") ||
            hostnameOf(child).includes("mtb-oberschwaben-cup.de") ||
            hostnameOf(child).includes("salzkammergut-trophy.at")
          ) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("jcp-mtb.cz")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("bayerwald-mtb-cup.com")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("skiclub-bb.com")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (path !== "/werdenfelscup.html") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("sportchallenge.cz")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (!/\/podkrkonosskymaraton\/2026$/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (
            hostnameOf(child).includes("mtb-rhein-main-cup.de") ||
            hostnameOf(child).includes("mpdv-cup.de") ||
            hostnameOf(child).includes("mountainbike-challenge.at") ||
            hostnameOf(child).includes("globmetalxc.pl")
          ) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("mtb-kidscup.de")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (path !== "/start/termine-2") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("soof.sk")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (path !== "/podujatia-a-akcie") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("schulsportverein.de")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (path !== "/stadtmeisterschaft") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("sport-base.eu")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/competitions") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("raceresult.com")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (!/\/(387659|377510)(\/info)?$/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("datasport.de")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (!/mtbwildpoldsried2026/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("rookiescup-ostbayern.de")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (path !== "/rennen") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("mtbsaarlandliga.de")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (path !== "/rennen") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("juniorbikecup.at")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (path !== "/termine") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("on-offteam.cz")) {
            try {
              const path = new URL(child).pathname;
              if (!/on-off-mtb-pohar/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("polandbike.pl")) {
            try {
              const path = new URL(child).pathname;
              if (!/kalendarz/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("xco-nrw-cup.de")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("schwarzwald-bike-marathon.de")) {
            try {
              const path = new URL(child).pathname;
              if (!/rena-kids-cup/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("albstadt-bike-marathon.de")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("rsv-bad-griesbach.de")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("bahno.ambike.com")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/" && !/propozice-2026-jaro/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("bike-revolution.ch")) {
            if (!/anmeldung-2026/i.test(child)) continue;
          }
          if (hostnameOf(child).includes("bikeside.ch")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/" && path !== "/kategorien") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("mtbraceseries.ch")) {
            try {
              const path = new URL(child).pathname;
              if (!/\/egg/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("fmciclismo.com")) {
            if (!/ESCUELAS/i.test(child)) continue;
          }
          if (hostnameOf(child).includes("marathon-man.eu")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (
            hostnameOf(child).includes("authorkralsumavy.cz") ||
            hostnameOf(child).includes("malevilcup.cz") ||
            hostnameOf(child).includes("horal.sk") ||
            hostnameOf(child).includes("grand-raid-bcvs.ch") ||
            hostnameOf(child).includes("raidevolenard-fmv.ch") ||
            hostnameOf(child).includes("mtbpomerania.pl") ||
            hostnameOf(child).includes("silesia.bike") ||
            hostnameOf(child).includes("troitrek.it") ||
            hostnameOf(child).includes("mb-race.com") ||
            hostnameOf(child).includes("transmaurienne-vanoise.com") ||
            hostnameOf(child).includes("ryebikefestival.no") ||
            hostnameOf(child).includes("alpen-tour.at") ||
            hostnameOf(child).includes("riojabikeexperience.com")
          ) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("bike-marathon.com")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/^\/(de|en)?$/.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("herodolomites.com")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/^\/(en|it|de|fr)?$/.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("sloenduro.com")) {
            if (!/sloenduro-calendar/i.test(child)) continue;
          }
          if (hostnameOf(child).includes("sloxcup.com")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/dirke-2026/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("sloveniadownhillcup.si")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/((en|sl)\/)?(races|dirke)-2026/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("belgiancycling.be")) {
            if (!/3-nations-cup\/kalender/i.test(child)) continue;
          }
          if (hostnameOf(child).includes("cycling.vlaanderen")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/\/competitie\/mtb\/(xco|kids)-series$/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("mtbcompetitieoostnederland.nl")) {
            if (!/agenda-mbt-cup/i.test(child)) continue;
          }
          if (hostnameOf(child).includes("knwu.nl") || hostnameOf(child).includes("kenniscentrum.knwu.nl")) {
            if (
              !/kampioenschappen\/nk-mountainbike/i.test(child) &&
              !/streetrace-competitie-2026/i.test(child)
            ) {
              continue;
            }
          }
          if (hostnameOf(child).includes("rocazur.com")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/^\/(fr|en)?$/.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("crosskovacsi.hu")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/" && path !== "/hu/nyitolap") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("hbs.hr")) {
            if (
              !/\/kalendar\/mtb/i.test(child) &&
              !/\/kalendar\/?(\?|$)/i.test(child) &&
              !/\/kalendar\/page\/\d+/i.test(child)
            ) {
              continue;
            }
          }
          if (hostnameOf(child).includes("superprestigecyclocross.be")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/^\/(nl|en|fr)?\/?kalender$/i.test(path) && path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("ucicyclocrossworldcup.com")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/^\/(en|nl|fr)?\/?calendar$/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("uec.ch")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/^\/(en|fr|de)\/calendar$/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (
            hostnameOf(child).includes("letour.fr") ||
            hostnameOf(child).includes("paris-roubaix.fr") ||
            hostnameOf(child).includes("oesterreich-rundfahrt.at") ||
            hostnameOf(child).includes("tourofaustria.com") ||
            hostnameOf(child).includes("tourdesuisse.ch") ||
            hostnameOf(child).includes("gravelchallenge.dk") ||
            hostnameOf(child).includes("quebrantahuesos.com") ||
            hostnameOf(child).includes("lapuritoandorra.com") ||
            hostnameOf(child).includes("kotl.at") ||
            hostnameOf(child).includes("faustocoppi.net") ||
            hostnameOf(child).includes("haervejsloebet.dk")
          ) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/" && !/^\/(en|fr|de|es|it)?$/.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("pyoraily.fi")) {
            if (!/kultainen-kampi/i.test(child)) continue;
          }
          const { error } = await supabase.from("watched_urls").upsert(
            {
              url: child,
              kind: "series",
              parent_id: row.id,
              status: "active",
              added_by: "auto-same-domain",
              notes: "Calendar follow-up from adapter",
              next_poll_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "url", ignoreDuplicates: true },
          );
          if (!error) linksDiscovered += 1;
        } else if (
          linksDiscovered < 24 &&
          (looksLikeIndependentRaceUrl(child) || row.kind === "aggregator")
        ) {
          const queued = await queueDiscoveredLink(child, {
            hintKind: "outbound",
            fromWatchedUrlId: row.id,
            force: row.kind === "aggregator",
          });
          if (queued) linksDiscovered += 1;
        }
      } catch {
        /* ignore bad child URLs */
      }
    }

    // New-season sources must come from actual links/announcements above.
    // Changing a year in an address neither proves the page exists nor
    // identifies a new edition, and must never reactivate a dead source.

    const calendarKind =
      row.kind === "series" ||
      row.kind === "federation" ||
      row.kind === "aggregator" ||
      row.kind === "calendar";
    /*
     * An empty read of a calendar that listed races last week is a failed
     * read, not a season ending. The federation portal is a Blazor app that
     * sometimes answers with its error shell and no rows; that was taken as
     * "off season", the source was parked for three weeks, and fifty-seven
     * upcoming races went unrefreshed. Only a source with nothing ahead of it
     * in the catalogue is allowed to go quiet.
     */
    const stillHasUpcoming =
      calendarKind && extracted.events.length === 0 && !seasonMismatch
        ? await sourceHasUpcomingEvents(supabase, row.id)
        : false;
    /*
     * A single race's own page that once gave us the race and now gives
     * nothing, with no edition ahead in the catalogue: the race has been run
     * and next year's is not up yet. Forty sources sat red in the admin as
     * "broken" for exactly this, every one of them reading fine.
     */
    const raceSeasonOver =
      !calendarKind && extracted.events.length === 0 && !seasonMismatch
        ? (await sourceHasAnyEvents(supabase, row.id)) &&
          !(await sourceHasUpcomingEvents(supabase, row.id))
        : false;
    // Nothing read from a calendar whose page states several coming days: the reader, not the season.
    const statedDates = calendarKind && extracted.events.length === 0 ? comingDatesOnPage((await import("@/lib/watcher/registration-deadline")).visibleText(fetched.html)) : 0;
    const silentCalendar = statedDates >= SILENT_CALENDAR_DATES;
    const offSeasonEmpty = !silentCalendar && (
      (calendarKind && extracted.events.length === 0 && !stillHasUpcoming) ||
      raceSeasonOver ||
      seasonMismatch);
    const emptyButLive = calendarKind && extracted.events.length === 0 && stillHasUpcoming;
    const pending = [...progress.values()].filter(entry => entry.conflicts > 0);
    const incomplete = extracted.complete === false || writeBacklog || writeFailures.length > 0 || pending.length > 0;
    const checkpointSafe = extracted.complete !== false && !emptyButLive && !writeBacklog &&
      writeFailures.every(f => progress.get(f.externalId)?.conflicts) && !extracted.strategy.startsWith("rendered:");
    const pendingOnly = checkpointSafe && pending.length > 0;
    const issues = [...(extracted.issues ?? []), ...(writeBacklog ? ["write_backlog"] : []), ...(pending.length ? ["calendar_write_retry_pending"] : []), ...writeFailures.map(f => `write_failed:${f.externalId}:${f.error}`)];
    const deferredWrites = writeFailures.filter(f => isBudgetDeferral(f.error));
    const deferredCount = pending.length + deferredWrites.filter(f => !progress.get(f.externalId)?.conflicts).length;
    const failedWrites = writeFailures.filter(f => !isBudgetDeferral(f.error));
    const budgetDeferred = incomplete && !failedWrites.length && (pendingOnly || issues.some(isBudgetDeferral));
    const identityReview = writeFailures.some(f => /identity_review_required|pipeline_data_review_required/.test(f.error));
    const unsupportedDocument = issues.some(i => /dynamic_render_unavailable|source_document_too_large|unsupported_or_empty_source/.test(i));
    const needsReview = incomplete ||
      (!offSeasonEmpty && (extracted.events.length === 0 || extracted.confidence < 0.4));

    if (calendarKind && !needsReview && !offSeasonEmpty && canReconcileMissingEvents(extracted)) {
      const { hideDroppedCalendarEvents } = await import("@/lib/catalog/freshness");
      const extractedIds = new Set(
        candidates
          .map((ev) => ev.externalId)
          .filter((id): id is string => Boolean(id)),
      );
      const dates = candidates.map((ev) => ev.startDate).filter(Boolean).sort();
      hidden = await hideDroppedCalendarEvents({
        watchedUrlId: row.id,
        extractedExternalIds: extractedIds,
        extractedCount: candidates.length,
        extractedFrom: dates[0],
        extractedUntil: dates.at(-1),
      });
    }
    // A row skipped as unchanged was still seen on this page, so it stays checked.
    if (trackProgress && writableCandidates.length < uniqueCandidates.length) {
      const { touchListedEvents } = await import("@/lib/catalog/freshness");
      const writable = new Set(writableCandidates);
      await touchListedEvents(row.id, uniqueCandidates
        .filter(event => !writable.has(event) && event.externalId && !progress.get(event.externalId)?.conflicts)
        .map(event => event.externalId!));
    }

    sourcePatch = {
      calendar_write_progress: trackProgress && !emptyButLive ? { version: progressVersion, rows: [...progress].map(([id, entry]) => [id, entry.hash, entry.until, entry.conflicts]) } : row.calendar_write_progress ?? null,
      content_hash: !checkpointSafe ? null : `${checkpointPrefix}${fetched.hash}`,
      etag: !checkpointSafe ? null : fetched.etag,
      last_modified: !checkpointSafe ? null : fetched.lastModified,
      http_status: fetched.status,
      last_fetched_at: new Date().toISOString(),
      last_changed_at: new Date().toISOString(),
      last_error: incomplete ? issues.join("; ").slice(0, 2000) || "incomplete_extraction" : emptyButLive
        ? "empty read of a source with upcoming races"
        : needsReview
          ? silentCalendar ? `no race read from a page that states ${statedDates} coming dates; the reader no longer fits it` : "low confidence or empty extract"
          : null,
      last_extract_status: incomplete ? "needs_review" : offSeasonEmpty
        ? "off_season"
        : needsReview
          ? "needs_review"
          : "ok",
      // Stay active — retry later instead of permanent pause
      status: "active",
      next_poll_at: pendingOnly ? new Date(Math.min(sourcePollAt(extracted.events).getTime(), ...pending.map(entry => entry.until))).toISOString()
        : budgetDeferred ? new Date(Date.now() + 2 * 60 * 60_000).toISOString()
        : identityReview || unsupportedDocument ? reviewPollAt().toISOString()
        : incomplete ? errorPollAt(1).toISOString() : emptyButLive
        ? // Soon, the way a fetch error is retried: the page is up, it
          // just did not render this time.
          errorPollAt(1).toISOString()
        : needsReview
        ? reviewPollAt().toISOString()
        : extracted.strategy?.includes("fci")
          ? // Rotate month windows every ~2h until season is filled
            new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
          : sourcePollAt(extracted.events).toISOString(),
    };


    if (extracted.strategy.startsWith("adapter") || extracted.strategy === "jsonld") {
      await bumpExtractionProfile(
        hostnameOf(row.url),
        extracted.strategy,
      );
    }

    const metrics = { watchedUrlId: row.id,
      extracted: extracted.events.length, attempted: toUpsert.length, upserted, pendingWrites: pending.length, skippedUnchanged: candidates.length - writableCandidates.length,
      created: createdIds.size,
      updated: updatedIds.size,
      rejected: upsertResults.filter(r => !r).length - writeFailures.length, failed: failedWrites.length, deferredWrites: deferredCount, complete: !incomplete, deferred: budgetDeferred,
      issues, usage: extracted.usage ?? null, extraction: extracted.diagnostics ?? null };
    console.info("watcher_run_metrics", JSON.stringify(metrics));
    recordRun({
      metrics,
      ok: !incomplete,
      error: incomplete ? issues.join("; ").slice(0, 2000) || "incomplete extraction" : undefined,
      linksDiscovered,
      strategy: extracted.strategy,
      httpStatus: fetched.status,
    });

    return {
      watchedUrlId: row.id,
      url: row.url,
      ok: !incomplete,
      error: incomplete ? issues.join("; ").slice(0, 2000) || "incomplete extraction" : undefined,
      eventsUpserted: upserted,
      eventsExtracted: extracted.events.length,
      eventsCreated: createdIds.size,
      eventsUpdated: updatedIds.size,
      eventsRejected: upsertResults.filter(r => !r).length - writeFailures.length,
      eventsFailed: failedWrites.length,
      eventsDeferred: deferredCount,
      extractionComplete: !incomplete,
      issues,
      usage: extracted.usage,
      linksDiscovered,
      droppedHidden: hidden,
      strategy: extracted.strategy,
      httpStatus: fetched.status,
      preview: extracted.events.slice(0, 5),
    };
  } catch (e) {
    const causeCode = e instanceof Error && e.cause instanceof Error
      ? (e.cause as Error & { code?: string }).code : undefined;
    const tlsDetail = causeCode && /^(UNABLE_TO_|CERT_|ERR_TLS_)/.test(causeCode)
      ? `; TLS certificate verification failed (${causeCode})` : "";
    const message = (e instanceof Error ? e.message : "unknown error") + tlsDetail;
    const now = Date.now();
    // Give a transient failure a quick retry. A source that is still failing
    // should not consume six slots a day while its provider is unavailable.
    const retryAt = row.last_extract_status === "error" ? new Date(now + 24 * 60 * 60_000) : errorPollAt();
    sourcePatch = {
      last_error: message,
      last_extract_status: "error",
      last_fetched_at: new Date(now).toISOString(),
      next_poll_at: /source_document_too_large|pdf_has_no_text/.test(message) ? reviewPollAt().toISOString() : retryAt.toISOString(),
    };
    recordRun({ ok: false, error: message });
    return {
      watchedUrlId: row.id,
      url: row.url,
      ok: false,
      eventsUpserted: committedWrites,
      eventsCreated: createdIds.size,
      eventsUpdated: updatedIds.size,
      linksDiscovered: 0,
      error: message,
    };
  }
}

function dedupeByExternalId(events: ParsedEvent[]): ParsedEvent[] {
  const seen = new Set<string>();
  const out: ParsedEvent[] = [];
  for (const ev of events) {
    const key = ev.externalId || `${ev.startDate}:${normalizeName(ev.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ev);
  }
  return out;
}

async function bumpExtractionProfile(host: string, strategy: string) {
  const supabase = createServerSupabase();
  const { data: existing } = await supabase
    .from("extraction_profiles")
    .select("id, success_count")
    .eq("host", host)
    .eq("strategy", strategy)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    await supabase
      .from("extraction_profiles")
      .update({
        success_count: (existing.success_count ?? 0) + 1,
        last_success_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("extraction_profiles").insert({
      host,
      strategy,
      recipe: { source: strategy },
      success_count: 1,
      last_success_at: new Date().toISOString(),
    });
  }
}

function slugifySeries(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function unionText(a: string[] | null | undefined, b: string[] | null | undefined): string[] {
  return [...new Set([...(a ?? []), ...(b ?? [])].filter(Boolean))];
}

const SERIES_LEVEL_RANK: Record<string, number> = {
  local: 0,
  regional: 1,
  national: 2,
  continental: 3,
  international: 4,
  world_cup: 5,
  european_championship: 6,
  world_championship: 7,
};

async function prepareSeriesPlan(
  supabase: ReturnType<typeof createServerSupabase>,
  ev: ParsedEvent,
  classified: {
    disciplines: string[];
    ageCategories: string[];
    level: string;
    competitionType: string;
    season: string;
  },
  websiteFn: (url?: string | null, fallback?: string | null) => string | null,
): Promise<WatcherSeriesPlan | undefined> {
  const seriesAges = ev.seriesAgeCategories ?? classified.ageCategories;
  if (!ev.seriesName && !ev.seriesSlug) return undefined;
  const { isSiteIdentityName } = await import("@/lib/watcher/extractors/generic");
  if (ev.seriesName && isSiteIdentityName(ev.seriesName)) return undefined;

  const { inferSeriesType, inferSeriesSourceKind, audienceFromAgeCategories, inferDisciplines } =
    await import("@/lib/taxonomy");
  type AgeCategory = import("@/lib/taxonomy").AgeCategory;

  const slug = ev.seriesSlug || slugifySeries(ev.seriesName || "series");
  const name = ev.seriesName || slug;
  const website = websiteFn(ev.seriesWebsite);
  const namedDisciplines = inferDisciplines(`${name} ${slug}`).filter(d => !["mtb", "road", "other"].includes(d));
  const seriesDisciplines = namedDisciplines.length ? namedDisciplines : classified.disciplines;
  const country =
    ev.countryHint && ev.countryHint.length === 2 ? ev.countryHint.toUpperCase() : null;
  const seriesType = inferSeriesType({
    name,
    slug,
    disciplines: seriesDisciplines,
    ageCategories: seriesAges,
  });
  const sourceKind = inferSeriesSourceKind({
    name,
    slug,
    url: website || ev.seriesWebsite || ev.sourceUrl,
  });
  const { data: existing, error } = await supabase.from("series").select("*").eq("slug", slug).maybeSingle();
  if (error) throw Error(`Reading series metadata: ${error.message}`);

  if (existing) {
    const disciplines = unionText(existing.disciplines as string[], seriesDisciplines);
    const ageCategories = unionText(existing.age_categories as string[], seriesAges);
    const existingLevel = String(existing.level ?? "local");
    const level =
      (SERIES_LEVEL_RANK[classified.level] ?? 0) > (SERIES_LEVEL_RANK[existingLevel] ?? 0)
        ? classified.level
        : existingLevel;
    const competitionType =
      existing.competition_type && existing.competition_type !== "other"
        ? String(existing.competition_type)
        : classified.competitionType;
    const patch: Update<"series"> = {
      name_normalized: existing.name_normalized || normalizeName(name),
      disciplines,
      level,
      competition_type: competitionType,
    };
    if (!existing.age_categories_confirmed_at) {
      patch.age_categories = ageCategories;
      if (ageCategories.length) patch.audience_hint = audienceFromAgeCategories(ageCategories as AgeCategory[]);
    }
    if (website && !existing.website_url) patch.website_url = website;
    if (country && !existing.country_code) patch.country_code = country;
    if (classified.season && !existing.season) patch.season = classified.season;
    if (!existing.series_type || existing.series_type === "other") patch.series_type = seriesType;
    if (!existing.source_url && (website || ev.sourceUrl)) {
      patch.source_url = website || ev.sourceUrl;
    }
    if (!existing.source_kind || existing.source_kind === "other") patch.source_kind = sourceKind;
    const changes = Object.fromEntries(Object.entries(patch).filter(([key, value]) =>
      JSON.stringify(value) !== JSON.stringify(existing[key as keyof typeof existing]),
    ));
    return { id: existing.id, slug, website: existing.website_url ?? website, expected: existing, patch: changes };
  }

  return {
    id: randomUUID(),
    slug,
    website,
    create: {
      slug,
      name,
      name_normalized: normalizeName(name),
      website_url: website,
      audience_hint: seriesAges.length
        ? audienceFromAgeCategories(seriesAges as AgeCategory[])
        : ev.audience || "mixed",
      country_code: country,
      disciplines: seriesDisciplines,
      age_categories: seriesAges,
      series_type: seriesType,
      level: classified.level,
      competition_type: classified.competitionType,
      season: classified.season || null,
      source_url: website || ev.sourceUrl || null,
      source_kind: sourceKind,
    },
  };
}

/**
 * A series we read from its own site is filled by that site alone.
 *
 * Hynek's calendar, sumator and the federation portal all label their rows
 * with the series they belong to, and each of them is a little wrong: a
 * Saturday and a Sunday row for one weekend, an awards night, a race that
 * left the series a year ago. Let them attach and a series of eight rounds
 * shows twenty-five. They may still enrich a round the official calendar
 * created — that goes through dedup — but they cannot add one.
 *
 * Only series whose website host is itself an active source are guarded;
 * a series nobody reads officially is still built from whoever lists it.
 */
const officialHostCache = new Map<string, { active: boolean; at: number }>();
async function seriesAcceptsSource(
  supabase: ReturnType<typeof createServerSupabase>,
  website: string | null,
  watchedUrl: string | undefined,
): Promise<boolean> {
  if (!watchedUrl || !website) return true;
  const host = hostnameOf(website).replace(/^www\./, "");
  if (host === "unknown" || hostnameOf(watchedUrl).replace(/^www\./, "") === host) return true;
  const cached = officialHostCache.get(host);
  if (cached && Date.now() - cached.at < 10 * 60_000) return !cached.active;
  const { count, error } = await supabase
    .from("watched_urls")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .ilike("url", `%${host}%`);
  if (error) throw Error(`Reading official series source: ${error.message}`);
  officialHostCache.set(host, { active: Boolean(count), at: Date.now() });
  return !count;
}

const CC_TLDS = new Set([
  "cz", "sk", "pl", "de", "at", "ch", "it", "fr", "be", "nl", "lu", "si", "hr", "hu",
  "es", "pt", "dk", "se", "no", "fi", "ie", "ro", "bg", "rs", "ba", "lt", "lv", "ee", "gr",
]);

/** The country a site's domain names: "stevenscup.de" is German. */
export function countryFromDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    const tld = host.split(".").pop() ?? "";
    if (tld === "uk") return "GB";
    return CC_TLDS.has(tld) ? tld.toUpperCase() : null;
  } catch {
    return null;
  }
}

async function upsertParsedEvent(
  ev: ParsedEvent,
  watchedUrlId: string,
  watchedKind?: string,
  watchedUrl?: string,
  review?: { expectedEventId: string | null; publication: import("@/lib/discovery/publication").CandidatePublication },
) {
  const { isIngestibleDate, inferClassification, audienceFromAgeCategories } = await import(
    "@/lib/taxonomy"
  );
  if (!isIngestibleDate(ev.startDate)) return null;
  const { reviewed2027Identity } = await import("@/lib/watcher/reviewed-2027-identities");
  const reviewedIdentity = reviewed2027Identity(ev);
  if (reviewedIdentity?.reject) return null;
  if (reviewedIdentity) ev = { ...ev, startDate: reviewedIdentity.startDate, endDate: reviewedIdentity.endDate };
  const { isOrganisationPlace } = await import("@/lib/catalog/overview-quality");
  if (isOrganisationPlace(ev.placeText)) throw Error("pipeline_data_review_required:organisation_is_not_a_place");
  const basicIssues = overviewIssues({ name: ev.name, start_date: ev.startDate, end_date: ev.endDate, status: ev.status }, new Date().toISOString().slice(0, 10));
  if (basicIssues.length) throw new Error(`pipeline_data_review_required:${basicIssues.join(",")}`);

  // A bracketed IOC code in the title names the *venue's* country; a calendar's
  // own hint often names the organiser's. Prefer the title — that mismatch is
  // how a Czech downhill round ended up pinned in Thuringia. Do this before the
  // classifier runs, so the country also disambiguates SP / národný vs světový.
  const { countryCodeFromName } = await import("@/lib/geo/europe");
  const titleCountry = countryCodeFromName(ev.placeText) ?? countryFromVenue(ev.placeText) ?? countryCodeFromName(ev.name);
  if (titleCountry && titleCountry !== ev.countryHint) {
    ev = { ...ev, countryHint: titleCountry };
  }
  // A source that names no country is read by its domain, not taken to be
  // Czech: every STEVENS Cup round from stevenscup.de was geocoded to Czechia
  // ("#03 - Bad Harzburg", 74 km from Prague) and so never met the German
  // listing of the same race.
  if (!ev.countryHint) {
    const fromDomain = countryFromDomain(watchedUrl) ?? countryFromDomain(ev.sourceUrl);
    if (fromDomain) ev = { ...ev, countryHint: fromDomain };
  }

  const supabase = createServerSupabase();
  const fp = fingerprint({
    startDate: ev.startDate,
    name: ev.name,
    lat: ev.lat,
    lng: ev.lng,
  });
  const { pickBestDuplicate, isLikelyDuplicate, preferEventName, mergeDateSpan, preferLevel, normalizeUrlForDedup } =
    await import("@/lib/dedup");
  const { publicRaceUrl, preferDeeperOfficialUrl } = await import("@/lib/watcher/public-url");
  const classified = inferClassification({
    name: ev.name,
    existingClassLabel: ev.uciClass,
    placeText: ev.placeText,
    seriesName: ev.seriesName,
    seriesSlug: ev.seriesSlug,
    disciplines: ev.discipline,
    categoryNames: (ev.categories ?? []).map((c) => c.name),
    existingAudience: ev.audience,
    startDate: ev.startDate,
    countryHint: ev.countryHint,
  });
  const levelInfo = {
    level: classified.level,
    classLabel: classified.classLabel,
    uciClass: classified.uciClass,
  };
  const disciplines = classified.disciplines.length
    ? classified.disciplines
    : ev.discipline ?? [];
  const overviewOnly = Boolean(review) || process.env.CATALOG_OVERVIEW_ONLY === "1";
  const audience = !overviewOnly && classified.ageCategories.length
    ? classified.audience
    : ev.audience ?? "mixed";

  const incomingWebsite = publicRaceUrl(ev.websiteUrl, ev.sourceUrl);
  const incomingRegistration = publicRaceUrl(ev.registrationUrl);
  const { preferRegulationsUrl, isRegulationsUrl, regulationsNameAnotherPlace } = await import("@/lib/watcher/regulations-url");
  const { isStartListUrl } = await import("@/lib/watcher/registration-url");
  const offeredRegulations =
    publicRaceUrl(ev.regulationsUrl) ||
    (ev.regulationsUrl && isRegulationsUrl(ev.regulationsUrl)
      ? ev.regulationsUrl.trim()
      : null) ||
    (incomingWebsite && isRegulationsUrl(incomingWebsite) ? incomingWebsite : null);
  const incomingRegulations = offeredRegulations && regulationsNameAnotherPlace(offeredRegulations, `${ev.name} ${ev.placeText ?? ""}`) ? null : offeredRegulations;
  const incomingResults = publicRaceUrl(ev.resultsUrl) || ev.resultsUrl?.trim() || null;
  const { isSharedCalendarEvidence } = await import("@/lib/watcher/source-identity");
  const sharedCalendar = isSharedCalendarEvidence(ev);
  const incomingUrls = [incomingWebsite, incomingRegistration, ev.sourceUrl].filter(
    u => Boolean(u) && !(sharedCalendar && u === ev.sourceUrl),
  );

  const incomingDedup = {
    startDate: ev.startDate,
    endDate: ev.endDate ?? ev.startDate,
    name: ev.name,
    lat: ev.lat,
    lng: ev.lng,
    placeText: ev.placeText,
    countryCode: (ev.countryHint || "").trim().toUpperCase() || null,
    seriesName: ev.seriesName,
    fingerprint: fp,
    disciplines,
    urls: incomingUrls,
  };

  type LocRow = {
    lat?: number;
    lng?: number;
    name?: string;
    municipality?: string;
    country_code?: string | null;
  } | null;
  type CandidateRow = {
    id: string;
    name: string;
    start_date: string;
    end_date?: string | null;
    fingerprint?: string | null;
    disciplines?: string[] | null;
    website_url?: string | null;
    registration_url?: string | null;
    location?: LocRow;
    series?: { name?: string } | { name?: string }[] | null;
    sources?: { source_url?: string }[] | null;
  };
  const asCandidate = (row: CandidateRow, extraUrls: (string | null | undefined)[] = []) => {
    const loc = (Array.isArray(row.location) ? row.location[0] : row.location) as LocRow;
    const series = Array.isArray(row.series) ? row.series[0] : row.series;
    return {
      row,
      event: {
        startDate: row.start_date,
        endDate: row.end_date,
        name: row.name,
        lat: loc?.lat,
        lng: loc?.lng,
        placeText: loc?.municipality || loc?.name,
        countryCode: countryCodeFromName(loc?.name) ?? loc?.country_code ?? null,
        seriesName: series?.name,
        fingerprint: row.fingerprint ?? undefined,
        disciplines: row.disciplines,
        urls: [
          row.website_url,
          row.registration_url,
          ...(row.sources ?? []).map((x) => x.source_url),
          ...extraUrls,
        ],
      },
    };
  };

  // 1) fingerprint — exact cell first, then the neighbouring geohash cells and the
  // "nogps" variant, which only count once the scorer confirms them.
  // Source identity is stronger than a display name. After a reviewed merge,
  // the source belongs to the keeper and must never create its old race again.
  const { sourceEditionId, calendarRowCandidates, settledSourceRow } = await import("@/lib/watcher/source-identity");
  let ambiguousIdentity = false;
  const pickIncomingDuplicate: typeof pickBestDuplicate = (incoming, candidates) => {
    const eligible = calendarRowCandidates(ev.startDate, sharedCalendar, candidates);
    const best = pickBestDuplicate(incoming, eligible);
    if (!best && eligible.some(c => isLikelyDuplicate(incoming, c.event))) ambiguousIdentity = true;
    return best;
  };
  const { data: knownSource, error: sourceError } = await supabase
    .from("event_sources")
    .select("event:events(id,name,start_date,end_date,disciplines,merged_into_id,website_url,registration_url,location:locations(lat,lng,name,municipality,country_code))")
    .eq("watched_url_id", watchedUrlId)
    .eq("external_id", ev.externalId)
    .maybeSingle();
  if (sourceError) throw sourceError;
  const sourceEvent = (Array.isArray(knownSource?.event) ? knownSource.event[0] : knownSource?.event) as unknown as (CandidateRow & { merged_into_id?: string | null }) | null;
  let existingId = sourceEditionId(
    ev.startDate,
    sourceEvent,
    sourceEvent ? { incoming: incomingDedup, stored: asCandidate(sourceEvent, [ev.sourceUrl]).event } : undefined,
  );
  // Matched by this very source's own record of the race, not by resemblance.
  if (sharedCalendar && sourceEvent?.start_date !== ev.startDate) existingId = undefined;
  const settled = review ? undefined : settledSourceRow(ev.externalId, ev.startDate, sourceEvent, existingId);
  if (settled) return { id: settled, created: false, changed: false };
  const matchedBySource = existingId != null;
  const fpCols =
    "id, name, start_date, end_date, disciplines, fingerprint, status, visibility, website_url, registration_url, location:locations(lat, lng, name, municipality, country_code), overrides:event_overrides(locked_fields)";
  const { data: fpRows, error: fingerprintError } = await supabase
    .from("events")
    .select(fpCols)
    .in("fingerprint", fingerprintVariants(ev))
    .limit(20);
  if (fingerprintError) throw new Error(`Reading fingerprint candidates: ${fingerprintError.message}`);
  const fpCandidates = (fpRows ?? []) as unknown as (CandidateRow & { status?: string })[];
  // The exact fingerprint still wins outright, cancelled rows included — that is
  // how a cancelled race gets updated rather than resurrected as a new row.
  let byFp = pickIncomingDuplicate(incomingDedup, fpCandidates.filter(r => r.fingerprint === fp).map(r => asCandidate(r)))?.row ?? null;
  if (!byFp) {
    const best = pickIncomingDuplicate(
      incomingDedup,
      fpCandidates.filter((r) => r.status !== "cancelled").map((r) => asCandidate(r)),
    );
    byFp = (best?.row as CandidateRow | undefined) ?? null;
  }
  existingId ??= byFp?.id;

  // 1b) same specific website / race-detail URL (strong signal)
  if (!existingId) {
    const urlCols =
      "id, name, start_date, end_date, disciplines, website_url, registration_url, location:locations(lat, lng, name, municipality, country_code)";
    const exactUrls = [incomingWebsite, incomingRegistration].filter(
      (u): u is string => Boolean(u && normalizeUrlForDedup(u)),
    );
    const urlCandidates: CandidateRow[] = [];
    for (const url of exactUrls) {
      const { data: bySite, error: siteCandidateError } = await supabase
        .from("events")
        .select(urlCols)
        .eq("website_url", url)
        .is("merged_into_id", null)
        .limit(8);
      if (siteCandidateError) throw new Error(`Reading identity candidates: ${siteCandidateError.message}`);
      const { data: byReg, error: registrationCandidateError } = await supabase
        .from("events")
        .select(urlCols)
        .eq("registration_url", url)
        .is("merged_into_id", null)
        .limit(8);
      if (registrationCandidateError) throw new Error(`Reading identity candidates: ${registrationCandidateError.message}`);
      urlCandidates.push(...((bySite ?? []) as unknown as CandidateRow[]));
      urlCandidates.push(...((byReg ?? []) as unknown as CandidateRow[]));
    }
    const bestByUrl = pickIncomingDuplicate(
      incomingDedup,
      urlCandidates.map((r) => asCandidate(r)),
    );
    existingId = bestByUrl?.row.id;

    if (!existingId && ev.sourceUrl && normalizeUrlForDedup(ev.sourceUrl)) {
      const { data: bySrc, error: sourceCandidateError } = await supabase
        .from("event_sources")
        .select(
          "event_id, source_url, event:events(id, name, start_date, end_date, disciplines, website_url, registration_url, location:locations(lat, lng, name, municipality, country_code))",
        )
        .eq("source_url", ev.sourceUrl)
        .limit(5);
      if (sourceCandidateError) throw new Error(`Reading identity candidates: ${sourceCandidateError.message}`);
      const srcCandidates: { row: CandidateRow; event: ReturnType<typeof asCandidate>["event"] }[] =
        [];
      for (const row of bySrc ?? []) {
        const rawEvent = row.event as unknown;
        const evRow = (Array.isArray(rawEvent) ? rawEvent[0] : rawEvent) as CandidateRow | null;
        if (!evRow?.id) continue;
        srcCandidates.push(asCandidate(evRow, [row.source_url]));
      }
      existingId = pickIncomingDuplicate(incomingDedup, srcCandidates)?.row.id;
    }
  }

  // 2) soft dedup: multi-signal (name + day/weekend + place + urls)
  if (!existingId) {
    const day = ev.startDate.slice(0, 10);
    const prev = new Date(`${day}T12:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() - 1);
    const next = new Date(`${day}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const from = prev.toISOString().slice(0, 10);
    const to = next.toISOString().slice(0, 10);
    const spanEnd = (ev.endDate ?? ev.startDate).slice(0, 10);

    const eventCols =
      "id, name, start_date, end_date, disciplines, fingerprint, status, website_url, registration_url, series:series!events_series_id_fkey(name), location:locations(lat, lng, name, municipality, country_code), sources:event_sources(source_url)";

    const { data: nearbyDays, error: dayCandidateError } = await supabase
      .from("events")
      .select(eventCols)
      .gte("start_date", from)
      .lte("start_date", to)
      .neq("status", "cancelled")
      .is("merged_into_id", null)
      .limit(400);
      if (dayCandidateError) throw new Error(`Reading identity candidates: ${dayCandidateError.message}`);

    const byId = new Map<string, CandidateRow>(
      ((nearbyDays ?? []) as unknown as CandidateRow[]).map((r) => [r.id, r]),
    );

    // Multi-day races (stage races, Fri–Sun cups) start before our window but
    // still cover this day — a single-day mirror must find them.
    const { data: spanning, error: spanCandidateError } = await supabase
      .from("events")
      .select(eventCols)
      .lt("start_date", from)
      .gte("end_date", from)
      .lte("start_date", spanEnd)
      .neq("status", "cancelled")
      .is("merged_into_id", null)
      .limit(120);
      if (spanCandidateError) throw new Error(`Reading identity candidates: ${spanCandidateError.message}`);
    for (const row of (spanning ?? []) as unknown as CandidateRow[]) byId.set(row.id, row);

    if (ev.lat != null && ev.lng != null) {
      const { data: nearLocs, error: nearLocationError } = await supabase
        .from("locations")
        .select("id")
        .gte("lat", ev.lat - 0.35)
        .lte("lat", ev.lat + 0.35)
        .gte("lng", ev.lng - 0.5)
        .lte("lng", ev.lng + 0.5)
        .limit(80);
      if (nearLocationError) throw new Error(`Reading identity candidates: ${nearLocationError.message}`);
      const locIds = (nearLocs ?? []).map((l) => l.id as string);
      if (locIds.length) {
        const { data: nearbyGeo, error: geoCandidateError } = await supabase
          .from("events")
          .select(eventCols)
          .gte("start_date", from)
          .lte("start_date", to)
          .neq("status", "cancelled")
          .is("merged_into_id", null)
          .in("location_id", locIds)
          .limit(80);
      if (geoCandidateError) throw new Error(`Reading identity candidates: ${geoCandidateError.message}`);
        for (const row of (nearbyGeo ?? []) as unknown as CandidateRow[]) byId.set(row.id, row);
      }
    }

    const best = pickIncomingDuplicate(
      incomingDedup,
      [...byId.values()].map((r) => asCandidate(r)),
    );
    existingId = best?.row.id;
  }

  // A match by a shared page or a near name is not a match when the titles
  // name different instalments: the "Druhé podzimní" listing had taken over
  // the "První podzimní" race (one organiser page for both) and moved it a
  // month. Such an incoming listing is its own race.
  if (existingId && !matchedBySource) {
    const { data: matched } = await supabase.from("events").select("name").eq("id", existingId).maybeSingle();
    const { differentInstalment } = await import("@/lib/catalog/merge-duplicates");
    if (matched?.name && differentInstalment(matched.name, ev.name)) existingId = undefined;
  }

  // A reviewed identity also covers new external ids and stale calendar dates.
  if (reviewedIdentity && !reviewedIdentity.reject) existingId = reviewedIdentity.canonicalId;

  if (!existingId && ambiguousIdentity) throw new Error("identity_review_required: multiple matching races; source row deferred");

  if (review && (existingId ?? null) !== review.expectedEventId) throw Error("identity_review_required: catalogue changed since the reviewed identity");
  let { data: existingFull } = existingId
    ? await supabase
        .from("events")
        .select(
          "*, sources:event_sources(kind, external_id), overrides:event_overrides(locked_fields)",
        )
        .eq("id", existingId)
        .maybeSingle()
    : { data: byFp };
  if (existingId && !existingFull) throw new Error(`Matched race could not be read: ${existingId}`);
  const stored = existingFull as { start_date?: string; end_date?: string | null; sources?: { external_id?: string | null }[] } | null;
  if (existingId && isDifferentDatedRace(ev.externalId, ev.startDate, stored?.start_date, stored?.sources)) {
    if (matchedBySource && !review && isDayOfStoredRace(ev.startDate, stored?.start_date, stored?.end_date)) return { id: existingId, created: false, changed: false };
    // Its own calendar lists them apart: resemblance must not glue them into one race
    // whose date then flips with every read. This row becomes its own race.
    if (matchedBySource || review || !isSameCalendarOtherRace(ev.externalId, ev.startDate, stored?.start_date, stored?.sources)) {
      throw new Error("identity_review_required: this row is a different dated race than the record it is linked to");
    }
    existingId = undefined;
    existingFull = null;
  }

  const reviewedStored = existingFull as { visibility?: string; merged_into_id?: string | null } | null;
  if (review && ((existingId ?? null) !== review.expectedEventId || existingId && (reviewedStored?.visibility !== "public" || reviewedStored?.merged_into_id))) {
    throw new Error("identity_review_required: catalogue changed since the reviewed identity");
  }

  const locked =
    (existingFull as { overrides?: { locked_fields?: string[] } | { locked_fields?: string[] }[] } | null)
      ?.overrides;
  const lockedFields = Array.isArray(locked)
    ? locked[0]?.locked_fields ?? []
    : locked?.locked_fields ?? [];

  const { shouldIngestByCountry, isRoughlyInEurope } = await import("@/lib/geo/europe");
  const { timezoneForCountry } = await import("@/lib/geo/timezones");
  let ingestCountry = (ev.countryHint || "").trim().toUpperCase() || null;
  // Drop explicit non-European races early (before locations / geocode queue)
  if (ev.countryHint && !shouldIngestByCountry(ev.countryHint)) {
    return null;
  }
  if (
    ev.lat != null &&
    ev.lng != null &&
    !ev.countryHint &&
    !isRoughlyInEurope(ev.lat, ev.lng)
  ) {
    return null;
  }

  let locationId: string | null = null;
  let pendingLocation: NewRaceLocationPlan | null = null;
  /**
   * Coordinates as finally resolved — from the parser, the gazetteer, or a
   * reused location row. The fingerprint has to be built from these, not from
   * `ev.lat`: the parser rarely ships coordinates, so the key was written as
   * "nogps" and never revisited, leaving 48% of the catalog invisible to the
   * geohash half of duplicate detection.
   */
  let resolvedLat: number | null = ev.lat ?? null;
  let resolvedLng: number | null = ev.lng ?? null;
  if (ev.placeText) {
    let lat = ev.lat ?? null;
    let lng = ev.lng ?? null;
    let country = ev.countryHint ?? "CZ";
    let geocodeStatus = lat != null ? "ok" : "pending";
    let geocodeQuery = dedupeCommaParts(ev.placeText);
    if (lat == null) {
      try {
        const { geocodeFromGazetteer, cleanGeocodeQuery } = await import("@/lib/geocode");
        const placeLooksJunk = /^(uci\s*(c[123]|cn)|unknown|silnice)$/i.test(ev.placeText.trim());
        const source = placeLooksJunk && ev.name ? ev.name : ev.placeText;
        const cleaned = cleanGeocodeQuery(source, ev.countryHint);
        if (cleaned.query) geocodeQuery = cleaned.query;
        country = cleaned.countryCode || country;
        const geo =
          geocodeFromGazetteer(source, ev.countryHint) ||
          (placeLooksJunk ? geocodeFromGazetteer(ev.name, ev.countryHint) : null);
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
          country = geo.countryCode || cleaned.countryCode || country;
          geocodeStatus = "ok";
        }
      } catch {
        /* ignore */
      }
    }

    ingestCountry = country;
    if (!shouldIngestByCountry(country)) {
      return null;
    }

    // Reuse an existing location with same query + country (cuts geocode queue growth)
    let reuseQuery = supabase
      .from("locations")
      .select("id, lat, lng")
      .eq("geocode_query", geocodeQuery)
      .eq("country_code", country);
    /*
     * Same name is not same place: there are two Všetatys, and a parser pin at
     * one must not be swapped for the other's coordinates just because the
     * row says "Všetaty" too. With coordinates from the parser or gazetteer, share a row only
     * when it lies within a few kilometres of them.
     */
    if (lat != null && lng != null) {
      reuseQuery = reuseQuery
        .gte("lat", lat - 0.03)
        .lte("lat", lat + 0.03)
        .gte("lng", lng - 0.045)
        .lte("lng", lng + 0.045);
    }
    const { data: reused, error: reuseError } = await reuseQuery
      // Among duplicates always the same row: "last updated" sent a race to another
      // copy of its town on each read. Prefer one that already has coordinates.
      .order("lat", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (reuseError) throw new Error(`Reading reusable location: ${reuseError.message}`);
    if (reused?.id) {
      locationId = reused.id;
      if (reused.lat != null && reused.lng != null && !isCountryOnlyPlace(ev.placeText)) {
        lat = reused.lat;
        lng = reused.lng;
      }
      if (reused.lat == null && lat != null && lng != null) {
        pendingLocation = { action: "geocode", id: reused.id, expectedLat: reused.lat, expectedLng: reused.lng, lat, lng };
      }
    } else {
      locationId = randomUUID();
      pendingLocation = { action: "create", row: {
        id: locationId, name: ev.placeText, municipality: isCountryOnlyPlace(ev.placeText) ? null : geocodeQuery,
        country_code: country, lat, lng, geocode_query: geocodeQuery, geocode_status: geocodeStatus, timezone: timezoneForCountry(country),
      } };
    }

    resolvedLat = lat;
    resolvedLng = lng;
  }

  const { isNonRaceEventName } = await import("@/lib/event-visibility");
  const { isNonCyclingEventName, isVirtualRace } = await import("@/lib/sport-gate");
  // Regional calendars mix club triathlons and charity runs in with the road
  // races. Judge on the source's own words only — our inferred disciplines
  // cannot vouch for an entry, since a wrong discipline is what we are catching.
  const nonCycling = isNonCyclingEventName(
    ev.name,
    (ev.categories ?? []).map((c) => c.name).join(" "),
  );
  // A race held in software has no place on a map of where to drive on Sunday.
  const virtual = isVirtualRace(ev.name, ev.placeText);
  const hideAsNonRace = isNonRaceEventName(ev.name) || nonCycling || virtual;

  const existingRow = existingFull as {
    id?: string;
    name?: string;
    start_date?: string;
    end_date?: string;
    level?: string;
    uci_class?: string | null;
    class_label?: string | null;
    audience?: string | null;
    age_categories?: string[] | null;
    age_confidence?: string | null;
    disciplines?: string[] | null;
    status?: string | null;
    visibility?: string | null;
    website_url?: string | null;
    registration_opens_at?: string | null;
    registration_closes_at?: string | null;
  } | null;

  const { isCancelledRaceName, shouldTreatAsReschedule } = await import(
    "@/lib/plan-changes"
  );
  let beforeSnap: import("@/lib/plan-changes").EventSnapshot | null = null;
  if (existingId) {
    const { data: snap } = await supabase
      .from("events")
      .select("name, start_date, end_date, status, disciplines, registration_url")
      .eq("id", existingId)
      .maybeSingle();
    if (snap) {
      beforeSnap = {
        name: snap.name,
        startDate: snap.start_date,
        endDate: snap.end_date,
        status: snap.status,
        disciplines: snap.disciplines ?? [],
        registrationUrl: snap.registration_url,
      };
    }
  }

  const website = preferDeeperOfficialUrl(incomingWebsite, existingRow?.website_url ?? null);
  const registration = incomingRegistration;

  // A title carrying a double space or a stray newline is the same title with
  // worse typography, and it reaches the map, the page heading and Google.
  let mergedName = ev.name.replace(/\s+/g, " ").trim();
  let mergedStart = ev.startDate;
  let mergedEnd = ev.endDate ?? ev.startDate;
  let mergedLevel: { level: string; uciClass: string | null; classLabel: string | null } = {
    level: levelInfo.level,
    uciClass: levelInfo.uciClass,
    classLabel: levelInfo.classLabel,
  };

  if (existingId && existingRow?.start_date) {
    if (beforeSnap && shouldTreatAsReschedule(beforeSnap.startDate, ev.startDate)) {
      mergedStart = ev.startDate;
      mergedEnd = ev.endDate ?? ev.startDate;
    } else {
      const span = mergeDateSpan(
        { startDate: existingRow.start_date, endDate: existingRow.end_date },
        { startDate: ev.startDate, endDate: ev.endDate ?? ev.startDate },
      );
      mergedStart = span.startDate;
      mergedEnd = span.endDate;
    }
    mergedName = preferEventName(existingRow.name || mergedName, mergedName, ev.placeText)
      .replace(/\s+/g, " ")
      .trim();
    // Length is not authority: a legacy scraped teaser naming the 2025 edition
    // must not beat the current source's clean 2026 name for this same identity.
    if (overviewIssues({ name: mergedName, start_date: mergedStart, end_date: mergedEnd }, new Date().toISOString().slice(0, 10)).includes("name_year_conflict")) mergedName = ev.name.replace(/\s+/g, " ").trim();
    mergedLevel = preferLevel(
      {
        level: existingRow.level,
        uciClass: existingRow.uci_class,
        classLabel: existingRow.class_label,
      },
      {
        level: levelInfo.level,
        uciClass: levelInfo.uciClass,
        classLabel: levelInfo.classLabel,
      },
      classified.levelReason !== "default",
    );
  }

  // A calendar's off-by-one day must not undo a platform date independently
  // corroborated by the organiser's guide. Only investigate date conflicts.
  if (existingId && existingRow?.start_date && existingRow.start_date !== ev.startDate) {
    const { data: dateFacts } = await supabase.from("event_facts").select("field,value")
      .eq("event_id", existingId).eq("method", "raceresult_official_date").eq("status", "active")
      .in("field", ["start_date", "end_date"]).order("created_at", { ascending: false }).limit(2);
    const { verifiedDetailSpan } = await import("@/lib/catalog/raceresult-date");
    const verified = verifiedDetailSpan({ start: existingRow.start_date, end: existingRow.end_date ?? null }, ev.startDate, dateFacts ?? []);
    if (verified) {
      const { raceResultEventId, fetchRaceResultProgramme } = await import("@/lib/watcher/extractors/contest-categories");
      const eventId = raceResultEventId(beforeSnap?.registrationUrl) ?? raceResultEventId(existingRow.website_url);
      const programme = eventId ? await fetchRaceResultProgramme(eventId).catch(() => null) : null;
      // Re-read the platform so a real later reschedule can replace old evidence.
      if (!programme?.startDate || programme.startDate === verified.start && programme.endDate === verified.end) {
        mergedStart = verified.start; mergedEnd = verified.end;
      }
    }
  }

  // A listing that merely repeats other calendars does not move a date the
  // organiser's own pages or a series calendar still give. Without this the
  // race flipped between the two dates on every pass of the stale list.
  if (
    existingId && existingRow?.start_date && watchedKind === "aggregator" &&
    existingRow.start_date !== ev.startDate
  ) {
    const { startDateConfirmedOutsideAggregators } = await import("@/lib/catalog/source-evidence");
    if (await startDateConfirmedOutsideAggregators(supabase, existingId, existingRow.start_date)) {
      mergedStart = existingRow.start_date;
      mergedEnd = existingRow.end_date ?? existingRow.start_date;
    }
  }

  // Combine positive category evidence across sources. A stated list replaces
  // old defaults, while later guesses cannot widen already stated classes.
  const statedAges =
    ev.ageCategories?.length || classified.ageConfidence === "explicit"
      ? unionText(
          ev.ageCategories ?? [],
          classified.ageConfidence === "explicit" ? classified.ageCategories : [],
        )
      : null;
  // What a guess may do to a stored set depends on where that set came from:
  // stated categories are never widened by a default — a gravel race's
  // stated "U11" does not grow "amateur, masters" because it is gravel.
  const existingExplicit =
    existingRow?.age_confidence === "explicit" && (existingRow.age_categories ?? []).length > 0;
  const mergedAgeCategories = mergeStatedAges(existingRow?.age_categories, existingRow?.age_confidence, statedAges, overviewOnly ? [] : classified.ageCategories);
  const ageConfidence = statedAges?.length || existingExplicit
    ? "explicit"
    : mergedAgeCategories.length
      ? "default"
      : null;
  const mergedAudience = mergedAgeCategories.length
    ? audienceFromAgeCategories(
        mergedAgeCategories as import("@/lib/taxonomy").AgeCategory[],
      )
    : audience;

  const payload: Omit<Insert<"events">, "slug"> = {
    // Source prose only fills an empty description; organiser/manual copy wins.
    ...(ev.description?.trim() && watchedKind !== "aggregator" && !(existingFull as { description?: string | null } | null)?.description?.trim()
      ? { description: ev.description.trim().slice(0, 3000) } : {}),
    ...(ev.status === "cancelled" ? { status: "cancelled" } : {}),
    name: mergedName,
    name_normalized: normalizeName(mergedName),
    start_date: mergedStart,
    end_date: mergedEnd,
    // A source that names no discipline does not take away the one we hold.
    disciplines: disciplines.length ? disciplines : (existingRow?.disciplines ?? []),
    formats: classified.formats,
    audience: mergedAudience,
    age_categories: mergedAgeCategories,
    age_confidence: ageConfidence,
    // A source that distinguishes an RTF from a race knows better than a guess
    // from the title; only fall back to the classifier when it says nothing.
    // Nor does a title guess undo a race already judged a ride (by a reader
    // that saw more than the title).
    event_type: chooseEventType<string>(ev.eventType, (existingRow as { event_type?: string | null } | null)?.event_type, classified.eventType) as NonNullable<typeof classified.eventType>,
    competition_type: overviewOnly && classified.competitionType === "community" ? "other" : classified.competitionType,
    season: classified.season || mergedStart.slice(0, 4),
    timezone: timezoneForCountry(ev.countryHint),
    fingerprint: fingerprint({
      startDate: mergedStart,
      name: mergedName,
      lat: resolvedLat,
      lng: resolvedLng,
    }),
    ...(await import("@/lib/watcher/registration-deadline")).registrationWindowPayload(
      ev,
      existingRow,
    ),
    // Reading an official record again must not erase its established origin.
    source_kind: (existingFull as { source_kind?: string | null } | null)?.source_kind ?? "scraped",
    level: mergedLevel.level,
    class_label: overviewOnly && mergedLevel.classLabel === "Local" ? null : mergedLevel.classLabel ?? null,
    uci_class: mergedLevel.uciClass ?? null,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Never let another sport into the catalog in the first place. Rows that are
  // already here get hidden below instead, so a manual unhide still sticks.
  if (nonCycling && !existingId) return null;

  const { shouldSkipUnlinkedDumpInsert } = await import("@/lib/event-visibility");
  const skipDump = shouldSkipUnlinkedDumpInsert({
    websiteUrl: website,
    registrationUrl: registration,
    location: { countryCode: ingestCountry },
  });
  if (skipDump && !existingId) {
    return null;
  }

  if (hideAsNonRace && !lockedFields.includes("visibility")) {
    payload.visibility = "hidden";
    payload.event_type = "training";
  } else if (skipDump && !lockedFields.includes("visibility")) {
    payload.visibility = "hidden";
  } else if (!existingId && (ev.confidence < 0.5 || looksLikeTextFragment(ev.name))) {
    // A new row named with a slice of page text ("CYKLO�VEC s.r.o.",
    // "> Sa, | 09.00&ndash;17.00 Uhr …") is kept for its sources but not shown;
    // an existing row keeps its own, better name through preferEventName.
    payload.visibility = "hidden";
  }

  if (beforeSnap && isCancelledRaceName(mergedName) && !lockedFields.includes("status")) {
    payload.status = "cancelled";
  }

  // Only write website/registration when we have a real race URL (never wipe with aggregator)
  if (website) payload.website_url = website;
  else if (!existingId) payload.website_url = null;
  if (registration) payload.registration_url = registration;
  else if (!existingId) payload.registration_url = null;
  else if (incomingWebsite?.includes("enduroserie.cz")) {
    const { data: cur } = await supabase
      .from("events")
      .select("registration_url")
      .eq("id", existingId)
      .maybeSingle();
    if (isStartListUrl(cur?.registration_url as string | null)) {
      payload.registration_url = null;
    }
  }
  if (incomingRegulations) {
    let existingRegulations: string | null = null;
    if (existingId) {
      const { data: cur } = await supabase
        .from("events")
        .select("regulations_url")
        .eq("id", existingId)
        .maybeSingle();
      existingRegulations = (cur?.regulations_url as string | null) ?? null;
    }
    const regulations = preferRegulationsUrl(incomingRegulations, existingRegulations);
    if (regulations) payload.regulations_url = regulations;
  }

  if (incomingResults) payload.results_url = incomingResults;

  if (!lockedFields.includes("location_id") && locationId) {
    // A calendar that names only a federal state or a country must not undo a
    // town we have since found: the Austrian calendar did, every poll, and
    // the race page's start town was fetched again an hour later, again and
    // again, with a new location row each time.
    let keepCurrentPlace = false;
    if (existingId && (isGarbagePlace(ev.placeText) || isCountryOnlyPlace(ev.placeText))) {
      const { data: cur } = await supabase
        .from("events")
        .select("location:locations(municipality, lat)")
        .eq("id", existingId)
        .maybeSingle();
      const loc = (cur as { location?: { municipality?: string | null; lat?: number | null } | null } | null)?.location;
      keepCurrentPlace = Boolean(loc?.municipality && !isGarbagePlace(loc.municipality) && !isCountryOnlyPlace(loc.municipality));
    }
    // Only a race about to move costs this read; most re-reads name the row it already has.
    const heldLocationId = (existingFull as { location_id?: string | null } | null)?.location_id;
    if (existingId && !keepCurrentPlace && ev.placeText && heldLocationId && heldLocationId !== locationId) {
      const { data: held, error: placeError } = await supabase
        .from("locations")
        .select("municipality, name, geocode_query, country_code, lat, lng")
        .eq("id", heldLocationId)
        .maybeSingle();
      if (placeError) throw new Error(`Reading current place: ${placeError.message}`);
      keepCurrentPlace = isSamePlace(held as PlaceFacts | null, { query: dedupeCommaParts(ev.placeText), country: ingestCountry, lat: resolvedLat, lng: resolvedLng });
    }
    if (!keepCurrentPlace) payload.location_id = locationId;
  }

  // Prepare memberships without changing series or advancing race revisions.
  const currentSeriesId = existingFull && "series_id" in existingFull ? existingFull.series_id : null;
  const seriesPlans = new Map<string, WatcherSeriesPlan>();
  const pendingSeriesIds: string[] = [];
  if (!lockedFields.includes("series_id")) {
    const main = await prepareSeriesPlan(supabase, ev, classified, publicRaceUrl);
    if (main && await seriesAcceptsSource(supabase, main.website, watchedUrl)) {
      seriesPlans.set(main.slug, main);
      if (currentSeriesId && currentSeriesId !== main.id) pendingSeriesIds.push(main.id);
      else payload.series_id = main.id;
    }
  }
  // A locked primary membership can still have additional series.
  for (const extra of ev.alsoSeries ?? []) {
    if (lockedFields.includes("series_id") && !currentSeriesId) break;
    const plan = await prepareSeriesPlan(supabase, {
      ...ev, seriesName: extra.name || extra.slug, seriesSlug: extra.slug,
      seriesWebsite: extra.website, seriesAgeCategories: undefined, alsoSeries: undefined,
    }, classified, publicRaceUrl);
    if (!plan || seriesPlans.has(plan.slug) || !(await seriesAcceptsSource(supabase, plan.website, watchedUrl))) continue;
    seriesPlans.set(plan.slug, plan);
    pendingSeriesIds.push(plan.id);
  }

  preserveUnstatedDisciplines(existingFull as unknown as Record<string, unknown> | null, ev, payload as unknown as Record<string, unknown>);
  const protectedFields = [
    ...protectSpecificFacts(existingFull as unknown as Record<string, unknown> | null, payload as unknown as Record<string, unknown>),
    ...protectOfficialFields(watchedKind, existingFull as unknown as Record<string, unknown> | null, payload as unknown as Record<string, unknown>),
  ];
  if (protectedFields.length) console.info("watcher_source_conflict", JSON.stringify({ eventId: existingId, source: watchedUrl, protectedFields }));

  // The locked names come from the database as text, not as column names.
  for (const key of lockedFields) {
    delete (payload as Record<string, unknown>)[key];
  }
  if (lockedFields.some(key => ["name", "start_date", "location_id"].includes(key))) Reflect.deleteProperty(payload, "fingerprint");
  if (lockedFields.includes("name")) Reflect.deleteProperty(payload, "name_normalized");
  if (lockedFields.includes("start_date")) Reflect.deleteProperty(payload, "season");

  // Validate the merged, protected state too: valid incoming fields used to
  // preserve an old "completed" flag while moving the race into next season.
  const effective = { name: payload.name ?? existingRow?.name ?? ev.name,
    start_date: payload.start_date ?? existingRow?.start_date ?? ev.startDate,
    end_date: payload.end_date ?? existingRow?.end_date,
    status: payload.status ?? existingRow?.status };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Prague" });
  if (effective.status === "completed" && effective.start_date > today && !lockedFields.includes("status")) {
    payload.status = "scheduled";
    effective.status = "scheduled";
  }
  const mergedIssues = overviewIssues(effective, today);
  if (mergedIssues.length) throw new Error(`pipeline_data_review_required:${mergedIssues.join(",")}`);

  const acceptedSeriesPlans = [...seriesPlans.values()].filter(plan =>
    plan.id === payload.series_id || pendingSeriesIds.includes(plan.id),
  );
  const locationPlanId = pendingLocation?.action === "create" ? pendingLocation.row.id : pendingLocation?.id;
  const locationPlan = payload.location_id && payload.location_id === locationPlanId ? pendingLocation : null;

  let eventId = existingId;
  let created = false;
  let changed = false;
  if (review) {
    const { publishCandidatePlan } = await import("@/lib/discovery/publication");
    const slug = existingId ? undefined : await freeEventSlug(supabase, { name: ev.name, startDate: ev.startDate, place: ev.placeText });
    if (slug) (payload as Record<string, unknown>).slug = slug;
    const result = await publishCandidatePlan(supabase, review.publication, {
      eventId: existingId, revision: existingId ? (existingFull as { public_revision: string }).public_revision : undefined,
      payload, watchedUrlId, kind: watchedKind ?? "official", event: ev, location: locationPlan, secondarySeries: pendingSeriesIds, seriesPlans: acceptedSeriesPlans,
    });
    eventId = result.id; created = result.created; changed = result.changed;
  } else if (eventId) {
    const { updateEventPreservingKey } = await import("@/lib/watcher/write-event");
    const { retainedKey, changed: fieldsChanged } = await updateEventPreservingKey(supabase, eventId, payload, {
      revision: (existingFull as { public_revision: string }).public_revision,
      sourceUrl: ev.evidence?.sourceUrl ?? ev.sourceUrl, quote: ev.evidence?.quote, model: ev.evidence?.model,
      location: locationPlan, secondarySeries: pendingSeriesIds, seriesPlans: acceptedSeriesPlans, sourceKind: watchedKind,
      source: { watchedUrlId, kind: watchedKind ?? "official", event: ev },
    });
    changed = fieldsChanged;
    if (retainedKey) console.info("watcher_key_collision", JSON.stringify({ eventId, source: watchedUrl, retainedExistingKey: true }));
  } else {
    const slug = await freeEventSlug(supabase, { name: ev.name, startDate: ev.startDate, place: ev.placeText });
    const { createWatcherEvent } = await import("@/lib/watcher/write-event");
    const create = (slug: string) => createWatcherEvent(supabase, { ...payload, slug }, { watchedUrlId, kind: watchedKind ?? "official", event: ev, reviewed: Boolean(review) }, locationPlan, pendingSeriesIds, acceptedSeriesPlans);
    let data: { id: string } | null = null;
    let error: { code?: string; message: string } | null = null;
    try { data = await create(slug); }
    catch (cause) { if (!cause || typeof cause !== "object" || !("code" in cause) || cause.code !== "23505") throw cause; error = cause as { code: string; message: string }; }
    if (error) {
      if (error.code !== "23505") throw new Error(`Inserting race: ${error.message}`);
      /**
       * `events_fingerprint_key` is what stops two concurrent source fetches
       * from both creating the same race — but it surfaces here as an insert
       * error, and the row the other run just wrote is the one we wanted. Adopt
       * it instead of failing the watch or minting a second slug.
       */
      const { data: raced, error: collisionReadError } = await supabase
        .from("events")
        .select(fpCols)
        .eq("fingerprint", payload.fingerprint!)
        .maybeSingle();
      if (collisionReadError) throw new Error(`Reading fingerprint owner: ${collisionReadError.message}`);
      if (raced?.id) {
        if (!pickIncomingDuplicate(incomingDedup, [asCandidate(raced as unknown as CandidateRow)])) {
          throw new Error(`identity_review_required: conflicting fingerprint owned by ${raced.id}`);
        }
        // The winning row needs a fresh revision and complete enrichment plan.
        throw new Error("concurrent_event_update: matching race was created while preparing the import");
      } else {
        // Not a fingerprint clash — a slug collision with an unrelated race.
        const d2 = await create(`${slug}-${Date.now().toString(36)}`);
        eventId = d2?.id;
        created = Boolean(eventId);
      }
    } else {
      if (!data) throw Error("New race transaction returned no result");
      eventId = data.id;
      created = true;
    }
  }

  if (!eventId) throw new Error("Race write returned no id");




  return { id: eventId, created, changed };
}

/** Explicitly reviewed assertion; uses all normal identity, lock and evidence protections. */
export async function ingestReviewedCandidate(row: ReviewRow, decision: ReviewDecision, publication: import("@/lib/discovery/publication").CandidatePublication) {
  const { validateReviewSource } = await import("@/lib/discovery/review-source");
  const { catalogueWindow } = await import("@/lib/catalog/overview-quality");
  // Do not trust a calling script to have run the evidence gate. Re-read just
  // before writing; the source may have changed since its preview/claim.
  await validateReviewSource(row, decision, catalogueWindow().from);
  const event = row.payload as unknown as ParsedEvent;
  if (publication.id !== row.id || publication.evidenceHash !== row.evidence_hash || !publication.token) throw Error("Missing candidate publication claim");
  const review = { publication, sourceUrl: row.source_url, authority: decision.authority!, expectedEventId: decision.expectedEventId!, watchedUrlId: row.watched_url_id };
  const db = createServerSupabase();
  const { canonicalExploreUrl } = await import("./explore");
  const { data: links, error: linkError } = await db.from("discovered_links").select("status").eq("url", canonicalExploreUrl(review.sourceUrl)!);
  if (linkError) throw linkError;
  if (links?.some(link => ["rejected", "ignored"].includes(link.status))) throw Error("Source was explicitly rejected/ignored");
  let source: { id: string; url: string; status: string; added_by: string | null } | undefined;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("watched_urls").select("id,url,status,added_by").order("id").range(from, from + 999);
    if (error) throw error;
    const matches = data.filter(r => r.id === review.watchedUrlId || canonicalExploreUrl(r.url) === canonicalExploreUrl(review.sourceUrl));
    if (matches.some(r => r.status !== "active" && r.added_by !== "pipeline_review")) throw new Error("Source is paused/dead; explicit source review required");
    source ??= matches[0];
    if (data.length < 1000) break;
  }
  if (!source) {
    const { error } = await db.from("watched_urls").upsert({ url: review.sourceUrl, kind: review.authority === "national_federation" ? "federation" : review.authority === "series" ? "series" : "race",
      status: "paused", added_by: "pipeline_review", notes: "Evidence-only source. Only individually reviewed assertions may be published; monitoring is not activated." }, { onConflict: "url", ignoreDuplicates: true });
    if (error) throw error;
    const { data, error: readError } = await db.from("watched_urls").select("id,url,status,added_by").eq("url", review.sourceUrl).single();
    if (readError) throw readError;
    if (data.status !== "active" && data.added_by !== "pipeline_review") throw new Error("Source changed concurrently");
    source = data;
  }
  const result = await upsertParsedEvent(event, source.id, review.authority === "national_federation" ? "federation" : review.authority === "series" ? "series" : "race", source.url, review);
  if (!result) throw new Error("Reviewed assertion was rejected by ingestion policy");
  return result;
}

/** Explicit, source-verified 2026 backfill through the normal protected writer. */
export async function ingestNakoleArchiveEvent(ev: ParsedEvent, watchedUrlId: string) {
  const { isNakoleUrl, NAKOLE_VERSION } = await import("./extractors/nakole");
  const today = new Date().toISOString().slice(0, 10);
  if (!isNakoleUrl(ev.sourceUrl) || ev.evidence?.method !== "nakole_detail" ||
    ev.evidence.version !== NAKOLE_VERSION || ev.evidence.sourceUrl !== ev.sourceUrl ||
    ev.eventType !== "race" || !ev.startDate.startsWith("2026-") || (ev.endDate ?? ev.startDate) >= today) {
    throw new Error("Not a verified historical 2026 NaKole race");
  }
  return upsertParsedEvent(ev, watchedUrlId, "aggregator", "https://www.nakole.cz/akce/archiv/");
}

export async function previewUrl(url: string) {
  const fetched = await fetchPage(url);
  if (fetched.status >= 400) {
    return { ok: false as const, error: `HTTP ${fetched.status}`, events: [] as ParsedEvent[] };
  }
  const extracted = await extractEvents(url, fetched.html);
  return {
    ok: true as const,
    strategy: extracted.strategy,
    confidence: extracted.confidence,
    events: extracted.events,
    childUrls: extracted.childUrls,
  };
}

/** Does the catalogue still hold races ahead of today that came from this source? */
async function sourceHasAnyEvents(
  supabase: ReturnType<typeof createServerSupabase>,
  watchedUrlId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("event_sources")
    .select("event_id", { count: "exact", head: true })
    .eq("watched_url_id", watchedUrlId);
  return (count ?? 0) > 0;
}

async function sourceHasUpcomingEvents(
  supabase: ReturnType<typeof createServerSupabase>,
  watchedUrlId: string,
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabase
    .from("event_sources")
    .select("event_id, event:events!inner(id, start_date, visibility)", { count: "exact", head: true })
    .eq("watched_url_id", watchedUrlId)
    .eq("event.visibility", "public")
    .gte("event.start_date", today);
  return (count ?? 0) > 0;
}
