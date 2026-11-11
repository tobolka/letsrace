/**
 * A thin layer over the queue the server already has (pipeline_claim_tasks, pipeline_finish_task,
 * pipeline_retry_task). It adds no leases of its own. What it adds: why an attempt ended, as one
 * of a fixed list of reasons; how long to wait after each kind of ending; and a strict check of
 * what a reader hands back. See docs/pipeline-v2.md, parts 1 and 2.
 */

export type Outcome = "done" | "partial" | "timeout" | "blocked" | "waiting" | "failed";
/** Why an attempt did not finish. A fixed list: free text cannot be counted or acted on. */
export const REASONS = [
  "robot_check", "sign_in", "timeout", "partial", "shape_changed", "empty_but_dated", "http_error",
  "no_document_yet", "ai_budget", "capability_missing", "bad_output", "crashed",
] as const;
export type Reason = typeof REASONS[number];
export type Ended = { outcome: Outcome; reason: Reason | null };

const HOUR = 3600, DAY = 24 * HOUR;
/** After a real failure: 1 h, 6 h, 1 day, 3 days, then a week for the fifth and every later one. */
export const FAILURE_DELAYS = [HOUR, 6 * HOUR, DAY, 3 * DAY, 7 * DAY];
export const STOP_AFTER = FAILURE_DELAYS.length;
/** Endings that say the work itself is broken. The rest are circumstances. */
const REAL_FAILURES: Reason[] = ["timeout", "shape_changed", "empty_but_dated", "http_error", "bad_output", "crashed"];

export const isFailure = (ended: Ended) => (ended.outcome === "failed" || ended.outcome === "timeout") && (ended.reason == null || REAL_FAILURES.includes(ended.reason));

/**
 * How long a task waits before its next attempt, and whether it is now stopped.
 * `failuresBefore` is how many real failures in a row came before this attempt.
 */
export function nextAttempt(ended: Ended, failuresBefore: number, opts: { usualSeconds?: number; untilBudgetSeconds?: number } = {}): { delaySeconds: number; failures: number; stopped: boolean } {
  const usual = opts.usualSeconds ?? DAY;
  if (isFailure(ended)) {
    const failures = failuresBefore + 1;
    return { delaySeconds: FAILURE_DELAYS[Math.min(failures, STOP_AFTER) - 1]!, failures, stopped: failures >= STOP_AFTER };
  }
  // Circumstances keep the count: they neither add a failure nor forgive earlier ones.
  const keep = { failures: failuresBefore, stopped: failuresBefore >= STOP_AFTER };
  if (ended.outcome === "partial") return { delaySeconds: 60, ...keep };
  if (ended.reason === "ai_budget") return { delaySeconds: opts.untilBudgetSeconds ?? 6 * HOUR, ...keep };
  if (ended.reason === "capability_missing") return { delaySeconds: HOUR, ...keep };
  // Kept out by the other side, or nothing published yet: ask again at the usual pace.
  return { delaySeconds: usual, ...keep };
}

/** Real failures in a row at the end of a task's attempts, oldest first. */
export function failuresInARow(attempts: { outcome: string | null; error: string | null }[]): number {
  let count = 0;
  for (let i = attempts.length - 1; i >= 0; i--) {
    const attempt = attempts[i]!;
    if (attempt.outcome === "done") break;
    if (attempt.outcome !== "retry") continue;
    const [outcome, reason] = (attempt.error ?? "").split(":");
    if (isFailure({ outcome: outcome as Outcome, reason: (reason || null) as Reason | null })) count++;
    else if (outcome === "partial") break;
  }
  return count;
}

export type Proposal = { event_id: string; field: string; value: string; source_url: string; quote: string; reader: string; version: string };
export type ReaderOutput = Ended & { proposals: Proposal[]; stats?: Record<string, number> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK = /^https?:\/\/[^\s]+$/;

/**
 * What a reader handed back, taken as data and nothing else. A reader works with other people's
 * pages and without our keys; whatever it returns is checked here before the part that holds the
 * keys does anything with it. Anything out of shape refuses the whole output.
 */
export function checkReaderOutput(raw: unknown, allowed: { eventIds: Iterable<string>; fields: string[]; reader: string }): { ok: true; output: ReaderOutput } | { ok: false; why: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, why: "not an object" };
  const data = raw as Record<string, unknown>;
  if (!["done", "partial", "timeout", "blocked", "waiting", "failed"].includes(data.outcome as string)) return { ok: false, why: "unknown outcome" };
  if (data.reason != null && !REASONS.includes(data.reason as Reason)) return { ok: false, why: "unknown reason" };
  if (!Array.isArray(data.proposals)) return { ok: false, why: "proposals is not a list" };
  if (data.proposals.length > 200) return { ok: false, why: "too many proposals" };
  const events = new Set(allowed.eventIds);
  const proposals: Proposal[] = [];
  for (const item of data.proposals as Record<string, unknown>[]) {
    if (typeof item !== "object" || item === null) return { ok: false, why: "a proposal is not an object" };
    const { event_id, field, value, source_url, quote, reader, version } = item;
    if (typeof event_id !== "string" || !UUID.test(event_id) || !events.has(event_id)) return { ok: false, why: "a proposal names a race this task was not given" };
    if (typeof field !== "string" || !allowed.fields.includes(field)) return { ok: false, why: "a proposal names a field this task may not fill" };
    if (typeof value !== "string" || !LINK.test(value) || value.length > 2000) return { ok: false, why: "a value is not a link" };
    if (typeof source_url !== "string" || !LINK.test(source_url) || source_url.length > 2000) return { ok: false, why: "a source is not a link" };
    if (typeof quote !== "string" || quote.trim().length < 8) return { ok: false, why: "a quote is missing" };
    if (reader !== allowed.reader || typeof version !== "string" || !/^[\w.-]{1,20}$/.test(version)) return { ok: false, why: "reader or version is not the expected one" };
    proposals.push({ event_id, field, value, source_url, quote: quote.slice(0, 500), reader, version });
  }
  const stats: Record<string, number> = {};
  if (typeof data.stats === "object" && data.stats !== null) for (const [key, n] of Object.entries(data.stats)) if (typeof n === "number" && Number.isFinite(n) && /^\w{1,30}$/.test(key)) stats[key] = n;
  return { ok: true, output: { outcome: data.outcome as Outcome, reason: (data.reason ?? null) as Reason | null, proposals, stats } };
}
