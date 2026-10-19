# Performance / Core Web Vitals: letsrace.cz (audit 2026-10-10)

Performance score: 62/100 (weighted: content pages are 91-100, the home page, the most important URL, is 28 on mobile).

## Method and limits
- PSI API (keyless) returned 429 (daily quota exhausted), so no PSI and no CrUX field data. lcp_subparts.py needs a Google API key (not run). preload_check.py ran (score 50).
- Lab data = local Lighthouse 13 (Chrome, default simulated mobile throttling and desktop preset), one run per URL/form factor. Single runs, so expect noise. Raw JSON is in the scratchpad dir `perf/lh_*`.
- INP is not measurable in the lab and there is no field data (unmeasured). TBT is the proxy.
- curl TTFB: 5 samples per URL from this machine.

## Metrics (Lighthouse lab; TTFB = Lighthouse server-response-time)
| Page | Form | Score | FCP | LCP | TBT (INP proxy) | CLS | TTFB |
|---|---|---|---|---|---|---|---|
| Home /cs | mobile | 28 | 1.94 s | 4.76 s (poor) | 1992 ms (poor) | 0.456 (poor) | 184 ms |
| Home /cs | desktop | 79 | 0.47 s | 0.70 s | 0 | 0.277 (poor) | 52 ms |
| Race page | mobile | 93 | 1.17 s | 3.23 s (NI) | 78 ms | 0.000 | 34 ms |
| Race page | desktop | 99 | 0.43 s | 0.83 s | 0 | 0.000 | 48 ms |
| Hub /cs/zavody/pl | mobile | 91 | 1.17 s | 3.24 s (NI) | 10 ms | 0.000 | 55 ms |
| Hub | desktop | 100 | 0.33 s | 0.68 s | 0 | 0.000 | 120 ms |
| Series | mobile | 91 | 1.15 s | 3.39 s (NI) | 101 ms | 0.000 | 36 ms |
| Series | desktop | 100 | 0.44 s | 0.51 s | 0 | 0.000 | 49 ms |

curl TTFB (5 runs): race 0.30-0.40 s, series 0.16-0.33 s, hub 0.35-0.44 s (outliers 1.0-1.75 s, which were TLS/connect stalls), home 0.29-0.57 s. curl time_total on home was 2.3-3.1 s every run, others 0.2-1.0 s.

## Findings

### 1. [HIGH] Every page is dynamically rendered because of the root layout (explains `private, no-store`)
- `src/app/layout.tsx:91` does `await headers()` (reads `x-locale`, set by `src/proxy.ts:89`) just to set `<html lang>`. A dynamic API in the root layout makes every route dynamic. That is why the `revalidate` and `generateStaticParams` exports are inert (`(map)/page.tsx:9,11`, `c/page.tsx:13`, `[locale]/layout.tsx:7`, `c/[code]/page.tsx:32`, `list`, `schedule`) and why HTML is `cache-control: private, no-cache, no-store`, `x-vercel-cache: MISS`. It also disqualifies the page from bfcache (preload_check flags this).
- Other forcing points: `src/app/not-found.tsx:9` (headers), `(map)/page.tsx:25` (`await searchParams` for `?e=`), `force-dynamic` on `c/[code]/[discipline]/page.tsx:25`, `collections/[slug]/[[...country]]/page.tsx:18` and the account routes (those are fine).
- Correction to the brief: the "TTFB 1.3-3.5 s" was curl total time. Server response is only 34-184 ms in Lighthouse and about 0.2-0.4 s in curl including TLS. The home total is long because of finding 2. The real cost of the dynamic rendering is origin compute plus Supabase on each hit and no edge cache, not a slow TTFB today.
- Fix (verified against `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/next-root-params.md`): move `<html>/<body>/providers` into `app/[locale]/layout.tsx` (make it the root layout) and use `import { locale } from "next/root-params"` for `lang`. Non-locale routes (`app/admin`, `app/page.tsx`, `not-found.tsx`) need their own root layouts via route groups, and the 404 needs `global-not-found` (experimental) or a locale-scoped `not-found`. Then add `export const revalidate = 3600` and `generateStaticParams() { return [] }` to `e/[slug]/page.tsx`, `series/[slug]/page.tsx` and the hub pages for on-demand ISR (docs: "return an empty array ... to revalidate (ISR) paths at runtime"). For the home page, drop `searchParams` at `(map)/page.tsx:25` by handling `?e=` in the client (nuqs) or the proxy. Expected result: `x-vercel-cache: HIT`, edge TTFB of roughly 30-60 ms, bfcache eligible. This was not tested because the audit is read-only.

### 2. [HIGH] Home HTML streams for 2.3-3.7 s (SiteIndex Supabase waterfall)
- `src/components/seo/site-index.tsx:24-29`: `Promise.all` of `listQualifyingHubs` and `listEvents` (10 days), then a second sequential `await listEvents` (120 days, CORE countries, with joins on series, sources and categories) at line 29. The result is only an `sr-only` nav. The lab document request completes at 3.4-3.7 s (mobile and desktop).
- Fix: run all three queries in one `Promise.all`. Better, cache them (`unstable_cache` or ISR from finding 1), select only slug and name columns, and cap the rows (the 120-day list is reduced to 24 series by `seriesIn(...).slice(0,24)`).

### 3. [HIGH] Home mobile: CLS 0.456, TBT 1992 ms, LCP 4.76 s
- CLS (mobile): shift 0.39 + 0.066 on `div#race-list-mobile` rows (`explore-shell.tsx:1180-1220`), and 0.02 on the MapLibre attribution control. Desktop CLS 0.277 comes from `main#race-list` rows. Likely cause: placeholder `ListSkeleton` rows are `h-[60px]` (`src/components/explore/list-skeleton.tsx:14`), while real rows are taller (the comment in `(map)/loading.tsx` says 90px). Swapping them moves the content. The root cause is not proven (single run).
- Fix: make skeleton row height identical to the real `EventCard` row and give the list container a fixed height, and reserve the attribution size.
- TBT: `/maplibre/6.13.0/maplibre-gl.mjs` is 1.08 MB raw (288 KB on the wire, 169 KB unused). Script evaluation is 3.4 s under 4x CPU throttle. It is loaded by `loadMapLibre()` (`src/lib/maplibre.ts:17-41`) as soon as the map mounts. Fix: on mobile defer map init until after LCP/idle or first interaction and show a static map poster. It is already immutable-cached (`next.config.ts` maplibre header) and lazy.
- LCP: element is the `intro-race@2x.webp` image (`explore/welcome-card.tsx:83-92`, preloaded at `(map)/page.tsx:73-79`). Subparts: TTFB 402 ms, load delay 423 ms, load duration 2339 ms, render delay 32 ms. The image download (825-3164 ms) overlaps the 3.4 s streaming document and the 21 parallel scripts/tiles. Fixing finding 2 should help most. Also serve the 1x asset to phones (the 70 KB @2x is picked at DPR >1.75) and give `/intro-race*.webp` a long cache header (currently `public, max-age=0, must-revalidate`; add a `headers()` entry in `next.config.ts`).

### 4. [MEDIUM] Inlined CSS is emitted three times in each HTML document
- `next.config.ts:74` `experimental.inlineCss: true`. Each HTML has a 151,855-byte `<style>` plus two more 151 KB copies in the RSC flight data (`T24f75` chunks `2:` and `33:`). About 455 KB of the ~590 KB uncompressed HTML is this stylesheet, and the first RSC chunk is 343-383 KB. On the wire, brotli collapses it (document 57-72 KB), so network cost is small, but the browser parses about 450 KB more, and it is uncacheable across pages. Content pages ship 26 scripts (348 KB) and no images.
- Fix: test with `inlineCss` off (a cached immutable `<link>` stylesheet, fonts already preloaded) and compare FCP, or file the duplicate CSS flight chunks as a Next 16.4 issue. Not verified by build.

### 5. [MEDIUM] Content-page LCP is 3.2-3.4 s on mobile (needs improvement) while FCP is 1.15 s
- LCP element is a text paragraph (race: summary `<p>`; hub/series: intro `<p>`). The observed render delay is 0.35-2.5 s (hub 2468 ms, possibly noise). The single lab run suggests the text is revealed after the `loading.tsx` skeleton via React's streaming replace script. No render-blocking resources, no preconnect needed. With static/ISR HTML (finding 1) the content would be in the initial document. Re-test after finding 1.

### 6. [LOW] Fonts and other
- One font file, Geist_Variable woff2, 68 KB, preloaded; font-display insight passes. Subsetting to latin and latin-ext would save a little. `src/app/_fonts/Geist-*.ttf` appears unused.
- `Link` header on `/cs` carries 6 agent-discovery rels (`src/proxy.ts:90-92`), harmless.
- No speculation rules (preload_check): add `<script type="speculationrules">` for hub to race navigations once pages are cacheable.

## Unmeasured
CrUX/field LCP/INP/CLS, PSI scores, lcp_subparts.py (no API key), multi-run lab variance, effect of any fix.
