# letsrace.cz: SEO action plan

Health score **52/100** (2026-10-10). Root causes A–E are defined in FULL-AUDIT-REPORT.md.

Each item lists:
- **Why**: the first-principle observation.
- **Depends on / unblocks**.
- **Fail check**: how we'd know it didn't work.
- **Leading indicator**: what to watch without re-running the audit.

GSC is not connected, and every leading indicator below assumes it. **Do item 0 first.**

## Phase 0: instrumentation (today)
**0. Connect Google Search Console (domain property) and Bing Webmaster Tools.** Submit the sitemap and set `BING_SITE_VERIFICATION` (`src/app/layout.tsx:83`).
- *Why:* there is no field data on indexing, CWV or links today.
- *Unblocks:* every indicator below.
- *Fail check:* the sitemap shows "Couldn't fetch" or 0 discovered URLs after 48 h.

## Phase 1: critical fixes (week 1)
**1. Fix race OG/JSON-LD image URLs** (`e/[slug]/page.tsx:63`, `event-json-ld.tsx:74`, `src/lib/seo.ts:286-311`).
- *Why:* ~10k pages advertise a 404 image to Google, social and chat clients.
- *Fail check:* `curl -sI $(og:image)` returns anything other than 200 image/png.
- *Indicator:* GSC Enhancements → Events shows no "invalid image" warnings.

**2. Render race links on country hubs.** Reuse `RaceLinkList`, month-grouped, in `c/[code]/page.tsx:113-149`.
- *Why:* race pages are reachable only via the sitemap, and the hubs don't match the "race calendar" intent.
- *Unblocks:* 9, 13.
- *Fail check:* `/cs/zavody/cz` has fewer than 99 `<a href="/cs/zavod/…">` links.
- *Indicator:* GSC "Discovered – currently not indexed" count for race URLs goes down.

**3. Fix discipline-hub hreflang** (`c/[code]/[discipline]/page.tsx:62` → `hubPath(l, …)`).
- *Fail check:* `/cs/zavody/cz/road` still lists `/en/zavody/…`.
- *Indicator:* GSC International Targeting hreflang errors reach 0.

**4. Real 404s.** Use `notFound()` in `e/[slug]/page.tsx:75`, and remove or rework `loading.tsx` in the e, series, c and discipline routes. Also set unmatched 404 pages to noindex.
- *Depends on:* this interacts with 5, so test both together.
- *Fail check:* `curl -o /dev/null -w %{http_code} /cs/zavod/neexistuje-xyz-2026` is not 404.
- *Indicator:* the GSC "Soft 404" report reaches 0.

**5. Remove `await headers()` from the root layout.** Move `<html lang>` to `app/[locale]/layout.tsx` via `next/root-params` (`src/app/layout.tsx:91`, `not-found.tsx:9`). Then add `revalidate` + `generateStaticParams(){return []}` on race, series and hub pages, and move `?e=` handling out of `searchParams`.
- *Why:* every page is rendered per request with `no-store`.
- *Unblocks:* ISR, cache HITs, bfcache, and stable TTFB.
- *Fail check:* the second request still shows `x-vercel-cache: MISS` and `no-store`.
- *Indicator:* Vercel function invocations per page view fall; GSC crawl stats show average response time down.

## Phase 2: high-impact (weeks 2–3)
**6. Classification and place fixes (root cause B).**
- Classify on structured source fields first, and make "unknown" a real value instead of road (`federciclismo.ts:47-49`, `seo-race-copy.ts:307-314`).
- In `placeOf`, never use a country as the town.
- Put the venue in `Place.name` and a clean municipality in `addressLocality` (`event-json-ld.tsx:49,93-104`).
- Apply `unshout` to the H1 as well (`page.tsx:171-173`), and strip CTA junk during ingest.
- *Fail check:* re-run a sample of 200 pages and look for "Gravel" in a name with discipline road, or a title ending in a country name. Target: 0.
- *Indicator:* the /it/track hub lists only velodrome events.

**7. Fix Offers and status in JSON-LD.**
- Emit `offers` only when the race is upcoming and entry is open, with `validThrough` set to the entry deadline (`event-json-ld.tsx:84-92`).
- Drop the registration URL from `sameAs` (`:52-57`).
- Fix the "registration open" copy for races whose entry has closed (`seo-race-copy.ts:420-424`).
- Skip the Event JSON-LD when there is no location (44 races).
- Add `inLanguage`.
- *Fail check:* in a full /en crawl, more than 0 past races carry an Offer.
- *Indicator:* GSC Events report shows valid items up and warnings down.

**8. Entity layer (root cause E).**
- Organization + WebSite `@graph` on the home page.
- An /about page (sources, update cadence, operator), a contact page, and a footer linking to them and to privacy.
- Create social profiles and use them as `sameAs`.
- *Fail check:* the Rich Results test on /cs shows no Organization.
- *Indicator:* branded queries ("let's race", "letsrace") start showing a sitelinks or knowledge panel.

**9. Enrich the race template with data already held (no LLM spend).**
- A category table (`<table>` or `<dl>`) with distance and age band (`events.ts:58-65`).
- Source domain + "last updated" date.
- Nearby races the same weekend. This makes the existing meta description true (`seo-race-copy.ts:27,583`).
- Prev/next edition link, "Round X of N", a visible discipline-hub link, and a results link for past races.
- *Depends on:* 6, so the data is correct first.
- *Fail check:* median visible words on a 200-page sample is still under 200.
- *Indicator:* GSC impressions per race page and the indexed share of race URLs go up.

**10. Home mobile performance.**
- Merge the `site-index.tsx:24-29` query into the first `Promise.all`.
- Make the skeleton rows match the real row height (`list-skeleton.tsx:14`, and the map skeleton width).
- Defer maplibre to idle or first interaction on mobile.
- Long cache headers on `/intro-race*.webp`.
- Test with `inlineCss` off (`next.config.ts:74`).
- *Fail check:* mobile Lighthouse on /cs is still under 60, or CLS is over 0.1.
- *Indicator:* CrUX (once there is enough traffic) or Vercel Speed Insights show p75 LCP under 2.5 s and CLS under 0.1.

## Phase 3: content and architecture (month 2)
**11. Past-race and sitemap policy.**
- Past races: keep the pages live, but noindex those with no results and no next edition. 301 a past edition to the next one where the series continues.
- Sitemap: shorten the past-race window (`events.ts:664`), use real lastmod (a `content_changed_at` column, and drop `now` at `sitemap.ts:18,44,46,47,64,72`), and remove changefreq and priority.
- Add the 126 missing series pages (`events.ts:639`). Drop the `tbc-*` placeholders. Split via `generateSitemaps()` and an index.
- *Fail check:* the GSC "Crawled – currently not indexed" ratio for races doesn't improve after 6 weeks.

**12. Season-aware hubs.**
- Per-discipline season labels (`seo-race-copy.ts:590-593`).
- Discipline+year pages (`/cs/zavody/cz/mtb/2027`) and an indexable archive of the previous season.
- Fix plurals with `counted()`.
- *Fail check:* the CZ gravel hub flips to noindex again in October.

**13. New hub types** (index only at ≥ `MIN_RACES`):
- region × discipline (needs a region field in `events.ts`)
- kids series and balance bikes
- level (national cup / UCI)
- *Depends on:* 2 and 12.

**14. Trim locale duplication.** Consider listing a race only in the locales relevant to its country plus en, rather than all 5, or add locale-specific value (travel or entry notes). Measure first.
- *Fail check:* GSC shows "Duplicate, Google chose different canonical" on non-home-country locales.

## Phase 4: authority and monitoring (ongoing)
**15. Link earning:**
- An organiser badge and an embeddable next-races widget.
- iCal/JSON partner feeds for federations and clubs.
- A claim-your-race flow.
- An annual Central-Europe calendar data report.

**16. Crawler policy.** If `ai-train=no` is meant to be enforced, add explicit Disallow rules for training bots (GPTBot, ClaudeBot, CCBot, cohere-ai, Applebot-Extended). Allow the public `/api/events` in robots.txt.

**17. Monitoring.**
- Run `/seo drift baseline https://letsrace.cz` after Phase 1, and `drift compare` after each deploy.
- Add IndexNow, so changed race pages are pushed to Bing and Yandex.

**Low backlog:**
- HSTS includeSubDomains/preload, and hide `X-Powered-By`.
- 24 px breadcrumb tap targets.
- Delete the unused `og-race-v2.png` and `Geist-*.ttf`.
- Fix the MCP card URL and the nested `<main>`.
- Remove the deprecated `Host:` line from robots.txt.
- Merge the duplicate SK cyclocross series.
