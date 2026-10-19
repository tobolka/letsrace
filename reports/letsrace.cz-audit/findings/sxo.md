# SXO findings: letsrace.cz (2026-10-10)

**SXO Gap Score (representative: country hub `/cs/zavody/cz` vs "kalendář závodů / cyklistické závody 2027"): 46/100.** This is separate from the SEO Health Score.

| Dimension | Score | Evidence |
|---|---|---|
| Page type | 8/15 | Directory/hub is the right type, but the country hub renders **0 race links** (only discipline and collection tiles), so it is a directory of directories |
| Content depth | 4/15 | Hubs have 23 to 52 extracted words, with no intro, FAQ or "how to enter / licence" copy. Race page has about 51 words |
| UX signals | 9/15 | "Show on map" CTA, month-grouped lists on discipline hubs and collections, series tiles. The country hub has no list |
| Schema | 8/15 | CollectionPage + ItemList + BreadcrumbList on hubs. The country hub ItemList (52 ListItems) has no visible counterpart. The home page has no WebSite/Organization |
| Media | 4/15 | Discipline hubs and race pages have 0 `<img>`. All pages use the default locale OG image |
| Authority | 4/15 | `site:letsrace.cz` returned nothing in the test engine. No about/methodology page. Per-race "found in source today" is a good trust cue |
| Freshness | 7/10 | Data updates daily, but the rolling 365-day window drops the finished 2026 season and the label "2026/27" mislabels calendar-year disciplines |

## SERP backwards analysis (6+ queries)

The WebSearch engine is US-based and not Google CZ/DE/PL, so results are directional only. See Limitations.

| Query | What ranks (page type) | letsrace matching page | Fit |
|---|---|---|---|
| cyklistické závody 2027 kalendář | UCI/news calendar articles (domestiquecycling, uci.org, tour-magazin), welovecycling "Kalendář závodů 2026" (editorial year list) | `/cs/zavody/cz` "…2026/27" | **HIGH mismatch**: SERP wants a year-scoped list, and the page shows tiles and a rolling window |
| kalendář závodů MTB 2026 | welovecycling year list, centrumrowerowe.pl "kalendarz zawodów MTB" (year-updated listicle), Red Bull World Cup calendar | `/cs/zavody/cz/mtb` (21 races, next 12 months) | MEDIUM: right type, but no year scope and the 2026 season is now gone from the page |
| gravel závody Česko | News, thesis, visitczechia route, organizer PDFs. No dedicated calendar ranks (gap) | `/cs/zavody/cz/gravel`: **1 race, noindex** | HIGH: an open gap that the site cannot fill in October, because the window holds only 1 upcoming CZ gravel race |
| gravel races Czech Republic 2027 calendar | trainerday.com `/events/cz/<race>` and `/events/cz` (aggregator country + event pages), ultraracecalendar `/calendar/2027/ultras/czech-republic` (**year+discipline+country hub**) | `/en/races/cz/gravel` (noindex) | HIGH: the competitor page type is the discipline+year landing page, which letsrace does not have |
| Radrennen Kalender 2027 | Pro calendars (UCI WT), radsport-rennrad.de "Termin-Kalender" (year listicle), rad-net.de BDR calendar (filterable by **region**/type) | `/de/radrennen/de` (218 races, no visible list) | HIGH: same as the CZ country hub |
| kalendarz wyścigów kolarskich 2026 | centrumrowerowe.pl blog year lists (WT + Polish amateur), PZKol | `/pl/wyscigi/pl` | HIGH: same as above |
| dětské cyklistické závody | News stories, regional kids series (SpinFit Dětský MTB cup, Detská tour Petra Sagana), balance-bike categories mentioned | `/cs/zavody/deti/cz` (28 races, indexable) | MEDIUM: the collection fits, but the SERP rewards **kids series** and balance-bike (odrážedla) intent |
| Rožmitálský cyklokros 2026 / Povltavský bikerský pohár 2026 | Engine found nothing relevant. Known to be dominated by organizer sites and registration platforms. Aggregator event pages (trainerday) rank for niche names | `/cs/zavod/rozmitalsky-cyklokros-2026`, `/cs/serie/povltavsky-bikersky-pohar` | MEDIUM: an open opportunity, but the race URL is per edition |

SERP consensus for generic "calendar" queries is a **year-scoped event list** (about 70%: editorial year lists and aggregator year/country hubs). Federation calendars (ČSC, rad-net.de, PZKol) are filterable database tools. None of them puts a list of race links above the fold on a country landing page, and that is letsrace's natural edge.

## Findings

### 1. CRITICAL: Country hubs show no races
`/cs/zavody/cz` (99 races), `/de/radrennen/de` (218) and `/pl/wyscigi/pl` (186) render only discipline and collection tiles. Visible text is 23 to 26 words. The ItemList in JSON-LD lists races that are not on the page. The code comment at `src/app/[locale]/(shell)/c/[code]/page.tsx:82-83` says "every race a link", but the JSX at `:113-149` never renders `RaceLinkList`.
- **Fix:** render `<RaceLinkList events={events} locale={locale} groupByMonth headingLevel="h3" />` after the tiles. This is the same component the discipline hub uses at `c/[code]/[discipline]/page.tsx:144`. Add a 2 to 3 sentence intro and a short FAQ ("Kdy začíná sezóna", "Potřebuji licenci?").

### 2. HIGH: Year intent mismatch and the October cliff
- `seasonLabel()` (`src/lib/seo-race-copy.ts:590-593`) returns "2026/27" from September for **every** discipline. Searchers type "2027" (road, MTB, gravel are calendar-year seasons). "2026/27" is only right for cyclocross.
- The hubs use a rolling 365-day window (`c/[code]/[discipline]/page.tsx:41-42`). In October the 2026 season disappears, and 2027 data is sparse. The CZ gravel hub has 1 race and drops to noindex (`:72`). The CZ MTB hub has only 21 races.
- **Fix:** add **discipline+year landing pages** (`/cs/zavody/cz/mtb/2027`, `/de/radrennen/de/gravel/2027`) and keep the prior year indexable as an archive ("MTB závody 2026 – přehled"). That way "gravel závody 2026" still has a page in October. Choose the label per discipline (CX = "2026/27", others = calendar year) and switch to the next year once N races for that year are known.

### 3. HIGH: Missing region hubs
rad-net.de filters by region, and Polish and German users search by województwo/Bundesland ("Radrennen Bayern", "wyścigi MTB śląskie"). The catalogue has municipality and geo coordinates but no region dimension (no `region` field in `src/lib/events.ts`).
- **Fix:** derive kraj / Bundesland / województwo and create `/{c}/{cc}/{region}` hubs. Index them only if the region has ≥8 races, the same rule as `MIN_RACES` (`src/lib/discipline-hubs.ts:22`). Month hubs are low priority because `weekend` collections already cover the "this weekend" intent. Skip city "near me" hubs (too thin).

### 4. MEDIUM: Race pages are per-edition URLs with thin content
- The slug carries the year (`rozmitalsky-cyklokros-2026`). Race-name queries are evergreen, so each year's edition starts from zero. An unknown or old slug (`…-2025`) returns **HTTP 200** "Závod nenalezen" with noindex, which is a soft 404.
- The page has about 51 words. Categories U7 to Masters and the registration link are good. Start times per category, laps/distance, fee, last year's results link and a course map are missing.
- **Fix:** 301 past-edition slugs to the next edition of the same race (or to the series page). Return a real 404 for unknown slugs (`e/[slug]/page.tsx`). Add those fields where the regulations (propozice) provide them.

### 5. MEDIUM: Kids intent is under-served
`/cs/zavody/deti/cz` fits the intent. The SERP rewards kids **series** and balance-bike races. The PL kids collection has only 4 races.
- **Fix:** add an "odrážedla / Laufrad / rowerki biegowe" collection (U5/U7) and a "kids series" hub (series filtered by `kids` category). Link both from the home page and the country hubs (`src/lib/race-collections.ts:7`).

### 6. LOW: Pluralisation and English discipline slugs
- The tile count `${n} ${t.racesCount}` (`c/[code]/page.tsx`, DisciplineTile `count`) produces "1 závodů", "43 wyścigów" and "2 wyścigów". It should use the existing `counted()`.
- Discipline URL segments are English on every locale (`/cs/zavody/cz/road`, `/cx`, `/track`). Localize them (silnice / cyklokros / draha, strasse / querfeldein…).

## Persona scoring (Relevance / Clarity / Trust / Action, 25 each)

| Page type | Amateur racer planning season | Parent (kids' races) | Team manager |
|---|---|---|---|
| Home `/cs` | 15/16/12/17 = **60** | 14/14/12/15 = **55** | 13/14/12/14 = **53** |
| Country hub | 12/10/12/8 = **42** (no list) | 13/11/12/10 = **46** (kids tile only) | 10/10/12/6 = **38** (weakest) |
| Discipline hub | 17/16/12/15 = **60** | 10/12/12/12 = **46** | 15/14/12/13 = **54** |
| Kids collection | 8/14/12/14 = **48** | 19/17/13/16 = **65** | 12/14/12/13 = **51** |
| Series page | 16/15/12/14 = **57** | 12/13/12/12 = **49** | 17/15/12/14 = **58** |
| Race page | 15/15/14/14 = **58** | 15/14/14/14 = **57** | 12/12/14/11 = **49** |

Weakest first:
- **Team manager on the country hub (38):** add the visible race list, a "national cup / UCI / licence required" collection (`src/lib/race-level.ts` exists), registration-deadline sort, and a hub-level .ics/CSV export (`src/lib/ics.ts` exists).
- **Amateur on the country hub (42):** add the month-grouped list and links to the year pages.
- **Parent on the discipline hub (46):** add an age-band filter chip (U7/U9/U11) and per-category start times on race pages.

## Missing page types (priority order)
1. Discipline+year landing pages, plus the previous-year archive
2. Region hubs (kraj / Bundesland / województwo) × discipline
3. Kids series hub and balance-bike collection
4. Level hub (national cups / UCI / licensed vs hobby)
5. Month hubs (low priority)

## Limitations
- WebSearch is a US non-Google engine. Real Google CZ/DE/PL SERPs, AI Overviews, PAA, local packs and rankings were not observable. Federation calendars (cyklistikaonline.cz/ČSC, rad-net.de, PZKol) are inferred from domain knowledge and search snippets, not observed SERP positions.
- `site:letsrace.cz` returned no results, which may be an engine limitation rather than proof that the site is not indexed. No GSC data.
- Mobile above-the-fold screenshots were not taken. Scores use rendered DOM text only.

## Structured findings (audit-data.json, category: Search Experience)
```json
[
 {"id":"sxo-country-hub-no-list","severity":"critical","page":"/cs/zavody/cz","file":"src/app/[locale]/(shell)/c/[code]/page.tsx:113-149","fix":"Render RaceLinkList grouped by month and add an intro/FAQ"},
 {"id":"sxo-year-intent","severity":"high","file":"src/lib/seo-race-copy.ts:590-593","fix":"Per-discipline season label; discipline+year pages; keep the previous-year archive indexable"},
 {"id":"sxo-region-hubs-missing","severity":"high","fix":"Derive region; region hubs gated by MIN_RACES"},
 {"id":"sxo-race-edition-urls","severity":"medium","file":"src/app/[locale]/(shell)/e/[slug]/page.tsx","fix":"301 past editions; real 404 for unknown slugs; add fee/times/distance"},
 {"id":"sxo-kids-intent","severity":"medium","file":"src/lib/race-collections.ts:7","fix":"Balance-bike collection and kids series hub"},
 {"id":"sxo-plural-slugs","severity":"low","file":"src/app/[locale]/(shell)/c/[code]/page.tsx","fix":"Use counted() for tile counts; localize discipline URL segments"}
]
```

Next: `/seo schema` (WebSite/Organization on the home page, ItemList of Events), `/seo content` (E-E-A-T and about/methodology page). Generate a PDF report? Use `/seo google report`.
