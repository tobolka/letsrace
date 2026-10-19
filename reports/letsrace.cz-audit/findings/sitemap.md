# Sitemap findings: letsrace.cz (2026-10-10)

Sub-score: 72/100

Method: fetched live https://letsrace.cz/sitemap.xml (complete, 10,790 URLs, 9,509,808 bytes, `</urlset>` present, XML well-formed; the scratchpad copy is identical). Parsed every `<url>`. Status/canonical/robots check on a random 60-URL sample (sequential, 1 s delay) plus all 62 en hubs. Source: src/app/sitemap.ts, src/lib/events.ts. Next 16.4.0 docs: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-sitemaps.md.

## Passes
- Limits: 10,790 URLs (limit 50,000), 9.5 MB (limit 50 MB). 79% of bytes (7.5 MB) is the 64,740 xhtml:link alternates. With Accept-Encoding gzip it is 219 KB, TTFB 0.44 s (x-vercel-cache HIT, revalidate 3600).
- hreflang: every entry has exactly 6 alternates (en, cs, pl, sk, de, x-default=en). Self-reference present in all, 0 non-reciprocal pairs, 0 alternates pointing outside the sitemap, 0 duplicate locs. On-page hreflang count (6) matches.
- Sample of 60 (36 race, 8 series, 14 hub, 2 home) plus 62/62 en hubs: all 200, no redirects, canonical == sitemap URL, none noindex. Sitemap hub inclusion (MIN_RACES = MIN_COLLECTION_RACES = 8) matches the page-level noindex rule. Hubs below threshold (e.g. /en/races/cz/gravel, sk/road) are correctly noindex and correctly absent.
- /en/calendar and /en/list canonicalise to /en (correctly not listed); /en/schedule and /en/c return 308.
- robots.txt declares the sitemap.

## Findings

1. HIGH. ~49% of race URLs are past races. Matched against /api/events: 820 of 1,689 matched slugs have startDate < today, 696 of them more than 7 days old. Extrapolated that is about 4,900 of 10,080 race URLs. Cause: src/lib/events.ts:664 keeps races for 30 days after the start date (comment at 662-663). Policy: keep pages live (200, indexable, "already took place" + link to next edition), but list in the sitemap only for 7 days after the race. Change the constant at events.ts:664 from 30 to 7. Put the remaining past races, if kept, into a separate file so GSC reports them apart.

2. HIGH. Fake lastmod on 165 URLs: home x5 and the 33 country/discipline hubs x5 all carry the sitemap build time (`now`, 2026-10-10T09:34:45Z, one distinct value, changes hourly). Fix src/app/sitemap.ts:18 (`const now`), :44, :46, :47, :64, :72 (`: now` fallback for series). Use the max `updated_at` of the hub's events, or omit it as already done for collections (:54). Lastmod that is always "now" teaches Google to ignore lastmod for the whole host.

3. MEDIUM. Race lastmod is a DB write time, not a content-change time. 4,440 race URLs (888 races x5, 44%) have lastmod 2026-10-10 at 05:56-05:58, which is the daily batch. Any enrichment script writes `updated_at` (e.g. scripts/ingest-*, src/lib/catalog/llm-enrich.ts:621, facts.ts:108). The value is valid W3C datetime and real as a write time, but not provably a visible-content change. Fix: a `content_changed_at` column set only when displayed fields change, used at sitemap.ts:80. The `new Date(event.startDate)` fallback at :80 is never hit (0 midnight values).

4. MEDIUM. 126 series pages are indexable and absent from the sitemap. /api/series lists 193 series; the sitemap has 79. events.ts:639 (`.gte("events.start_date", today)`) drops series whose rounds are all past, e.g. rad-bundesliga (22 rounds, last 2026-09-13), which returns 200, `index, follow`, self-canonical. Series pages are evergreen. Fix events.ts:639: include series with a round in the last 12 months or in the current season. Also `limit = 500` at events.ts:621 counts series/race pairs, and readAllRows pages by 1,000, so the real cap is silently 1,000 pairs. Currently 402 pairs.

5. MEDIUM. Single 9.5 MB file, no index. Under the limits, but split it for GSC diagnosis (GSC reports indexed/not-indexed per submitted sitemap). Proposed ids in sitemap.ts: `core` (home, hubs, collections), `series`, `races-upcoming-{en,cs,pl,sk,de}`, `races-past`. Each file then stays under about 2,200 URLs.
   - Add `export async function generateSitemaps()` returning `[{id:"core"},...]`. The default export takes `props: { id: Promise<string> }` and awaits it (v16). Files are served at `/sitemap/[id].xml`.
   - generateSitemaps does NOT emit an index (the docs describe none). Add a route handler `src/app/sitemap.xml/route.ts` returning `<sitemapindex>`, to keep the already-submitted /sitemap.xml URL alive. I did not verify this route coexists with the generated files; test it in a build.
   - Update src/app/robots.txt/route.ts:25 to point to the index, and delete the Yandex-only `Host:` line at :26.
   - Cache the DB reads (listSitemapEvents is called per id), for example with `unstable_cache` or React `cache`, since `revalidate = 3600` (sitemap.ts:13) applies per file.

6. LOW. changefreq and priority are ignored by Google. They are on all 10,790 URLs (615 KB, 6% of the file). Remove the `changeFrequency` and `priority` params from the `add()` helper (sitemap.ts:15, :28, :36-37) and from every call (:44, :46, :47, :54, :64, :72, :81). Current values: home hourly/1, hubs daily/0.75-0.9, series weekly/0.7, races weekly/0.6.

7. MEDIUM (quality gate). Programmatic scale: 10,080 race URLs plus 310 hub URLs, far above the 50-page hard stop (it is written for location pages, but I applied it analogously). Pages are distinct real entities (a date, venue and organizer each), so this is not a city-swapped doorway pattern. Thin, though: race pages about 83 visible words (gate: 400 for product-like pages), hubs about 94 (gate: 400 for category pages), series about 70. Only the home page (about 780 words) clears its gate. Three more risks:
   - Four of the five locale versions are largely UI-chrome translations of the same record.
   - Organizer names are left untranslated.
   - 13 "tbc-*" placeholder slugs are listed.
   Mitigation: list only locales that have real content for the race's country (own language + en); drop `tbc-` races without a date from the sitemap; add unique copy per hub (400 words) before relisting.

8. INFO. /en/races/hu returns 200 + `noindex` with canonical /en; it should be a 404. /en/privacy is indexable and not listed (fine, optional to add).

## Missing from sitemap (exist and are indexable)
- 126 series (finding 4).
- Everything else that is indexable is present: 8 country hubs, 25 discipline hubs, 29 collections, home, 2,016 races per locale. Non-qualifying hubs are noindex by design.
