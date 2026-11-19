# Pipeline review, 9 Nov 2026

## What was wrong on the Mac
- A step that ran out of time was reported as failed and held the cycle (once for 16 minutes): the wrapper stopped waiting for the worker it had started, so the worker was never ended. Fixed in `scripts/bounded-pipeline-step.cjs` and `scripts/local-cycle.cjs` (a step ends when its process does).
- A spent daily AI allowance looked like a broken step and was retried every hour (20 false failures a day). The cycle now reads the allowance first, records "waiting", and comes back after midnight in Prague.
- rad-net.de has asked every visitor to prove it is not a robot since 8 Nov 2026. Both rad-net readers recorded "0 races, done". They now fail with that reason. The page is not read, by design; German races from rad-net stay as they were on 7 Nov.
- Prima CUP's 2027 season stood on a watched page while the source was recorded as "off season": the reader knew only the 2026 layout. The reader now reads the new listing (9 races), and any calendar read as empty while its page states three or more coming dates is flagged for review instead.
- Empty next-season calendars were asked once a week and organisers' pages once in two weeks. Now every 2 days (October to February) and every 5 days.

## What the numbers say
- The "206 of 3822" coverage figure undercounts. Matching 2026 races to 2027 races by name, place and date gives roughly AT 148 of 466, DE 107 of 893, CZ 86 of 965, PL 36 of 541. The 2026 side also holds duplicates (Malevil Cup stands three times).
- Organisers' own pages are close to read out: of 56 Czech organiser homepages still "not announced", one stated a 2027 date, and that race was already in the catalogue. Czech series (Kolo pro život, Author Maraton Tour, Road Classics, Cykloman) say on their pages that 2027 dates are coming.
- Of 117 held date candidates in CZ, DE, AT and PL read by hand, one was a missing race (Race across Germany Aachen – Görlitz, added to the reviewed answers). The rest were held rightly or already existed.

## Changed in the live catalogue
`fixes.json` in this folder, applied with `scripts/apply-reviewed-fixes.ts` (log in `applied.log`): 7 duplicate 2027 races merged, 9 races hidden whose date was finishers.com's estimate ("End of April 2027") stored as the 1st of the month.

## Not done
- The 8 new Prima CUP races are in the Mac copy and go to the server with the next send (about three hours after the previous one).
- 2026 duplicates were not cleaned; the existing merger finds no pairs among upcoming races, so the pairs above were found by a query, not by it.
- The coverage report itself was not changed.
