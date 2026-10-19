# Technical SEO findings: letsrace.cz (2026-10-10)

Technical score: 58/100. Strong basics (HTTPS, canonicals, SSR, sitemap hreflang, security headers). Dragged down by broken race og:image/JSON-LD image on every race page, wrong hreflang on discipline hubs, soft-404 status codes, thin internal linking to race pages, and no-store HTML everywhere.

Scope note: sample = 21 sitemap URLs x 5 locales (105 pages: 9 races, 4 series, 3 country hubs, 3 collection/discipline hubs, root hub, home), plus 60 random sitemap URLs, plus targeted probes. The coordinator stopped further fetching. Anything marked UNCHECKED was not verified.

## Pass/fail by category
| Category | Status |
|---|---|
| Crawlability (robots, sitemap) | Pass, with Low issues |
| Indexability (canonical, hreflang, status codes) | Fail (hreflang on discipline hubs, soft 404s) |
| Security headers | Pass (Low/Info items) |
| URL structure | Pass |
| Mobile | Pass |
| Core Web Vitals potential | Needs work (no-store, 590 KB HTML) |
| JS rendering | Pass (full SSR) |
| Structured data | Fail on image URL (details in other findings) |
| IndexNow | Not implemented |

## Critical / High

### 1. Critical: race og:image, twitter:image and JSON-LD `image` all 404 (every race page, all 5 locales, ~10,080 URLs)
- Evidence: page emits `https://letsrace.cz/cs/zavod/<slug>/opengraph-image`. Live: 404 (also `/en/race/<slug>/opengraph-image`). The route Next actually built is hashed: `.next/app-path-routes-manifest.json` has `/[locale]/e/[slug]/opengraph-image-vodtca`, and `/en/race/<slug>/opengraph-image-vodtca` returns 200 image/png. The hash is a build artifact and can change.
- Impact: no social previews, and the SportsEvent `image` that Google validates points to a 404.
- Fix:
  - `src/app/[locale]/(shell)/e/[slug]/page.tsx:63`: stop hand-building `imagePath`. Let Next inject the file-convention image (omit `images` for events in `socialCard`, `src/lib/seo.ts:286-311`), or serve the card from a stable route handler (for example `src/app/api/og/[slug]/route.ts`) and point to that.
  - `src/components/seo/event-json-ld.tsx:74`: use the same stable URL.

### 2. High: on-page hreflang on discipline hubs points to redirecting URLs and disagrees with the sitemap (25 en hubs x 5 = 125 URLs)
- Evidence: on `/cs/zavody/pl/gravel` the alternates are `/en/zavody/pl/gravel`, `/pl/zavody/pl/gravel` and so on, with the segment of the current locale. On `/en/races/cz/bmx` they are `/cs/races/cz/bmx` and so on. These 308 to the right URL, are non-reciprocal, and differ per page. The sitemap versions are correct, so the two sources conflict.
- Cause: `localeAlternates(path)` is given an already-localized `hubPath`, which `localePath()` cannot translate.
- Fix: `src/app/[locale]/(shell)/c/[code]/[discipline]/page.tsx:62` becomes `languages: localeAlternates((l) => hubPath(l, code, discipline))`, as in `c/[code]/page.tsx:59`.
- All other types checked (races, series, country hubs, collections, home): 80 of 105 pages had a self-canonical, `html lang` matching the locale, hreflang identical to the sitemap, and full reciprocity. The 20 not clean are the discipline hubs above; for the other 5 I did not record which check they failed (UNCHECKED).

### 3. High: soft 404s (HTTP 200) for missing race, series and hub
- Evidence (Googlebot UA, and the race case with Chrome UA too):
  - `/en/race/does-not-exist-2026` returns 200.
  - `/cs/serie/nonexistent` returns 200.
  - `/cs/zavody/xx` returns 200.
  - `/cs/zavody/pl/notadiscipline` returns 200.
  - `/cs/zavod/Maifelder-Gravel-Loops-2026` (uppercase) returns 200 with "Závod nenalezen".
  - Each carries `noindex` (so the index is protected), but the canonical points at the locale home.
  - Truly unmatched paths return 404: `/en/nonsense`, `/xx/race/foo`, `/EN`, `/CS/zavody/pl`, `/e/<slug>`.
- Cause 1: `e/[slug]/page.tsx:75` returns `<MissingRace>` JSX instead of calling `notFound()` (component defined around line 329).
- Cause 2: `loading.tsx` in `e/[slug]`, `series/[slug]`, `c/[code]` and `c/[code]/[discipline]` starts streaming, which commits 200. Next docs (`node_modules/next/dist/docs/01-app/02-guides/streaming.md:613-640`) say a mid-stream `notFound()` only injects noindex.
- Fix: remove those `loading.tsx` files, or do the existence check in `proxy.ts` or a layout above the Suspense boundary. Then use `notFound()` in `e/[slug]/page.tsx:75`, `series/[slug]/page.tsx:78` and `c/[code]/page.tsx:78`.
- Canonical on noindex error pages (`generateMetadata` fallbacks) should be dropped.
- UNCHECKED: a real 404 after the `loading.tsx` removal.

### 4. High: country hubs no longer link to race pages; race pages are poorly linked
- Evidence from anchors in SSR HTML:
  - `/en/races/cz` (99 races) has 0 `<a>` links to `/en/race/...`. The races appear only in the JSON-LD ItemList. Only discipline tiles are linked. The code comment at `c/[code]/page.tsx:83` says "every race a link", but the JSX (lines 106-150) renders no list.
  - `/en/races/cz/road` has 20 race anchors.
  - `/en/races/this-weekend/cz` has 13.
  - `/en/` has 40.
  - A series page has 2.
  - `/en/list` and `/en/races` have 0.
  - A race page has ~11 internal links, none to sibling races (the sample had no series).
- Impact: of 2,016 races, most are discoverable only via sitemap. The 20-per-discipline-hub count looks like a cap; whether it is a cap is UNCHECKED, as is the full orphan count.
- Fix: render the `events` list as anchors on the country hub (`src/app/[locale]/(shell)/c/[code]/page.tsx` after the TileGrid, reuse `RaceLinkList` from `src/components/seo/race-link-list`), and uncap the discipline hubs.

### 5. High: every HTML page is `no-store` and fully dynamic
- Evidence: `cache-control: private, no-cache, no-store`, `x-vercel-cache: MISS` on all 105 sampled pages, including the home page, even though it declares `revalidate = 120`.
- Cause: `src/app/layout.tsx:91` calls `await headers()` for `<html lang>`, and `src/app/not-found.tsx:9` does the same. This opts the whole app out of static rendering and CDN caching.
- Fix: derive `lang` from the `[locale]` param by moving `<html>` into `src/app/[locale]/layout.tsx`, keeping a minimal root layout for admin and the 404, and drop the `x-locale` header. Then use `revalidate` or ISR on race, series and hub pages, plus `Cache-Control: s-maxage` on the proxy output.
- Measured TTFB with curl: 0.18-0.40 s warm for race, home, hub and series (Chrome and Googlebot UA). Cold or random requests: the Python test of 60 random sitemap URLs (uncompressed, includes body download) had a slow tail of 5.6-9.9 s for 4 URLs.
- Caching would stabilize those. CONTEXT's 3.5 s home figure was not reproduced as TTFB (total time for `/cs` was 2.2 s once).

## Medium

### 6. Medium: HTML bloat from inlined CSS repeated 3x
- Evidence: raw HTML 591 KB for a race page; 42 inline scripts. The 155 KB stylesheet is in a `<style>` block (152 KB) and again twice inside the RSC payload (2 x 157 KB). Wire size: 58 KB brotli, 103 KB gzip. Googlebot's 2 MB HTML limit is not at risk (590 KB), but the parse cost is.
- Cause: `next.config.ts:74` `experimental.inlineCss: true`.
- Fix: test with `inlineCss` off and the CSS served as a cached `<link>`, now that HTML is not cached (finding 5 interacts).

### 7. Medium: sitemap lastmod is not trustworthy
- Evidence: 4,440 of 10,080 race entries have lastmod = today (2026-10-10). Home, hubs and countries are all `new Date()` at build/revalidate time. `src/app/sitemap.ts:44,46,64` pass `now`, and `:80` uses `updatedAt`, which a daily cron evidently touches.
- Impact: Google learns to ignore lastmod.
- Fix: use a content-change timestamp; omit lastmod for hubs, as already done for collections (`sitemap.ts:54`).
- Low: `changefreq` and `priority` (sitemap.ts:44-81) are ignored by Google and add bytes. The sitemap is one 9.5 MB file with 10,790 URLs (limits OK); consider an index split by type so Search Console can report per section (`generateSitemaps`).

### 8. Medium: past-race policy
- The sitemap keeps races for 30 days after the event (`src/lib/events.ts:664`). After that, the race page stays 200 and indexable forever (`e/[slug]/page.tsx:81` only changes copy via `isPast`). JSON-LD still says `availability: InStock` and `EventScheduled` for finished races (`event-json-ld.tsx:88`).
- Decision needed: keep as an archive (add `Offer` only when future, add results link prominence) or noindex or 410 after about 12 months. Pages from 2025 and earlier were UNCHECKED.

### 9. Medium: root redirect behaviour
- `https://letsrace.cz/`:
  - No Accept-Language, and Googlebot UA: 308 to `/en`. Source `src/app/page.tsx:10`; no `Vary`; `no-store`.
  - Accept-Language cs/sk/de/pl: 307 to `/cs` etc., with `Vary: Accept-Language` and `cache-control: public, max-age=0, must-revalidate`. Source `src/proxy.ts:58-67`.
  - Unsupported language (fr): 308 to `/en`.
- Googlebot, which sends no Accept-Language, always sees 308 to `/en` and `/` is never indexed, which is consistent with the sitemap. No ranking harm to Google.
- Risks:
  - The 308 is "permanent" for a URL whose destination depends on request headers. Browsers can cache a 308, but with `no-store` this is currently mitigated.
  - The 308 has no `Vary: Accept-Language`, so a shared cache could cross-serve.
  - Fix: make the whole thing one temporary redirect (307) from `proxy.ts` with `Vary: Accept-Language` on both branches and drop the `permanentRedirect` in `src/app/page.tsx:10`; keep `/en` as x-default in hreflang. This reverses the Search Console rationale in the `page.tsx` comment, so check Search Console first.
- Chain: `http://www.letsrace.cz/` is 308, then 308 (www), then 308 (`/en`): 3 hops (Low).

## Low / Info

- Low: HSTS is `max-age=63072000` without `includeSubDomains; preload` (platform default; add via `next.config.ts:9-34` if a preload submission is wanted). `X-Powered-By: Next.js` is exposed (`poweredByHeader: false`). No COOP/CORP headers (Info). CSP has `'unsafe-inline'` for script and style (needed for inline boot script, `layout.tsx:115`; consider nonces).
- Low: the 404 page for unmatched paths has `meta robots: index, follow` and the home title (`/en/nonsense`). Harmless due to the 404 status, but set `robots: noindex` in `src/app/not-found.tsx`.
- Low: duplicate `<meta name="robots">` on series and hub error pages (two identical tags). Cosmetic.
- Pass: trailing slash 308s to the non-slash URL (`/cs/zavody/pl/`, `/cs/`). Uppercase locale or section (`/EN`, `/CS/zavody/pl`, `/cs/ZAVOD/...`) returns 404, no duplicates. `/cs/e/<slug>`, `/cs/race/<slug>` and `/en/zavod/<slug>` 308 to the right language URL (`proxy.ts:50-55`). Query variants (`?utm_source=x`) return 200 with a canonical without the query. `/e/<slug>` without a locale returns 404. Only www/http redirect via `next.config.ts:76-88`.
- Pass: sitemap valid (`sitemap_discovery.py`: robots.txt declaration valid, 200, urlset); 10,790 URLs, hreflang in sitemap fully reciprocal and complete (6 alternates each). 60 random sitemap URLs: 60/60 returned 200. Sampled ones were `index, follow` and self-canonical. Exceptions inside the random sample were not itemised beyond that (UNCHECKED, the script printed no anomalies).
- Pass: JS rendering. Raw vs Playwright-rendered race page: 591,149 vs 595,643 chars; extracted text 255 vs 275 chars; JSON-LD identical (SportsEvent and BreadcrumbList); `is_spa: false`. Main content is in SSR HTML, not only the RSC payload. Googlebot is on `htmlLimitedBots` (`next.config.ts:45`) so metadata is in `<head>`.
- Pass: mobile. `viewport: width=device-width, initial-scale=1, viewport-fit=cover` (`layout.tsx:24-29`), no zoom lock. Touch targets not measured (UNCHECKED).
- Info: `robots.txt` (`src/app/robots.txt/route.ts`): `Allow: /`, `Disallow: /admin`, `/api/`, Sitemap present. The `Host:` line is Yandex-only and deprecated. No per-AI-bot rules; only Content-Signal.
- Info: IndexNow. No key file (`/indexnow.txt` returns 404), and no references to IndexNow in `src`, `public` or `scripts`. Fix: add a key file under `public/<key>.txt` and a ping from the daily catalog cron (`/api/cron/catalog`) with the changed URLs to `https://api.indexnow.org/indexnow` (helps Bing, Yandex, Naver, Seznam does not consume it). Low impact for Google.
- Info: `/llms.txt` is 404 (also in CONTEXT). Optional.

## Not verified
- Core Web Vitals field data (no CrUX access) and CLS.
- Past races older than 30 days.
- Orphan count of race pages beyond the 7 country hubs.
- Whether removing `loading.tsx` yields real 404s.
- Touch target sizes.
- The 5 of 20 non-clean pages not itemised in finding 2.
