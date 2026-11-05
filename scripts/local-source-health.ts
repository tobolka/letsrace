/**
 * The weekly look at sources that went quiet, on the Mac: reading state lives here now, so the
 * server's copy would see every source as stalled. Start through scripts/local-run.sh.
 * The findings go into the given file, which the Mac's panel and report read.
 */
import { writeFileSync } from "node:fs";
import { getSourceHealth, losingRaces, verifyStalledSources } from "../src/lib/admin/source-health";
import { createServerSupabase } from "../src/lib/supabase/server";

if (process.env.LETSRACE_LOCAL_PASS !== "1") throw Error("Start this through scripts/local-run.sh");
const out = process.argv.find(arg => arg.startsWith("--out="))?.slice(6);
if (!out) throw Error("Use --out=FILE");

async function main() {
  const paused = await createServerSupabase().rpc("pipeline_pause_fruitless_sources");
  if (paused.error) console.error("Pausing fruitless sources failed", paused.error.message);
  const report = await getSourceHealth();
  const verified = await verifyStalledSources(report.stalled, { limit: 80 });
  const losing = losingRaces(verified);
  const summary = { at: new Date().toISOString(), stalled: report.stalled.length, verified: verified.length, losing };
  writeFileSync(out!, JSON.stringify(summary, null, 2), { mode: 0o600 });
  console.log(`local_source_health ${JSON.stringify({ stalled: summary.stalled, verified: summary.verified, losing: losing.length })}`);
  process.exit(0);
}
main().catch(error => { console.error(error); process.exit(1); });
