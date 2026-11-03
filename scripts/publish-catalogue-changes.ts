/** Drain durable publication work, then verify the actual public HTML. No race writes. */
import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { createServerSupabase } from "../src/lib/supabase/server";
import { publicationPayload, publicationLocation, publicationIsVisible, verifyPublicRevision } from "../src/lib/pipeline/publication";
import { getSiteUrl } from "../src/lib/seo";
import { localePath } from "../src/lib/localized-paths";
import { fetchPublic } from "../src/lib/http/safe-url";
import { boundedBody } from "../src/lib/watcher/http";

async function main() {
  for (const [key, value] of Object.entries(parse(await readFile(".env.local", "utf8")))) process.env[key] ??= value;
  if (!process.env.CRON_SECRET) throw Error("Missing publication access");
  const db = createServerSupabase();
  // SQL reserves at most 60 attempts/day across all workers, including crashes.
  // Other language pages refresh lazily via the race tag.
  const deadline = Math.min(Number(process.env.SOURCE_RUN_DEADLINE || 0) * 1000 || Infinity, Date.now() + 180_000);
  if (Date.now() + 90_000 > deadline) { process.exitCode = 2; return; }
  let verified = 0, pending = 0, processed = 0;
  let refreshCatalogue = process.env.PUBLICATION_REFRESH_CATALOGUE === "1";
  for (let index = 0; index < 10 && Date.now() + 90_000 < deadline; index++) {
    // Claim only when ready to work; queued items must not expire while waiting here.
    const { data: tasks, error } = await db.rpc("pipeline_claim_tasks", { p_kind: "public_refresh", p_capabilities: ["web"], p_limit: 1 });
    if (error) throw error;
    const task = tasks[0]; if (!task) break;
    processed++;
    try {
      const payload = publicationPayload(task.payload), expected = payload.expected;
      const response = await fetch(`${getSiteUrl()}/api/ops/publication`, { method: "POST", redirect: "error", headers: { Authorization: `Bearer ${process.env.CRON_SECRET}`, "Content-Type": "application/json" }, body: JSON.stringify({ key: task.key, token: task.token, revision: payload.revision, ...(refreshCatalogue ? { catalogue: true } : {}) }), signal: AbortSignal.timeout(30_000) });
      if (response.status === 409) {
        const { error } = await db.rpc("pipeline_finish_task", { p_key: task.key, p_token: task.token!, p_payload: task.payload, p_result: { superseded: true } });
        if (error) throw error;
        pending++; continue;
      }
      if (!response.ok) throw Error(`Publication service returned HTTP ${response.status}`);
      refreshCatalogue = false;
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
      for (const locale of ["cs", "en"] as const) {
        const page = await fetchPublic(`${getSiteUrl()}${localePath(locale, `e/${payload.slug}`)}`, { headers: { "User-Agent": "LetsRace-Publication-Check/1.0" }, signal: AbortSignal.timeout(30_000) });
        const html = new TextDecoder().decode(await boundedBody(page, 2 * 1024 * 1024));
        verifyPublicRevision(html, page.status, target, publicationIsVisible(target.expected, current.location?.country_code ?? null));
      }
      const { data: finished, error } = await db.rpc("pipeline_finish_task", { p_key: task.key, p_token: task.token!, p_payload: task.payload, p_result: { verifiedAt: new Date().toISOString(), revision: payload.revision, locales: ["cs", "en"] } });
      if (error) throw error;
      if (finished) verified++; else pending++;
    } catch (error) {
      const { error: retryError } = await db.rpc("pipeline_retry_task", { p_key: task.key, p_token: task.token!, p_error: error instanceof Error ? error.message : "Publication check failed", p_delay_seconds: Math.min(86400, 300 * 2 ** Math.min(task.attempts, 8)) });
      if (retryError) throw retryError;
      pending++;
    }
  }
  console.log({ processed, publicRevisionsVerified: verified, pending, eventWrites: 0 });
  if (pending) process.exitCode = 2;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
