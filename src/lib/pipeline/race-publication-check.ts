import { createServerSupabase } from "@/lib/supabase/server";
import { publicationPayload, publicationLocation, publicationIsVisible, verifyPublicRevision } from "@/lib/pipeline/publication";
import { getSiteUrl } from "@/lib/seo";
import { localePath } from "@/lib/localized-paths";
import { fetchPublic } from "@/lib/http/safe-url";
import { boundedBody } from "@/lib/watcher/http";

/** Verify ordinary public responses after the matching revision was refreshed. */
export async function checkPublicRaceRevisions({ maxChecks, deadline, timeoutMs }: { maxChecks: number; deadline: number; timeoutMs: number }) {
  const db = createServerSupabase();
  // SQL reserves at most 60 attempts/day across all workers, including crashes.
  // Other language pages refresh lazily via the race tag.
  let verified = 0, deferredInBatch = 0, processed = 0;
  for (let index = 0; index < maxChecks && Date.now() + timeoutMs + 2000 < deadline; index++) {
    // Claim only when ready to work; queued items must not expire while waiting here.
    const { data: tasks, error } = await db.rpc("pipeline_claim_tasks", { p_kind: "public_refresh", p_capabilities: ["web"], p_limit: 1 });
    if (error) throw error;
    const task = tasks[0]; if (!task) break;
    processed++;
    try {
      const payload = publicationPayload(task.payload), expected = payload.expected;
      let target = payload;
      if (expected.merged_into_id) {
        const { data: canonical, error } = await db.from("events").select("slug,public_revision,name,start_date,end_date,status,visibility,registration_url,id").eq("id", String(expected.merged_into_id)).single();
        if (error) throw error;
        target = { revision: canonical.public_revision, slug: canonical.slug, expected: canonical };
      }
      const { data: current, error: currentError } = await db.from("events").select("name,public_revision,start_date,end_date,practical_details,location:locations(id,name,municipality,venue,country_code,lat,lng)").eq("id", String(target.expected.id)).single();
      if (currentError) throw currentError;
      if (current.public_revision !== target.revision) throw Error("Race changed while checking publication");
      target = { ...target, expected: { ...target.expected, public_location: publicationLocation(current) } };
      const checks = await Promise.allSettled((["cs", "en"] as const).map(async locale => {
        const page = await fetchPublic(`${getSiteUrl()}${localePath(locale, `e/${payload.slug}`)}`, { headers: { "User-Agent": "LetsRace-Publication-Check/1.0" }, signal: AbortSignal.timeout(timeoutMs) });
        const html = new TextDecoder().decode(await boundedBody(page, 2 * 1024 * 1024));
        verifyPublicRevision(html, page.status, target, publicationIsVisible(target.expected, current.location?.country_code ?? null));
      }));
      for (const check of checks) if (check.status === "rejected") throw check.reason;
      const { data: finished, error } = await db.rpc("pipeline_finish_task", { p_key: task.key, p_token: task.token!, p_payload: task.payload, p_result: { verifiedAt: new Date().toISOString(), revision: payload.revision, locales: ["cs", "en"] } });
      if (error) throw error;
      if (finished) verified++; else deferredInBatch++;
    } catch (error) {
      const { error: retryError } = await db.rpc("pipeline_retry_task", { p_key: task.key, p_token: task.token!, p_error: error instanceof Error ? error.message : "Publication check failed", p_delay_seconds: Math.min(86400, 300 * 2 ** Math.min(task.attempts, 8)) });
      if (retryError) throw retryError;
      deferredInBatch++;
    }
  }
  return { processed, publicRevisionsVerified: verified, deferredInBatch, eventWrites: 0 };
}
