/** Free DDG/Bing/linked-source discovery. Source leads only; no model or event writes. */
import { readFile } from 'node:fs/promises';
import { parse } from 'dotenv';
import { runExplore } from '../src/lib/watcher/explore';
async function main() {
 for (const [k,v] of Object.entries(parse(await readFile('.env.local','utf8')))) process.env[k] ??= v;
 const result = await runExplore({ budgetMs: 180_000, maxFetch: 24, autoWatch: false });
 console.info("pipeline_discovery", JSON.stringify({leads:result.queued,read:result.fetched}));
 console.log({ ...result, modelCalls: 0, paidSearchCalls: 0, eventWrites: 0 });
}
main().catch(e => { console.error(e); process.exitCode = 1; });
