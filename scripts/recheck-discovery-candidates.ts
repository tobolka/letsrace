/** Bounded free follow-up of waiting assertions. Never writes events or approvals. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { createServerSupabase } from "../src/lib/supabase/server";
import { fetchPage } from "../src/lib/watcher/http";
import { pageAsText } from "../src/lib/watcher/extractors/llm-calendar";
import { discoveryUrl } from "../src/lib/discovery/plan";
import { decisionObject, followUpDue, followUpOf, followUpUrls, finishFollowUp, type FollowUpDocument } from "../src/lib/discovery/follow-up";
import { writeJsonAtomic } from "../src/lib/catalog/local-source-cache";
import type { Json } from "../src/lib/supabase/database.types";

async function main() {
  for (const [key, value] of Object.entries(parse(await readFile(".env.local", "utf8")))) process.env[key] ??= value;
  const apply = process.argv.includes("--apply");
  const max = Number(process.argv.find(arg => arg.startsWith("--max="))?.slice(6) ?? 20);
  if (!Number.isInteger(max) || max < 1 || max > 100) throw Error("--max must be 1–100");
  const started = Date.now();
  const deadline = Math.min(started + 180_000, Number(process.env.SOURCE_RUN_DEADLINE || 0) * 1000 || Infinity);
  const db = createServerSupabase();
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("pipeline_candidates").select("*")
      .in("status", ["pending", "waiting", "conflict"]).order("updated_at").order("id").range(offset, offset + 499);
    if (error) throw Error(`Reading candidate follow-ups: ${error.message}`);
    rows.push(...data); if (data.length < 500) break;
  }
  const due = rows.filter(row => followUpDue(row, started)).slice(0, max);
  const urls = [...new Set(due.flatMap(followUpUrls))];
  const blocked = new Set<string>();
  // Compare normalized URLs too: a tracking suffix must not bypass a pause.
  for (const table of urls.length ? ["watched_urls", "discovered_links"] as const : []) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from(table).select("url,status").order("id").range(offset, offset + 999);
      if (error) throw Error(`Reading ${table} source policy: ${error.message}`);
      for (const row of data) {
        const url = discoveryUrl(row.url);
        if (url && urls.includes(url) && (table === "watched_urls" ? row.status !== "active" : ["rejected", "ignored"].includes(row.status))) blocked.add(url);
      }
      if (data.length < 1000) break;
    }
  }
  const documents = new Map<string, Promise<FollowUpDocument>>();
  let networkReads = 0;
  const directory = resolve("tmp/candidate-follow-ups");
  const read = (url: string): Promise<FollowUpDocument> => {
    if (!documents.has(url)) documents.set(url, (async () => {
      if (blocked.has(url)) return { url, outcome: "blocked", error: "source_paused_or_rejected" };
      let doc;
      try { networkReads++; doc = await fetchPage(url, { fresh: true, retries: 0, timeoutMs: 15_000 }); }
      catch { return { url, outcome: "unavailable", error: "source_read_failed" }; }
      if (doc.status !== 200) return { url, outcome: "unavailable", error: `HTTP ${doc.status}` };
      const text = pageAsText(doc.html, url).text;
      if (!text.trim()) return { url, outcome: "unavailable", error: "empty_source_text" };
      const textHash = createHash("sha256").update(text).digest("hex");
      const snapshot = resolve(directory, `${createHash("sha256").update(url).digest("hex")}-${doc.hash}.json`);
      // Archive failures are worker failures, never mislabeled as a bad source.
      await writeJsonAtomic(snapshot, { url, fetchedAt: new Date().toISOString(), documentHash: doc.hash, textHash, html: doc.html, text });
      return { url, outcome: "read", documentHash: doc.hash, textHash, snapshot };
    })());
    return documents.get(url)!;
  };
  const outcomes = [];
  for (const row of due) {
    if (Date.now() + 30_000 >= deadline) break;
    let expected = row.updated_at;
    if (apply) {
      const now = Date.now(), claimedAt = new Date(now).toISOString();
      const previous = followUpOf(row);
      const claim = { ...decisionObject(row.decision), followUp: { version: 1, attempts: 0, failures: 0, needsReview: false, documents: [], ...previous,
        nextCheckAt: previous?.nextCheckAt ?? claimedAt, leaseUntil: new Date(now + 300_000).toISOString() } } as Json;
      const { data, error } = await db.from("pipeline_candidates").update({ decision: claim, updated_at: claimedAt })
        .eq("id", row.id).eq("updated_at", expected).eq("status", row.status).eq("evidence_hash", row.evidence_hash).select("updated_at");
      if (error) throw Error(`Claiming candidate follow-up: ${error.message}`);
      if (data.length !== 1) { outcomes.push({ id: row.id, outcome: "concurrent_change" }); continue; }
      expected = data[0].updated_at;
    }
    const result: FollowUpDocument[] = [];
    for (const url of followUpUrls(row)) {
      if (Date.now() + 20_000 >= deadline) { result.push({ url, outcome: "unavailable", error: "worker_deadline" }); continue; }
      result.push(await read(url));
    }
    const followUp = finishFollowUp(row, result, Date.now());
    if (apply) {
      const { data, error } = await db.from("pipeline_candidates").update({ decision: { ...decisionObject(row.decision), followUp } as unknown as Json, updated_at: new Date().toISOString() })
        .eq("id", row.id).eq("updated_at", expected).eq("status", row.status).eq("evidence_hash", row.evidence_hash).select("id");
      if (error) throw Error(`Saving candidate follow-up: ${error.message}`);
      if (data.length !== 1) { outcomes.push({ id: row.id, outcome: "concurrent_change" }); continue; }
    }
    outcomes.push({ id: row.id, name: decisionObject(row.payload).name, ...followUp });
  }
  const report = { at: new Date().toISOString(), apply, eligible: due.length, processed: outcomes.length,
    fetchedUrls: networkReads, sourceUrls: documents.size, eventWrites: 0, modelCalls: 0, outcomes };
  await writeJsonAtomic(resolve(directory, "last-run.json"), report);
  console.log(JSON.stringify(report, null, 2));
  if (outcomes.length < due.length) process.exitCode = 2;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
