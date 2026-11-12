/** Verify the actual public HTML after a bounded refresh request. No race writes. */
import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { createServerSupabase } from "../src/lib/supabase/server";
import { checkPublicRaceRevisions, closeUnsampledRaceChecks } from "../src/lib/pipeline/race-publication-check";

async function main() {
  for (const [key, value] of Object.entries(parse(await readFile(".env.local", "utf8")))) process.env[key] ??= value;
  const db = createServerSupabase();
  const deadline = Math.min(Number(process.env.SOURCE_RUN_DEADLINE || 0) * 1000 || Infinity, Date.now() + 180_000);
  const outsideSample = await closeUnsampledRaceChecks();
  const result = await checkPublicRaceRevisions({ maxChecks: 10, deadline, timeoutMs: 30_000 });
  const remaining = await db.from("pipeline_tasks").select("key", { count: "exact", head: true }).eq("kind", "public_refresh").in("status", ["pending", "running"]);
  if (remaining.error || remaining.count === null) throw Error(remaining.error?.message ?? "Publication backlog count unavailable");
  console.log({ ...result, outsideSample, pending: remaining.count });
  if (result.deferredInBatch || remaining.count) process.exitCode = 2;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
