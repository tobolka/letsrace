# LetsRace: readiness check, 22 October 2026

## Outcome

The production site is serving pages and race data. The tested visitor paths work, and the database reports ACTIVE_HEALTHY. Capacity for 300 visitors spread over several hours appears adequate based on the bounded checks below, but hosting availability cannot be guaranteed: the shared Vercel Hobby team is already above several included usage limits.

No application source changes, plan purchases, firewall weakening, or broad database migrations were made in this check. Existing work in this checkout was left alone. A separate session deployed the icon-tooltip change during verification; final checks ran after that deployment became Ready.

## Production verification

- Current deployment: `dpl_D9x4r6p7BgHxQZ4FYUQEJqPqzscN`, commit `e6f6ce87accbd642b18b891a3a172cbf0215713a`, Ready and assigned to letsrace.cz.
- 21 representative HTTP paths returned 200: all five locale homepages, Czech map/list/calendar/browse/weekend collection, race and series detail, events and series APIs, ICS export, places lookup, robots, sitemap, city-map asset and anonymous plan shell.
- 31 referenced production static assets returned 200.
- Browser verified map markers, opening the Podzimní Bahno detail and source links, a populated list with 822 races, Czech filtering to 68 races, and a populated calendar preserving the country filter. No browser console warnings/errors in these checks.
- The live shared catalogue contains 822 distinct event IDs, including 68 in CZ. This public feed applies visibility/market/source rules; it is not the entire database.
- Invalid date input returns 400 rather than a server error.
- Vercel grouped runtime-error queries returned no errors for the queried 24h and final 1h windows. Detailed historical metrics were unavailable on the Hobby plan.
- Authenticated sign-in, saving a personal plan, outgoing email, and mobile touch behavior were not tested.

## Bounded traffic checks

`http-checks.json` contains the initial checks and a 300-request burst with at most 15 concurrent requests. The burst took 6.82 seconds: 293 responses were 200 and 7 were 429, all on the catalogue API. Median latency was 188 ms, p95 1,160 ms. This is an HTTP read test from one IP, not 300 independent browser sessions.

The active firewall rule limits catalogue APIs to 100 requests/minute/IP. The test exceeded that existing rule. The 429 response included `x-vercel-mitigated: deny`. Data returned 200 again after the window elapsed. The rule was left enabled.

`paced-checks.json` records a subsequent 30-request sample over 19.69 seconds: 30/30 HTTP 200, median 150 ms, maximum 255 ms. This confirms recovery and ordinary paced reads; it is not a guarantee of arbitrary simultaneous traffic.

The production code already uses a shared client-side catalogue request and CDN/data caches. These optimizations predate this audit; this session verified their presence and actual live responses.

## Data health and source retry

- Database: Supabase `xlomrxswdcekarazaahx`, ACTIVE_HEALTHY.
- 5,966 public unmerged event rows, 1,135 with dates from today onward before public-feed eligibility rules.
- 35 upcoming public rows lack coordinates; they cannot all appear as map pins. No coordinates were invented.
- Connection snapshot: 22 connections, 1 active, 0 waiting on a lock.
- Before the targeted retry, today's ingest contained 45 successful finished runs, 2 failed finished runs, 0 unfinished runs. Successful runs reported 2,545 upserts; these are not 2,545 new races.
- Retried the failed `https://zapadoceskaamaterskaliga.cz` source with its existing deterministic adapter and a zero LLM budget. The retry read/upserted 15 events. Database readback confirmed `ok=true`, `finished_at=2026-10-22 12:41:55.415+00`, 15 upserts and no error.
- `https://bikeboard.at/termine` still returns 403 externally. Its import remains blocked by that source; existing catalogue delivery works.
- This checks delivery, freshness jobs and representative UI. It is not a verification of every race's factual content. A public source record titled TEST 600 was observed and remains a separate content-review item.

## Vercel cleanup

Deleted 22 explicitly enumerated old/failed LetsRace deployments. Kept current production and both recent Ready predecessors because production changed during this check:

- `dpl_D9x4r6p7BgHxQZ4FYUQEJqPqzscN`
- `dpl_Bv7GQGA1QQYjBZDiNz9KfbRERDcW`
- `dpl_9uYTACKNjpdwuRDVLJs5hNZK4Mg5`

An independent paginated API readback returned exactly these three deployments, all Ready, with `next=null`. No other project's deployments were deleted. See `vercel-cleanup.json` for the deletion manifest. Storage savings were not measured after dashboard aggregation.

## Remaining hosting risk

The Vercel dashboard for the shared team `tobolkas-projects`, All Projects, Last 30 Days (Sep 22–Oct 22), showed:

| Metric | Used | Included |
| --- | ---: | ---: |
| Fast Data Transfer | 18.35 GB | 100 GB |
| Fast Origin Transfer | 17.4 GB | 10 GB |
| Fluid Active CPU | 5h 42m | 4h |
| ISR writes | 244,955 | 200,000 |
| Function invocations | 355,447 | 1,000,000 |
| CDN requests | 334,407 | 1,000,000 |

These are shared team totals, not measured costs attributable solely to LetsRace. Deleting deployments does not erase rolling transfer/CPU/write usage. The site currently serves requests, but those overages prevent a clean hosting-readiness sign-off. Before a time-sensitive traffic campaign, review upgrading the team to Pro, including its pricing and spending controls. No paid change was authorized or made.

Official reference: https://vercel.com/docs/plans/hobby

## Database advisories

The read-only security-advisor check also reported existing PostGIS/public-schema and function-permission warnings, a mutable search path on app_age_rank, and disabled leaked-password protection. Most RLS-without-policy notices concern intentionally server-only tables and are informational. None of these was altered as an emergency traffic-preparation change. They need a separate dependency-aware security review rather than a blind extension/schema move.

Remediation references:
- https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public
- https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
