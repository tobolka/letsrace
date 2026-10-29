import { canonicalExploreUrl } from "../src/lib/watcher/explore";
import { createHash } from "node:crypto";
import { pageAsText } from "../src/lib/watcher/extractors/llm-calendar";
/** Export candidates; apply an explicit evidence-bound decision manifest. Dry-run by default. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parse } from "dotenv";
import { createServerSupabase } from "../src/lib/supabase/server";
import { validateReview, type ReviewDecision } from "../src/lib/discovery/review";
import { fetchPage } from "../src/lib/watcher/http";
import { ingestReviewedCandidate } from "../src/lib/watcher/run";
import { catalogueWindow } from "../src/lib/catalog/overview-quality";
import type { ParsedEvent } from "../src/lib/domain";
import type { Json } from "../src/lib/supabase/database.types";

async function main() {
  for (const [key, value] of Object.entries(parse(await readFile(".env.local", "utf8")))) process.env[key] ??= value;
  const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const db = createServerSupabase(), path = arg("decisions"), apply = process.argv.includes("--apply");
  if (apply && !path) throw new Error("--apply requires an explicit --decisions manifest");
  if (!path) {
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
  const decisions = JSON.parse(await readFile(path, "utf8")) as ReviewDecision[];
  if (!Array.isArray(decisions) || new Set(decisions.map(d => d.id)).size !== decisions.length) throw new Error("Expected unique candidate decisions");
  const outcomes = [];
  for (const decision of decisions) {
    const { data: row, error } = await db.from("pipeline_candidates").select("*").eq("id", decision.id).single();
    if (error) throw error;
    if (row.status === "published" && row.evidence_hash === decision.evidenceHash && decision.action === "publish") {
      outcomes.push({ id: row.id, status: "already_published", eventId: row.event_id }); continue;
    }
    validateReview(row, decision, catalogueWindow().from);
    if (["published", "publishing", "rejected"].includes(row.status)) throw new Error(`Cannot replace terminal/in-flight decision ${row.id}`);
    if (decision.action !== "publish") {
      if (apply) {
        const { data, error } = await db.from("pipeline_candidates").update({ status: decision.action === "reject" ? "rejected" : "waiting", decision: decision as unknown as Json, updated_at: new Date().toISOString() }).eq("id", row.id).eq("status", row.status).select("id");
        if (error || data?.length !== 1) throw new Error(error?.message ?? "Candidate changed concurrently");
      }
      outcomes.push({ id: row.id, action: decision.action, applied: apply }); continue;
    }
    const source = await fetchPage(row.source_url, { fresh: true });
    const evidence = row.evidence as { documentHash: string; textHash?: string };
    const needsRawDocument = (row.payload as unknown as ParsedEvent).evidence?.method === "structured_calendar";
    const sameDocument = evidence.textHash && !needsRawDocument ? createHash("sha256").update(pageAsText(source.html, row.source_url).text).digest("hex") === evidence.textHash : source.hash === evidence.documentHash;
    if (source.status !== 200 || !sameDocument) throw new Error(`Source changed or unavailable: ${row.id}; re-read and review`);
    // No automatic resurrection of paused/rejected sources.
    const { data: links, error: linkError } = await db.from("discovered_links").select("status").eq("url", canonicalExploreUrl(row.source_url)!);
    if (linkError) throw linkError;
    if (links?.some(l => ["rejected", "ignored"].includes(l.status))) throw new Error("Source was explicitly rejected/ignored");
    if (!apply) { outcomes.push({ id: row.id, action: "publish", applied: false, expectedEventId: decision.expectedEventId }); continue; }
    const { data: claim, error: claimError } = await db.from("pipeline_candidates").update({ status: "publishing", decision: decision as unknown as Json, updated_at: new Date().toISOString() }).eq("id", row.id).eq("status", row.status).select("id");
    if (claimError || claim?.length !== 1) throw new Error(claimError?.message ?? "Candidate claimed concurrently");
    // Leave interrupted writes visibly in publishing. Never silently retry a
    // potentially partial multi-step write or publish another duplicate.
    const result = await ingestReviewedCandidate(row.payload as unknown as ParsedEvent, {
      sourceUrl: row.source_url, authority: decision.authority!, expectedEventId: decision.expectedEventId!, watchedUrlId: row.watched_url_id,
    });
    const { error: saved } = await db.from("pipeline_candidates").update({ status: "published", event_id: result.id, updated_at: new Date().toISOString() }).eq("id", row.id).eq("status", "publishing");
    if (saved) throw saved;
    outcomes.push({ id: row.id, status: "published", eventId: result.id, created: result.created });
  }
  await mkdir("tmp", { recursive: true });
  await writeFile("tmp/discovery-review-result.json", JSON.stringify(outcomes, null, 2));
  console.log(outcomes);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
