# Action plan: letsrace.cz

Each item states how to tell it failed.

## Phase 1: get Google crawling (this week). Indexed: 2 of 10,389
1. **Give Google a smaller, prioritised start.** Submit separate sitemaps for hubs first (home, list, calendar, series, country/discipline collections, ~230 URLs per locale), and for races only Czech and English at first. Race pages in pl/sk/de can follow once those are crawled. *Fails if* "Discovered" has not started dropping within 3–4 weeks. *Leading indicator:* Pages report "Discovered" count and Crawl stats requests per day.
2. **Request indexing in Search Console URL Inspection** for the homepage, `/cs`, `/en`, list, calendar and the top series pages (daily quota is small; hubs first).
3. **Earn a few real links.** The 2026-10-20 forum announcement is a start; add organiser sites, clubs, series pages, Czech cycling directories and Strava/club posts linking to specific hub pages. A brand-new domain with no inbound links is the usual reason for "Discovered – not indexed".
4. **Check Crawl stats** (Settings → Crawl stats) for server errors, slow responses (collection pages ≈1 s uncached) and host status, and re-export Pages in 1–2 weeks to see the trend since launch.

## Phase 2: quick wins (weeks 2–3)
3. Cap race page titles at ~60 chars and disambiguate duplicates (e.g. add place or date). *Check:* sample 60 pages, none >60, no duplicates.
4. Remove the stray `index, follow` tag from the 404 page.
5. Add `organizer` and venue name/address to `SportsEvent` where known; add offer price/availability only when verified. *Check:* Rich Results Test shows no warnings on 10 sampled races.
6. Differentiate `/list` vs `/calendar` copy and add `ItemList` schema.

## Phase 3: content depth (month 2)
7. Enrich race pages (already 15 "Crawled – not indexed") with per-page value: nearby races, previous edition, series context, region. Keep the annual-edition rules in AGENTS.md: carried-over facts must be labelled as such. *Fails if* indexed ratio does not improve after 4–6 weeks.
8. Review cache behaviour of collection pages (`/races/<country>/<discipline>` ≈1 s uncached).

## Phase 4: monitoring
9. Re-run `/seo audit` after phase 3, with PageSpeed/CrUX key and the Performance export. Optionally run `/seo drift baseline https://letsrace.cz/en` now so regressions are caught.
10. Revisit whether `/cs` should be x-default for a `.cz` domain.
