# SEO audit: letsrace.cz (2026-11-02)

**Business type:** directory / publisher of structured event data (cycling races), programmatic at scale.
**SEO Health Score: 76 / 100** (was 81 before Search Console data; provisional because Core Web Vitals field data and PageSpeed are still unavailable).

> **Headline:** the page-level SEO is in good shape, but Google has indexed **2 of ~10,400 known URLs** (see C1). Everything else matters less until that changes.

## Scope and method
Inline audit, no subagents. Fetched robots.txt, the 8.3 MB sitemap (9,510 URLs), the homepage in two languages, and 15 page types (2 race pages for most locales, series, country/discipline collections, list, calendar, about). A further random sample of 60 race pages across all five locales was checked for status, canonical, title and schema. This is a sample, not a 500-page crawl.

| Category | Weight | Score |
|---|---|---|
| Technical SEO | 22% | 70 (markup is clean, but indexation is 0.02%) |
| Content quality | 23% | 65 |
| On-page SEO | 20% | 82 |
| Schema | 10% | 78 |
| Performance | 10% | 80 (TTFB only, provisional) |
| AI search readiness | 10% | 88 |
| Images | 5% | 85 (no `<img>` on sampled pages; nothing to fail) |

## What works
- One canonical per page, self-referencing, 60/60 sampled race pages returned 200 with matching canonical.
- Full hreflang set (en, cs, pl, sk, de + x-default) on every sampled page and in the sitemap, with localized URL slugs (`/race/`, `/zavod/`, `/wyscig/`, `/pretek/`, `/rennen/`).
- Clean redirects: http→https, www→apex, trailing slash 308, unknown race → real 404 with `noindex`.
- robots.txt is minimal and correct (blocks only `/admin` and `/api/`, declares the sitemap).
- Sitemap: 9,510 unique URLs, under the 50k / 50 MB limits, `lastmod` on 97%.
- `SportsEvent` + `BreadcrumbList` JSON-LD on race pages with start/end date, status, attendance mode, geo coordinates, organiser site in `sameAs`, ticket URL. `CollectionPage` on series/collections, `Organization` + `WebSite` on home.
- Descriptive, unique meta descriptions in the page's own language (76–146 chars).
- Server response 150–400 ms on cached pages; HSTS, `nosniff`, frame denial, CSP present.
- AI readiness: `Content-Signal` in robots.txt, `/.well-known/ai-catalog.json`, `/openapi.json`, link headers advertising them.

## Findings

### Critical
**C1. Google has indexed 2 of ~10,400 known URLs.** From the Search Console coverage export (data to 2026-10-23, sitemap "All known pages"):

| Status | Pages |
|---|---|
| Indexed | 2 |
| Discovered – currently not indexed | 10,372 |
| Crawled – currently not indexed | 15 |
| Page with redirect | 2 |
| Duplicate, Google chose different canonical | 0 (validation passed) |

The 10,389 "not indexed" appeared on 2026-10-07, when the sitemap was first processed; the indexed count has stayed at 2 since September. Total impressions over the 54 days: 42.

What this means:
- "Discovered – currently not indexed" is the dominant state (99.8%). Google found the URLs but has not crawled them. Only 15 pages were crawled and rejected, so the **thin-content theory (old H1) is not what is blocking you today**; the problem is that Google has not yet decided the site deserves crawling. Typical causes: a new domain with almost no external links, a very large batch of near-identical URLs submitted at once (9,510 in the sitemap, ×5 locales), and low early trust.
- Hreflang, canonicals, schema and redirects all test clean, and no duplicate-canonical conflicts were reported, so there is nothing technical to "fix" that would flip this.
- The site went public on 2026-10-20, but the export stops at 2026-10-23, so the effect of the launch on crawling is not yet visible. Re-export in 1–2 weeks.

### High
**H1. About 8,800 near-template race pages will be the next hurdle.** Race pages carry 150–220 words, mostly generated from structured fields. Once Google starts crawling them, 15 are already "Crawled – currently not indexed", an early sign. Add per-page value (nearby races, previous edition link, venue/region and series context) before the bulk crawl arrives.

### Medium
**M1. Title length is inconsistent.** In 60 sampled race pages, 16 titles exceed 60 characters (max 72), and 23 drop the " · Let's Race" suffix. The suffix drop looks like a deliberate length budget, but the long ones will truncate in results. One duplicate title in the sample: "CycloCross im STEVENS-Cup 2026/2027 Mölln" (two different pages). Make the budget cap the whole title at about 60 and add the location or date to disambiguate.

**M2. `SportsEvent` is missing recommended fields.** No `organizer`; `location` has no street address or venue name; `offers` has a URL but no `price`, `priceCurrency`, `availability` or `validFrom`. Google's event rich result needs only name, start date and location, so this is eligibility polish, not a blocker. Add `organizer` (name + url) where known; add offer price/availability only when the data is verified.

**M3. A race page without a date emits no `SportsEvent`** (`/pl/wyscig/rallye-sudety-2027` has only `BreadcrumbList`). This is correct behaviour for an unconfirmed date. Just confirm it is intentional and that such pages are not in the sitemap if they are low value.

### Low
- **L1. `/list` and `/calendar` are near duplicates** (≈800 words each, identical 65 links, separate canonicals) and have no structured data. Differentiate the copy, or add an `ItemList`/`CollectionPage` to each.
- **L2. 404 page emits two robots metas**, `noindex` and `index, follow`. The 404 status wins, but remove the conflicting tag.
- **L3. Uncached collection pages are slow:** `/en/races/kids/ch` ≈0.9 s and `/cs/zavody/ch/road` ≈1.0 s server time (vs 150–400 ms elsewhere), 219–311 KB HTML. Probably first-hit renders; check cache hit rate and consider trimming the payload.
- **L4. Homepage HTML is 224 KB** (1,500 words including a long race list). Fine for crawling; worth trimming for mobile.
- **L5. Root `/` is a 308 → `/en`, or 307 → `/cs` with Czech `Accept-Language`,** with `no-store`. Crawlers without a language header always get `/en`. For a `.cz` domain with a Czech-first audience, consider whether `/cs` should be the x-default.
- **L6. Sitemap:** 295 URLs lack `lastmod`; `changefreq`/`priority` are ignored by Google. Splitting into per-type sitemaps (races, series, collections) would make GSC coverage reporting much more useful.
- **L7. Security headers:** CSP allows `'unsafe-inline'` scripts; HSTS has no `includeSubDomains`/`preload`.
- **L8. Sampled titles/H1 inherit source casing** (e.g. "6^ TRE VALLI VARESINE WOMEN'S RACE"). Cosmetic.

### Info
- No `llms.txt` (optional; Google ignores it). `ai-catalog.json` already covers agent discovery.
- No FAQ schema, which is correct (Google retired FAQ rich results in May 2026).

## Not measured
- **Core Web Vitals (LCP/INP/CLS):** PageSpeed Insights keyless quota was exhausted and no CrUX key is configured. Only server response time was measured.
- **Search Console:** only the coverage export is in (`gsc/`, data to 2026-10-23). The Performance (queries/clicks) export and Crawl stats are not, and the coverage export has no per-locale or per-URL breakdown, so it is unknown *which* two URLs are indexed.
- Backlinks (no Moz/Bing keys), visual/mobile screenshots, full 500-page crawl.

## Search Console, checked live on 2026-11-02
- **Sitemaps:** one submitted (`/sitemap.xml`), last read 29 Oct 2026, 9,250 discovered pages, status Success.
- **Crawl stats (90 days):** 906 requests, 173 ms average response, host "No problems". Only 5% of requests were HTML pages (about 45 pages); 74% were JavaScript files. 99% "refresh", <1% "discovery". The server is not what holds Google back: Google is simply asking for very few pages.
- **URL Inspection:**
  - `/en` — indexed (one of the two).
  - `/cs` — *Crawled – currently not indexed* (crawled 29 Oct, fetch OK, indexing allowed, canonical accepted). Google saw the Czech homepage and chose not to index it yet.
  - `/cs/zavody` — *Crawled – currently not indexed* (crawled 10 Oct).
  - `/cs/kalendar` — *URL is unknown to Google*, despite being in the sitemap.
  - Inspection reports "No referring sitemaps detected" for these URLs, so the sitemap has not yet tied them to Google's discovery.
- **Indexing requested** on 2026-11-02 for `/cs`, `/cs/kalendar`, `/cs/zavody`.

Reading: with the Czech homepage crawled and rejected, the problem is site-level trust (new domain, few or no inbound links), not crawl capacity or markup. Links from Czech cycling sites and organisers are the strongest lever; the sitemap split makes progress measurable per part.

## Medium and Low follow-up (2026-11-02)
| Finding | Outcome |
|---|---|
| M1 long titles / duplicate | **Not an issue.** The 72-char figure counted `&#x27;` as six characters. Real titles are ≤60 chars plus the brand suffix only when the whole fits in 65 (`brandedTitle`). The "duplicate" was one race in two languages. |
| M2 SportsEvent fields | **No change.** Fee and availability are left out on purpose (a registration link does not prove entries are open); there is no organiser name in the data to publish. Needs data collection first. |
| M3 race without SportsEvent | **Intentional.** The block is omitted when a race has no location, because Google treats an Event without one as an error. |
| L1 list vs calendar | **Left as is.** Same crawler preview by design; each has its own title, description and canonical, and the interactive views differ. |
| L2 404 robots conflict | **Fixed.** Removed the site-wide `index, follow`; 404 pages now carry only `noindex`, other pages are indexable by default. |
| L3 slow collection pages | **Not an issue now.** 0.15–0.28 s uncached, 0.09–0.18 s cached after the latest deploy; the ~1 s seen earlier was a cold render. |
| L4 HTML weight | **Open.** Collection pages are 220–550 KB; worth trimming as part of the race page work. |
| L5 default language | **Fixed.** `/` without a language preference and `x-default` now point to `/cs`. |
| L6 missing lastmod | **Intentional.** Hub pages have no true modification time; the code avoids inventing one. |
| L7 CSP / HSTS | **Left as is.** Removing `'unsafe-inline'` needs nonces, which would make every cached page dynamic; `includeSubDomains`/`preload` need all subdomains confirmed HTTPS-only first. |
| L8 shouting names | **Fixed** in the race page heading (same rule as titles already used). |
