# Vercel usage investigation — 2026-10-19

## Account evidence

Team: `tobolkas-projects` (Hobby). Authenticated dashboard, last 30 days ending October 19:

| Resource | Usage | Hobby allowance | Main contributor |
| --- | ---: | ---: | --- |
| Fast Origin Transfer | 16.41 GB | 10 GB | LetsRace 15.25 GB (93.0%) |
| Fluid Active CPU | 5h 16m | 4h | LetsRace 5h 12m (98.9%) |
| ISR Writes | 228,586 units | 200,000 | Account total |
| Deployment Storage | 3.56 GB before cleanup | 10 GB | Not an exceeded resource |

Last 7 days: LetsRace transferred 7.94 GB from origin and used 2h 13m of CPU. This is ongoing consumption, not solely historic usage waiting to expire. The prior October 12 change removed persistent ISR writes for race/series details, but did not address dynamic home rendering or duplicated inline styles. The selected recent 24-hour ISR interval contained 5,398 writes; it is lower than the earlier spike but not zero.

Functions observability, last 12 hours: race details ~2K calls / 2 minutes CPU; home ~688 calls / 2 minutes; race cards 66 calls / 33 seconds. Crons were substantially smaller in this sample. No ingestion jobs were disabled.

The CLI billing-cost API does not return data for this Hobby subscription. Values above come from the authenticated usage and observability dashboards, not inferred invoices.

## Fix

- Ordinary map entry pages no longer read `searchParams`, which made every visit dynamic despite `revalidate = 120`. Five locale entry pages now prerender with hourly revalidation. Filter handling stays in the browser.
- Incoming home URLs with a nonempty `e` query rewrite internally to `/{locale}/map-entry`. This keeps the previous event lookup, canonical slug resolution, date normalization, and repeated query values. The public URL remains the localized home URL; canonical metadata remains the locale home URL.
- `ExplorePage` shares the UI between cached entry and dynamic event links.
- Disabled `experimental.inlineCss`. CSS now ships as immutable shared assets rather than appearing in both every HTML document and its embedded RSC payload. This adds a CSS fetch on first visit; subsequent visits can reuse it.
- Race and series details retain `revalidate = 0`; restoring ISR across the entire localized catalogue would recreate the earlier cold-write problem.

## Validation before deployment

- 10 targeted tests passed (routing, locale selection, localized paths).
- Targeted ESLint, TypeScript through the production build, and `git diff --check` passed.
- Production build shows all five home pages as SSG with 1-hour revalidation; map-entry and race/series detail remain dynamic.
- Local production server: `/en` ~127 KB versus ~473 KB on current production; race detail sample ~131 KB versus ~427 KB (uncompressed HTML bytes, not a measurement of billed transfer savings).
- Browser verified the filtered map loads and the event deep link gains the race's date range.

## Deployment cleanup

Fetched all 76 deployments, with pagination confirming no additional page. Deleted 53 superseded deployments, serially, through the authenticated Vercel API:

- LetsRace: 26
- Albrechta: 23
- Broadcast: 3
- Format: 1

Retained 23: all current production targets, one previous successful production deployment where available, and the latest successful preview for each existing preview branch. A fresh listing confirms every protected deployment still exists. No projects, domains, data, or environment variables were deleted. Deployment removal reduces retained storage, not historic CPU/transfer usage.

## Follow-up and migration decision

After deployment, verify `/en`, `/cs`, a filtered home URL, a focused race link, a race detail, and the stylesheet on `letsrace.cz`. Require `x-vercel-cache: HIT` for repeated ordinary home requests, successful focused-event opening, and immutable CSS assets.

Compare new daily CPU and origin transfer after a complete day. Monthly counters will not immediately reset; Hobby uses a rolling usage window. A measured daily reduction is needed before promising that this account stays under the free allowance.

Moving portfolio/Format/Broadcast would not materially address current CPU or origin transfer. If a migration is still needed after these fixes, prioritize LetsRace. Cloudflare Workers Paid starts at USD 5/month, with usage allowances and charges above them; static assets are free. This is not authorization/evidence of a completed hosting migration. Check OpenNext compatibility with Next 16.4, dynamic OG image generation, cron jobs, Node-dependent importers, secrets, auth callbacks, and public routes before any cutover.

Sources: Vercel authenticated Usage/Functions dashboard; https://vercel.com/docs/plans/hobby ; https://developers.cloudflare.com/workers/platform/pricing/ .
