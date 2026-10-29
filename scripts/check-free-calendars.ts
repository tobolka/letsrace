/** Re-read supported structured calendars for free; only queue source-bound changes. */
import { isDeepStrictEqual } from 'node:util';
import { readFile } from 'node:fs/promises';
import { parse } from 'dotenv';
import { createServerSupabase } from '../src/lib/supabase/server';
import { fetchPage } from '../src/lib/watcher/http';
import { parseRaceTime } from '../src/lib/watcher/extractors/racetime';
import { saveCandidate } from '../src/lib/discovery/review';
import { catalogueWindow } from '../src/lib/catalog/overview-quality';
async function main() {
 for (const [k,v] of Object.entries(parse(await readFile('.env.local','utf8')))) process.env[k] ??= v;
 const db = createServerSupabase(), url = 'https://racetime.sk/terminovka';
 const doc = await fetchPage(url, { fresh: true });
 if (doc.status !== 200) throw Error(`Free source unavailable: ${doc.status}`);
 const window = catalogueWindow();
 const events = parseRaceTime(url, doc.html).filter(e => e.startDate >= window.from && e.startDate <= window.until);
 const { data: previous, error } = await db.from('pipeline_candidates').select('payload').eq('source_url', url);
 if (error) throw error;
 let queued = 0;
 for (const event of events) {
   // Unchanged assertions keep their existing decision even if unrelated cards changed.
   if ((previous ?? []).some(r => isDeepStrictEqual(r.payload, JSON.parse(JSON.stringify(event))))) continue;
   await saveCandidate(db, event, { sourceUrl: url, documentHash: doc.hash, country: event.countryHint ?? 'SK', reason: 'free_structured_calendar_requires_review' }); queued++;
 }
 console.info("pipeline_candidates",JSON.stringify({read:events.length,queued}));
 console.log({ source: url, read: events.length, queued, eventWrites: 0, modelCalls: 0, searchCalls: 0, costUsd: 0 });
}
main().catch(e => { console.error(e); process.exitCode = 1; });
