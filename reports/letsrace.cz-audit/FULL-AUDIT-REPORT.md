# letsrace.cz: full SEO audit

**Date:** 2026-10-10 · **Business type:** event directory / programmatic race catalogue (5 locales, ~10.8k indexable URLs) · **Data:** live site + repo source (uncommitted working tree; deployed build may differ by a few lines)

## SEO Health Score: **52 / 100**

| Category | Weight | Score | Weighted |
|---|---|---|---|
| Technical SEO | 22% | 58 | 12.8 |
| Content Quality | 23% | 38 | 8.7 |
| On-Page SEO | 20% | 55 | 11.0 |
| Schema / Structured Data | 10% | 58 | 5.8 |
| Performance (CWV, lab only) | 10% | 62 | 6.2 |
| AI Search Readiness | 10% | 44 | 4.4 |
| Images | 5% | 55 | 2.8 |
| **Total** | | | **51.7** |

Supplementary scores, not part of the total: Sitemap 72, SXO gap 46, Backlinks INSUFFICIENT DATA (the domain isn't in the Common Crawl Q1-2026 graph).

**Limits:**
- No Google Search Console, CrUX or GA4 data. There are no API credentials, and PSI hit its keyless quota.
- Core Web Vitals figures are single local Lighthouse runs, and INP is not measured.
- SERP checks ran on non-Google engines, so they are directional only.

**Correction to the early brief:** the "TTFB 1.3–3.5 s" figures were curl total transfer time. Real warm TTFB is 34–400 ms, with occasional 5–10 s cold outliers.

---

## Executive summary

The foundations are solid:
- All content is server-rendered.
- Canonicals are self-referencing.
- Sitemap hreflang is fully reciprocal across 5 locales.
- Security headers are in place.
- 60 of 60 random sitemap URLs return 200.
- Titles and descriptions are templated sensibly.
- Every race page has SportsEvent and BreadcrumbList JSON-LD.

The score is held down by **five root causes**. Each one produces several of the findings below.

| # | Root cause | Symptoms it produces |
|---|---|---|
| A | `await headers()` in the root layout (`src/app/layout.tsx:91`, plus `not-found.tsx:9`) makes **every route dynamic** | `no-store` on all HTML, ISR/`revalidate` ignored, cold TTFB outliers, no bfcache. `loading.tsx` streaming then commits a 200 before a missing record is known, which causes **soft 404s** |
| B | **Catalog classification and place parsing** (`federciclismo.ts:47-49`, `seo-race-copy.ts:307-314`, `placeOf` ~l.362) | Wrong discipline in title, H1, breadcrumb and hubs (gravel → road, "short track" MTB → track). A country used as the town ("…, Switzerland"). A venue in `addressLocality` (16% of races). A wrong /it/track hub |
| C | **Thin programmatic template × 5 locales** with weak internal linking | Median 78 words per race page, the same ~40-word "About" on ~10k URLs, and locales that are translated chrome around identical facts. **Country hubs render zero race links**, so most race pages are reachable only via the sitemap |
| D | **Hardcoded OG image path** (`e/[slug]/page.tsx:63`, `event-json-ld.tsx:74`) | og:image, twitter:image and SportsEvent `image` return 404 on ~10k race pages (the real route is hashed `opengraph-image-<hash>`) |
| E | **No entity layer** | No Organization or WebSite JSON-LD, no /about, /contact or methodology page, no footer, no named operator, no sameAs. E-E-A-T trust is 12/30 and authority 8/25 |

### Top 5 critical / high issues
1. Race OG/JSON-LD image returns 404 on every race page (D). *Verified.*
2. Country hubs (`/cs/zavody/cz` 99 races, `/de/radrennen/de` 218, `/pl/wyscigi/pl` 186) show **no race links**, only tiles (C). *Verified.*
3. Thin content at scale: 154 of 201 sampled race pages are under 100 words, and about 49% of race URLs are past races, most with no results link (C).
4. Every page is dynamic and uncached (A).
5. Wrong discipline and place data in titles, H1 and schema (B).

### Top 5 quick wins (each under a day)
1. Fix the OG image URL in 2 files (D).
2. Render `RaceLinkList` on country hubs, as the discipline hubs already do (`[discipline]/page.tsx:144`).
3. Fix discipline-hub hreflang: `[discipline]/page.tsx:62` → `localeAlternates((l) => hubPath(l, code, discipline))`. *Verified that `/cs/zavody/cz/road` lists `/en/zavody/cz/road`, which is wrong.*
4. Add an Organization + WebSite `@graph` on the home page.
5. Emit `offers` only for upcoming races with open entry. Drop the registration URL from `sameAs`.

---

## 1. Technical SEO: 58

**Passing:**
- Full SSR (raw 591k vs rendered 596k chars).
- Self-canonicals are correct.
- Trailing slash → 308 to the non-slash URL; uppercase → 404.
- HTTPS, www and http all 308 to the apex.
- CSP, XFO, nosniff, Referrer-Policy and Permissions-Policy are set.
- robots.txt is clean.

| Sev | Finding | Fix |
|---|---|---|
| Critical | Race og:image/twitter:image/JSON-LD image return 404 | `e/[slug]/page.tsx:63`, `event-json-ld.tsx:74`; stop overriding the file-convention image in `src/lib/seo.ts:286-311`, or serve from a stable route handler with long Cache-Control |
| High | Discipline-hub on-page hreflang uses the cs path segment for every locale (125 URLs). Non-reciprocal, 308s, contradicts the sitemap | `c/[code]/[discipline]/page.tsx:62` |
| High | Soft 404s: unknown race/series/hub slugs return 200 + noindex, with the canonical set to the locale home | `e/[slug]/page.tsx:75` returns `<MissingRace>`; remove `loading.tsx` from the e/series/c/discipline routes (or resolve existence before streaming) and call `notFound()` |
| High | Country hubs have no race `<a>` links, so race pages are effectively orphaned | `c/[code]/page.tsx:113-149` |
| High | All HTML is `private, no-store`, so `revalidate` and `generateStaticParams` are ignored | Move `<html lang>` into `app/[locale]/layout.tsx` (use `next/root-params`), give admin and the root its own root layout, then use ISR |
| Medium | Root `/` → 308 `/en` for Googlebot (no `Vary`), 307 for cs/de/pl/sk | `src/app/page.tsx:10`, `src/proxy.ts:58-67`; use 307 consistently with `Vary: Accept-Language` |
| Medium | CSS is embedded 3× per document (~455 KB of ~590 KB raw HTML) | `next.config.ts:74 inlineCss`; test with it off |
| Low | HSTS has no includeSubDomains/preload. `X-Powered-By` is sent. Unmatched 404 page has `index, follow`. Duplicate robots meta on error pages. Deprecated `Host:` in robots.txt. No IndexNow. No Bing verification (`layout.tsx:83`) | |

## 2. Content quality: 38 · On-page: 55

E-E-A-T: Experience 6/20, Expertise 12/25, Authoritativeness 8/25, Trust 12/30.

| Sev | Finding | Evidence | Fix |
|---|---|---|---|
| Critical | Thin programmatic pages | Median 78 visible words and ~13 race-specific facts. 154 of 201 are under 100 words. sk vs cs token overlap is 0.41, the same facts in a translated template. Quality gate is 400 words / 80% unique | Add catalog data already held (below). Noindex past races that have no results and no next edition |
| High | Wrong disciplines | `federciclismo.ts:47` matches `pista\|track` (catches MTB "short track"); `:49` defaults unknown races to road. `seo-race-copy.ts:307-314` reads "Track" out of "OFF TRACK MTB". Maifelder Gravel → road, Stelvio Santini → gravel, slowUp tagged XCO+gravel+road | Classify on structured source fields first and use name heuristics only as a fallback. Make "unknown" a real value instead of road |
| High | Country used as the town | `placeOf` takes the last comma part, giving titles like "3 Jours d'Aigle 2026 – …, Switzerland" (8 of 201) | Use `municipality` and fall back to the second-to-last part only when the last part is a country |
| High | No trust pages | /about, /contact and methodology all 404. No footer. Privacy is linked only from the auth form | Add an About/methodology page (sources, update cadence, who runs it), contact, and a footer |
| Medium | Descriptions promise "other races nearby", but no such section exists (148 of 201) | `seo-race-copy.ts:583`; the copy at `:27` is never shown | Render the nearby-same-weekend block (coordinates are already stored) |
| Medium | ALL-CAPS and scraped junk in H1 (42 of 201, e.g. "…PŘIHLÁSIT SE SEZNA") | `unshout` is applied to the title but not the H1 (`page.tsx:171-173`) | Apply it to the H1 too. Strip CTA text during ingest |
| Medium | Duplicate series pages (nolimited-cup-cx / slovensky-pohar-cx) | | Merge, 301 |
| Low | "1 závodů", "43 wyścigów" plurals. Titles over 60 chars because of the brand rule at `seo.ts:226` | | Use `counted()` |

**Content to add with no LLM spend** (already in the catalog):
- Distance and age range per category (`events.ts:58-65`). Today only the names render, at `page.tsx:215`.
- Source domain plus a "last updated" date (`sources`, `events.ts:521`).
- Races the same weekend nearby.
- A prev/next edition link.
- A visible discipline-hub link (computed at `page.tsx:134`).
- "Round X of N" in the series.
- A results link for past races.

## 3. Schema: 58

Checked on all 1,989 /en race pages, plus hubs, series and home.

| Sev | Finding | Fix |
|---|---|---|
| Critical | `image` returns 404 (root cause D) | see Technical |
| High | 44 races (2.2%) have no `location`, which Google requires. 50 more have no geo | `event-json-ld.tsx:93`; skip JSON-LD or fill in the location |
| High | `addressLocality` misused on 312 of 1,986 (16%): venues, "Todtnau, Germany", the placeholder "lokalita v jednání" | `event-json-ld.tsx:49,93-104`; put the venue in `Place.name` and a clean municipality in the locality |
| High | 772 Offers all say `InStock` (345 are past races). None has a price. Only 46 have `validThrough`. Some URLs are uci.org or Strava pages | `event-json-ld.tsx:84-92`; emit only for upcoming races with open entry, and add `validThrough` from the entry deadline |
| Medium | No `organizer` (no column in `events.ts:91`) | Interim: `Organization{name: series or host, url: websiteUrl}` |
| Medium | Home, /races and /series have no WebSite or Organization | `@graph` in `(map)/page.tsx` (no SearchAction; that feature is retired) |
| Medium | Cancelled races 404, so the `EventCancelled` branch is dead code. Postponed has no `previousStartDate` | Keep cancelled pages live with EventCancelled for ~30 days |
| Low | Missing `inLanguage`. Hub `numberOfItems` 99 vs 50 items listed. Series breadcrumb uses the long H1. Race breadcrumb omits the series | `hub-json-ld.tsx:59,63,72-76` |

## 4. Sitemap: 72

**Passing:**
- 10,790 URLs, 9.5 MB (219 KB gzipped).
- Hreflang is reciprocal.
- 60 of 60 sample URLs return 200 and are canonical.
- Hub pages follow the `MIN_RACES` = 8 threshold.

**Issues:**
- **High:** about 49% are past races (`events.ts:664` keeps them 30 days).
- **High:** lastmod is fake on 165 home and hub URLs (`now`, at `sitemap.ts:18,44,46,47,64,72`). 44% of races carry today's DB batch time (`sitemap.ts:80`), so add a `content_changed_at` column.
- **Medium:** 126 indexable series pages are missing (`events.ts:639` drops series with no upcoming rounds).
- **Medium:** no split. Use `generateSitemaps()` (core / series / races-{locale} / races-past) with a manual index route.
- **Medium:** the 13 `tbc-*` placeholder races should be dropped, and 3 "Race not found" URLs should come out of the sitemap.
- **Low:** remove changefreq and priority (615 KB that Google ignores).

## 5. Performance: 62 (lab)

| Page | Form | LH | LCP | TBT | CLS |
|---|---|---|---|---|---|
| Home /cs | mobile | **28** | 4.76 s | 1992 ms | 0.456 |
| Home /cs | desktop | 79 | 0.70 s | 0 | 0.277 |
| Race | mobile | 93 | 3.23 s | 78 ms | 0 |
| Hub | mobile | 91 | 3.24 s | 10 ms | 0 |
| Series | mobile | 91 | 3.39 s | 101 ms | 0 |

**Issues:**
- **High:** root cause A.
- **High:** the home document streams for 2.3–3.7 s. A second sequential `listEvents` query in `site-index.tsx:24-29` feeds only an sr-only nav; merge it into the first `Promise.all`.
- **High:** home CLS. Skeleton rows are `h-[60px]` (`list-skeleton.tsx:14`) while real rows are about 90 px, and the map skeleton changes width (1302→902 px).
- **High:** home TBT. maplibre (1.08 MB raw) loads eagerly (`src/lib/maplibre.ts:17-41`); defer it to idle or first interaction on mobile.
- **Medium:** the intro LCP image is served with `max-age=0`.
- **Medium:** CSS is embedded 3×.
- **Low:** unused `Geist-*.ttf`, no speculation rules.

## 6. Images & visual: 55

**Issues:**
- **High:** OG 404 (D).
- **Medium:** home CLS (above).
- **Medium:** on home, the H1 is sr-only and the welcome card covers ~40% of the mobile viewport.
- **Medium:** race, hub and series pages have no images and no map.
- **Medium:** past races still lead with the "Race website" CTA.
- **Low:** mobile breadcrumb tap targets are 20 px (under the WCAG 2.2 AA 24 px minimum; `ui/breadcrumb.tsx`).
- **Low:** `max-age=0` on `/intro-race*.webp` and category SVGs.
- **Low:** `public/og-race-v2.png` (2.7 MB) is unused.
- **Low:** default OG image is 250 KB.
- **Low:** hubs and series reuse the default OG image.

**Fine:** no horizontal overflow, 16 px body text, no consent interstitial.

## 7. AI search readiness: 44

**Crawler access:** all 18 AI and search bot UAs get 200. No bot blocking. `ai-train=no` is a preference only. If that is the intent, block GPTBot, ClaudeBot, CCBot, cohere-ai and Applebot-Extended explicitly, and keep Google-Extended allowed.

| Sev | Finding | Fix |
|---|---|---|
| High | No Organization or WebSite schema, no sameAs, zero third-party mentions found | (E) |
| High | Coverage: the CZ gravel hub has 1 race in the next 12 months; CZ 2027 has 28 races | More sources (a data issue, not markup) |
| Medium | Entry-closed races still say "registration open" (`seo-race-copy.ts:420-424`) | |
| Medium | Distances are loaded but never shown. No fee. Facts are in `div` rows rather than `dl` or `table` | Category/distance table as a `<table>` or `<dl>` |
| Medium | robots.txt `Disallow: /api/` blocks the public `/api/events` that the AI catalogs advertise | `robots.txt/route.ts:18`: add `Allow` lines |
| Low | MCP server card advertises an HTML URL. Nested `<main>` (`ui/sidebar.tsx:310`). `/api/events` returns 830 KB with no paging | |

## 8. Search experience (SXO gap 46)

**Issues:**
- **Critical:** country hubs are a "directory of directories" with no race list (C). What ranks for "kalendář závodů" is a year-scoped race list.
- **High:** `seasonLabel()` labels every discipline "2026/27" (`seo-race-copy.ts:590-593`), which only suits cyclocross. The rolling 12-month window drops the past season in October; CZ gravel falls to 1 race and goes noindex. Add discipline+year pages (`/cs/zavody/cz/mtb/2027`) and an indexable archive of the previous season.
- **High:** no region hubs (Bundesland, województwo, kraj), and there is no region field in `events.ts`.
- **Medium:** the year is in race slugs, so each edition starts from zero. 301 a past edition to the next one.
- **Medium:** kids — add a balance-bike collection and a kids-series hub.

**Personas:**

| Persona | Weakest page | Score |
|---|---|---|
| Team manager | Country hub | 38 |
| Amateur racer | Country hub | 42 |
| Parent | Discipline hub | 46 |

## 9. Backlinks: insufficient data

**Data:**
- letsrace.cz is absent from Common Crawl Q1-2026. For comparison, rad-net.de is HC #74k and ceskysvazcyklistiky.cz is HC #1.55M.
- Connect GSC and Bing Webmaster Tools for real link data.

**Link tactics:**
- An organiser "Listed on Let's Race" badge, plus an embeddable next-races widget.
- iCal/JSON feeds for federations and clubs in exchange for a partner link.
- A claim-your-race flow.
- An annual calendar data report.

---

Per-category evidence: `findings/*.md`. Screenshots: `screenshots/`. Prioritised plan: `ACTION-PLAN.md`.
