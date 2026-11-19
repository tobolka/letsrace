import { pageAsText } from "@/lib/watcher/extractors/llm-calendar";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { canonicalExploreUrl } from "@/lib/watcher/explore";
import { assessCandidate } from "./assessment";
import type { DiscoveryState } from "./store";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { saveCandidate } from "./review";

/** Publish assertions into the shared review inbox, preserving terminal decisions. */
export async function queueDiscoveryCandidates(db: SupabaseClient<Database>, state: DiscoveryState) {
  let submitted = 0;
  const agentKeys = new Set<string>();
  const fromAgent = new Set(Object.values(state.tasks).filter(task =>
    task.origins.some(origin => origin.startsWith("agent-discovery:"))).map(task => task.id));
  // Child pages retain the origin of the source that led to them.
  for (let depth = 0; depth < 2; depth++) for (const task of Object.values(state.tasks)) {
    if (task.origins.some(origin => fromAgent.has(origin))) fromAgent.add(task.id);
  }
  for (const candidate of Object.values(state.candidates)) {
    if (!candidate.origins.some(id => state.tasks[id]?.kind === "read" && (state.tasks[id] as { lane?: string }).lane === "blind")) continue;
    if (assessCandidate(candidate.event, state.country).state === "out_of_scope") continue;
    const snapshot = JSON.parse(await readFile(candidate.snapshot, "utf8")) as { html: string; hash: string; status: number };
    if (snapshot.status !== 200 || createHash("sha256").update(snapshot.html).digest("hex") !== snapshot.hash) throw new Error(`Invalid candidate snapshot: ${candidate.id}`);
    const saved = await saveCandidate(db, candidate.event, { sourceUrl: candidate.sourceUrl, documentHash: snapshot.hash, textHash: candidate.event.evidence?.method === "structured_calendar" ? undefined : createHash("sha256").update(pageAsText(snapshot.html, candidate.sourceUrl).text).digest("hex"),
      country: state.country ?? "CZ", reason: "independent_discovery_requires_identity_and_authority_review" });
    if (candidate.origins.some(origin => fromAgent.has(origin))) agentKeys.add(saved.candidate_key);
    submitted++;
  }
  return { submittedAssertions: submitted, agentCandidateKeys: [...agentKeys], eventWrites: 0, note: "Idempotent evidence handoff; existing decisions retained. Not a count of new races or inserted rows." };
}

/** Optional bridge into the existing URL review queue; never activates sources or writes events. */
export async function queueDiscoverySources(db: SupabaseClient<Database>, state: DiscoveryState) {
  const known = new Set<string>();
  for (const table of ["watched_urls", "discovered_links"] as const) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from(table).select("url").order("id").range(offset, offset + 999);
      if (error) throw new Error(`Reading ${table} before discovery handoff: ${error.message}`);
      for (const row of data ?? []) { const key = canonicalExploreUrl(row.url); if (key) known.add(key); }
      if (!data || data.length < 1000) break;
    }
  }
  const urls = new Set<string>();
  for (const candidate of Object.values(state.candidates)) {
    const task = candidate.origins.map(id => state.tasks[id]).find(t => t?.kind === "read" && t.lane === "blind");
    if (!task || assessCandidate(candidate.event, state.country).state !== "needs_review" || !candidate.event.evidence?.quote) continue;
    const url = canonicalExploreUrl(candidate.sourceUrl);
    if (url && !known.has(url)) urls.add(url);
  }
  const list = [...urls];
  for (let offset = 0; offset < list.length; offset += 100) {
    const { error } = await db.from("discovered_links").upsert(list.slice(offset, offset + 100).map(url => ({
      url, status: "pending", hint_kind: "independent_season_discovery",
    })), { onConflict: "url", ignoreDuplicates: true });
    if (error) throw new Error(`Discovery source handoff failed: ${error.message}`);
  }
  return { submittedUrls: list, eventWrites: 0, note: "Submitted for source review; existing paused/rejected sources preserved. Not a count of newly created rows." };
}
