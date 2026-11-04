import { canonicalExploreUrl } from "../src/lib/watcher/explore";
/** Export candidates; apply an explicit evidence-bound decision manifest. Dry-run by default. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parse } from "dotenv";
import { createServerSupabase } from "../src/lib/supabase/server";
import { validateReview, type ReviewDecision } from "../src/lib/discovery/review";
import { validateReviewSource } from "../src/lib/discovery/review-source";
import { ingestReviewedCandidate } from "../src/lib/watcher/run";
import { catalogueWindow } from "../src/lib/catalog/overview-quality";
import type { Json } from "../src/lib/supabase/database.types";

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
    const { data, error } = await db.from("pipeline_candidates").select("decision")
      .eq("status", "publishing").not("publish_token", "is", null)
      .lte("publish_lease_until", new Date().toISOString()).order("publish_lease_until").limit(3);
    if (error) throw error;
    decisions = data.map(row => {
      const decision = { ...(row.decision as unknown as ReviewDecision & { reviewedAt?: string }) };
      delete decision.reviewedAt;
      return decision;
    });
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
      const retry = await db.rpc("pipeline_retry_candidate", { p_id: row.id, p_token: receipt.token, p_error: error instanceof Error ? error.message : "Publication interrupted" });
      if (retry.error) throw Error(`Recording publication retry: ${retry.error.message}`, { cause: error });
      // A lost response may follow a successful commit. Never clear that receipt.
      throw error;
    }
    outcomes.push({ id: row.id, status: "published", eventId: result.id, created: result.created });
    } catch (error) {
      if (!resume) throw error;
      outcomes.push({ id: decision.id, status: "deferred", error: error instanceof Error ? error.message : "Publication interrupted" });
      process.exitCode = 2;
    }
  }
  await mkdir("tmp", { recursive: true });
  await writeFile("tmp/discovery-review-result.json", JSON.stringify(outcomes, null, 2));
  console.log(outcomes);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
