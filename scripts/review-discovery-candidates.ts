import { canonicalExploreUrl } from "../src/lib/watcher/explore";
/** Export candidates; apply an explicit evidence-bound decision manifest. Dry-run by default. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "dotenv";
import { createServerSupabase } from "../src/lib/supabase/server";
import { validateReview, type ReviewDecision } from "../src/lib/discovery/review";
import { ReviewSourceChangedError, validateReviewSource } from "../src/lib/discovery/review-source";
import { ingestReviewedCandidate } from "../src/lib/watcher/run";
import { catalogueWindow } from "../src/lib/catalog/overview-quality";
import type { Json } from "../src/lib/supabase/database.types";

const PERMANENT_REVIEW_ERROR_PATTERNS = [
  /identity_review_required/,
  /pipeline_data_review_required/,
  /Reviewed assertion was rejected by ingestion policy/,
  /Source was explicitly rejected\/ignored/,
  /Source is paused\/dead; explicit source review required/,
  /Reviewed identity is no longer public/,
  /Candidate publication plan differs from reviewed assertion/,
  /differs from (?:the )?current/,
  /differs from the actual competition component/,
  /Review quote is not present in the source document/,
  /UCI component evidence changed or is not present/,
  /Supplementary place evidence changed or is not present/,
  /Invalid supplementary (?:evidence|place source)/,
  /Supplementary evidence requires a supported structured reader/,
  /Not a (?:UCI directory competition|radsport-events\.de event)/,
  /Out-of-scope or tentative candidate cannot be published/,
  /Missing place, country or discipline/,
  /Basic data conflict requires review/,
  /Candidate is outside its reviewed future edition/,
  /Missing (?:date|end-date) evidence/,
  /Edition year must be explicitly stated in evidence/,
  /Evidence belongs to another source/,
  /Explicit reviewed identity required/,
  /Basic facts and source authority must be reviewed/,
];

export function formatPublishError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return "Publication interrupted";
}

export function classifyCandidatePublishError(error: unknown): "review_required" | "retry" {
  if (error instanceof ReviewSourceChangedError) return "review_required";
  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : "";
  return PERMANENT_REVIEW_ERROR_PATTERNS.some(pattern => pattern.test(message)) ? "review_required" : "retry";
}

export function buildReviewRequiredUpdate(decision: ReviewDecision, error: unknown, now = new Date().toISOString()) {
  const message = formatPublishError(error);
  return {
    status: "waiting" as const,
    publish_token: null,
    publish_lease_until: null,
    publish_error: message,
    decision: {
      previousPublication: decision,
      followUp: { version: 1, attempts: 0, failures: 0, needsReview: true, nextCheckAt: now, documents: [] },
    } as unknown as Json,
    updated_at: now,
  };
}

export async function loadResumeDecisions(
  db: ReturnType<typeof createServerSupabase>,
  nowIso = new Date().toISOString(),
  limit = 3,
): Promise<ReviewDecision[]> {
  // Prefer fresh interrupted publications (publish_error IS NULL) so previously
  // errored rows waiting on retries cannot starve valid in-flight candidates.
  const { data: fresh, error: freshError } = await db
    .from("pipeline_candidates")
    .select("decision")
    .eq("status", "publishing")
    .not("publish_token", "is", null)
    .is("publish_error", null)
    .lte("publish_lease_until", nowIso)
    .order("publish_lease_until")
    .limit(limit);
  if (freshError) throw freshError;

  const rows = [...fresh];
  if (rows.length < limit) {
    const { data: retried, error: retryError } = await db
      .from("pipeline_candidates")
      .select("decision")
      .eq("status", "publishing")
      .not("publish_token", "is", null)
      .not("publish_error", "is", null)
      .lte("publish_lease_until", nowIso)
      .order("publish_lease_until")
      .limit(limit - rows.length);
    if (retryError) throw retryError;
    rows.push(...retried);
  }

  return rows.map(row => {
    const decision = { ...(row.decision as unknown as ReviewDecision & { reviewedAt?: string }) };
    delete decision.reviewedAt;
    return decision;
  });
}

export async function settleCandidatePublishError(params: {
  db: ReturnType<typeof createServerSupabase>;
  row: { id: string; evidence_hash: string };
  decision: ReviewDecision;
  token: string;
  error: unknown;
  now?: string;
}): Promise<{ id: string; status: "review_required"; error: string }> {
  const { db, row, decision, token, error } = params;
  if (classifyCandidatePublishError(error) === "review_required") {
    const now = params.now ?? new Date().toISOString();
    const patch = buildReviewRequiredUpdate(decision, error, now);
    const { data: requeued, error: requeueError } = await db
      .from("pipeline_candidates")
      .update(patch)
      .eq("id", row.id)
      .eq("status", "publishing")
      .eq("publish_token", token)
      .eq("evidence_hash", row.evidence_hash)
      .gt("publish_lease_until", now)
      .select("id");
    if (requeueError || requeued?.length !== 1) {
      throw Error(requeueError?.message ?? "Candidate changed during review requeue", { cause: error });
    }
    return { id: row.id, status: "review_required", error: patch.publish_error };
  }
  const retry = await db.rpc("pipeline_retry_candidate", {
    p_id: row.id,
    p_token: token,
    p_error: formatPublishError(error),
  });
  if (retry.error) throw Error(`Recording publication retry: ${retry.error.message}`, { cause: error });
  // A lost response may follow a successful commit. Never clear that receipt.
  throw error;
}

export async function requeuePreClaimPublishingCandidate(params: {
  db: ReturnType<typeof createServerSupabase>;
  row: { id: string; status: string; publish_token?: string | null; evidence_hash: string; updated_at: string };
  decision: ReviewDecision;
  error: unknown;
  now?: string;
}): Promise<{ id: string; status: "review_required"; error: string } | null> {
  const { db, row, decision, error } = params;
  if (row.status !== "publishing" || !row.publish_token || classifyCandidatePublishError(error) !== "review_required") {
    return null;
  }
  const now = params.now ?? new Date().toISOString();
  const patch = buildReviewRequiredUpdate(decision, error, now);
  const { data: requeued, error: requeueError } = await db
    .from("pipeline_candidates")
    .update(patch)
    .eq("id", row.id)
    .eq("status", "publishing")
    .eq("publish_token", row.publish_token)
    .eq("evidence_hash", row.evidence_hash)
    .eq("updated_at", row.updated_at)
    .select("id");
  if (requeueError || requeued?.length !== 1) {
    throw Error(requeueError?.message ?? "Candidate changed during review requeue", { cause: error });
  }
  return { id: row.id, status: "review_required", error: patch.publish_error };
}

async function main() {
  for (const [key, value] of Object.entries(parse(await readFile(".env.local", "utf8")))) process.env[key] ??= value;
  const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const db = createServerSupabase(), path = arg("decisions"), apply = process.argv.includes("--apply"), resume = process.argv.includes("--resume");
  if (resume && path) throw Error("Use either --resume or an explicit manifest");
  const deadline = Math.min(Date.now() + 180_000, Number(process.env.SOURCE_RUN_DEADLINE || 0) * 1000 || Infinity);
  if (apply && !path && !resume) throw new Error("--apply requires an explicit --decisions manifest");
  if (!path && !resume) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from("pipeline_candidates").select("*").in("status", ["pending", "waiting", "conflict", "publishing"]).order("created_at").order("id").range(offset, offset + 499);
      if (error) throw error;
      rows.push(...data); if (data.length < 500) break;
    }
    await mkdir("tmp", { recursive: true });
    await writeFile("tmp/discovery-review.json", JSON.stringify(rows, null, 2));
    console.log({ candidates: rows.length, export: "tmp/discovery-review.json", eventWrites: 0 }); return;
  }
  let decisions: ReviewDecision[];
  if (resume) {
    // Only an already approved, tokenized transaction is eligible. No fresh approvals.
    decisions = await loadResumeDecisions(db);
  } else decisions = JSON.parse(await readFile(path!, "utf8")) as ReviewDecision[];
  if (!Array.isArray(decisions) || new Set(decisions.map(d => d.id)).size !== decisions.length) throw new Error("Expected unique candidate decisions");
  const outcomes = [];
  for (const decision of decisions) {
    if (Date.now() + 30_000 >= deadline) break;
    try {
    const { data: row, error } = await db.from("pipeline_candidates").select("*").eq("id", decision.id).single();
    if (error) throw error;
    if (row.status === "published" && row.evidence_hash === decision.evidenceHash && decision.action === "publish") {
      outcomes.push({ id: row.id, status: "already_published", eventId: row.event_id }); continue;
    }
    try {
      // Only tokenized publications can be resumed; old partial writes need inspection.
      const reviewRow = row.status === "publishing" && row.publish_token ? { ...row, status: "pending" } : row;
      validateReview(reviewRow, decision, catalogueWindow().from);
      if (["published", "rejected"].includes(row.status) || row.status === "publishing" && (!row.publish_token || decision.action !== "publish")) throw new Error(`Cannot replace terminal/in-flight decision ${row.id}`);
      if (decision.action !== "publish") {
        if (apply) {
          const reviewedAt = new Date().toISOString();
          const { data, error } = await db.from("pipeline_candidates").update({ status: decision.action === "reject" ? "rejected" : "waiting", decision: { ...decision, reviewedAt } as unknown as Json, updated_at: reviewedAt }).eq("id", row.id).eq("status", row.status).eq("updated_at", row.updated_at).select("id");
          if (error || data?.length !== 1) throw new Error(error?.message ?? "Candidate changed concurrently");
        }
        outcomes.push({ id: row.id, action: decision.action, applied: apply }); continue;
      }
      if (!apply) await validateReviewSource(reviewRow, decision, catalogueWindow().from);
      // No automatic resurrection of paused/rejected sources.
      const { data: links, error: linkError } = await db.from("discovered_links").select("status").eq("url", canonicalExploreUrl(row.source_url)!);
      if (linkError) throw linkError;
      if (links?.some(l => ["rejected", "ignored"].includes(l.status))) throw new Error("Source was explicitly rejected/ignored");
      if (!apply) { outcomes.push({ id: row.id, action: "publish", applied: false, expectedEventId: decision.expectedEventId }); continue; }
      const { data: claim, error: claimError } = await db.rpc("pipeline_claim_candidate", {
        p_id: row.id, p_hash: row.evidence_hash, p_updated: row.updated_at, p_decision: decision as unknown as Json,
        p_retry_resolved: !resume && Boolean(row.publish_error),
      });
      if (claimError) throw Error(`Claiming candidate: ${claimError.message}`);
      const receipt = claim as { status?: string; token?: string } | null;
      if (!receipt?.token || receipt.status !== "publishing") throw Error("Candidate claim was not confirmed");
      let result;
      try {
        result = await ingestReviewedCandidate(reviewRow, decision, { id: row.id, evidenceHash: row.evidence_hash, token: receipt.token });
      } catch (error) {
        const settled = await settleCandidatePublishError({ db, row, decision, token: receipt.token, error });
        outcomes.push(settled);
        process.exitCode = 2;
        continue;
      }
      outcomes.push({ id: row.id, status: "published", eventId: result.id, created: result.created });
    } catch (preClaimError) {
      if (resume && apply) {
        const settled = await requeuePreClaimPublishingCandidate({ db, row, decision, error: preClaimError });
        if (settled) {
          outcomes.push(settled);
          process.exitCode = 2;
          continue;
        }
      }
      throw preClaimError;
    }
    } catch (error) {
      if (!apply && !resume) throw error;
      outcomes.push({ id: decision.id, status: "deferred", error: formatPublishError(error) });
      process.exitCode = 2;
    }
  }
  await mkdir("tmp", { recursive: true });
  await writeFile("tmp/discovery-review-result.json", JSON.stringify(outcomes, null, 2));
  console.log(outcomes);
}
const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) main().catch(error => { console.error(error); process.exitCode = 1; });
