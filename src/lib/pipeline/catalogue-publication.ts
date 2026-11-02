import { createHash } from "node:crypto";
import { listEvents, type EventListItem } from "@/lib/events";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/seo";
import { boundedBody } from "@/lib/watcher/http";

/** Compare public content, not source-reader heartbeats or a JSON object's key order. */
export function catalogueFingerprint(events: EventListItem[]) {
  function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => [key, canonical(val)]));
    return value;
  }
  const rows = events.map(({ lastSeenAt, publicRevision, ...content }) => {
    void lastSeenAt; void publicRevision;
    return content;
  }).sort((a, b) => a.id.localeCompare(b.id));
  return createHash("sha256").update(JSON.stringify(canonical(rows))).digest("hex");
}

/** One durable batch for map/list/calendar. Its own cap never spends a detail-check slot. */
export async function publishCatalogueBatch() {
  if (!process.env.CRON_SECRET) throw Error("Missing publication access");
  const db = createServerSupabase();
  const { data: tasks, error } = await db.rpc("pipeline_claim_tasks", { p_kind: "catalogue_refresh", p_capabilities: ["web"], p_limit: 1 });
  if (error) throw error;
  const task = tasks[0];
  if (!task) return { status: "waiting", verified: false, eventWrites: 0 };
  try {
    const payload = task.payload as { revision?: string };
    if (task.key !== "catalogue:upcoming" || typeof payload.revision !== "string") throw Error("Invalid catalogue publication task");
    // Read independently of the public cached feed, using the same visibility rules.
    const expected = await listEvents({});
    const refreshed = await fetch(`${getSiteUrl()}/api/ops/publication`, {
      method: "POST", redirect: "error", headers: { Authorization: `Bearer ${process.env.CRON_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({ key: task.key, token: task.token, revision: payload.revision }), signal: AbortSignal.timeout(10_000),
    });
    if (!refreshed.ok) throw Error(`Catalogue publication returned HTTP ${refreshed.status}`);
    // This must be the ordinary public URL, without a cache-busting query or auth.
    const page = await fetch(`${getSiteUrl()}/api/events?catalogue=1`, { redirect: "error", signal: AbortSignal.timeout(25_000) });
    if (!page.ok) throw Error(`Public catalogue returned HTTP ${page.status}`);
    const actual: unknown = JSON.parse(new TextDecoder().decode(await boundedBody(page, 8 * 1024 * 1024)));
    if (!Array.isArray(actual) || actual.some(row => !row || typeof row.id !== "string") || catalogueFingerprint(actual) !== catalogueFingerprint(expected)) throw Error("Public catalogue does not match the saved races");
    const { data: finished, error } = await db.rpc("pipeline_finish_task", {
      p_key: task.key, p_token: task.token!, p_payload: task.payload,
      p_result: { verifiedAt: new Date().toISOString(), revision: payload.revision, races: expected.length, fingerprint: catalogueFingerprint(expected), surfaces: ["map", "list", "calendar"] },
    });
    if (error) throw error;
    return { status: finished ? "ok" : "superseded", verified: finished, races: expected.length, eventWrites: 0 };
  } catch (error) {
    const { error: retryError } = await db.rpc("pipeline_retry_task", { p_key: task.key, p_token: task.token!, p_error: error instanceof Error ? error.message : "Catalogue publication failed", p_delay_seconds: 300 });
    if (retryError) throw retryError;
    return { status: "deferred", verified: false, eventWrites: 0 };
  }
}
