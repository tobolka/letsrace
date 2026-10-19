# Content Quality / E-E-A-T: letsrace.cz (2026-10-10)

**Content Quality: 38/100. On-Page SEO: 55/100.**
E-E-A-T, using this skill's internal weights: Experience 6/20, Expertise 12/25, Authoritativeness 8/25, Trust 12/30, which totals 38. AI citation readiness: 45/100.

## Method
- I fetched 201 random race pages from `/cs/zavod/` (10% of the 2016 races) as SSR HTML with a Googlebot user agent.
- I fetched 20 of those races, chosen to cover different disciplines, past and upcoming dates, and with or without a series, in en/de/pl/sk too.
- I fetched all 79 cs series pages and 13 hub, home and privacy pages.
- I parsed the HTML with the Python standard library. The nav chrome (9 words) is excluded from word counts.
- I ran metadata_template.py on 281 title and description pairs.
- **Not checked:** the full 2016-race corpus, rendered DOM versus SSR, other-locale hub and series pages beyond those sampled, and GSC index coverage (no credentials).

Note: on race pages the action links and the "About" paragraph stream into hidden `<div id="S:n">` blocks outside `<main>`. They are in the HTML, but sit outside the main landmark.

## Measurements
| Metric | Value |
|---|---|
| Race page visible words (cs, n=201) | min 56 / p25 72 / **median 78** / p75 95 / max 362. 154/201 are under 100, 195/201 under 300 |
| Distinct race-specific tokens per page | median **13** (name, date, town, categories). The rest is template |
| 3-gram shingles shared with ≥20% of pages | 35% median. The facts are also repeated on the page: name 3–4×, date 3×, place 3× |
| Past races still indexable | **104/201 (52%)**. Only 1 has a results link; 13 of 2016 slugs have both a 2026 and a 2027 edition |
| Ages guessed / unknown | 67 marked "odhad" (estimate), 35 "Zatím nevíme" (don't know yet). 61 say no entry link was found |
| Cross-locale (20 races × 4 locales) | Same facts, translated template. Words med en 82 / de 78 / pl 74 / sk 74. Token Jaccard vs cs: en .14, de .14, pl .20, **sk .41** |
| Series pages (79) | median 114 words, 26 under 100, 5 with only 1 round (alpentour-trophy, horal-mtb, ktm-kamptal-trophy, malevil-cup, trofeo-citta-di-bolzano). 50 use a templated description |
| Hubs | Country hubs are thin (/cs/zavody/cz 94 words, only discipline links). Discipline hubs: 186–1210 words |
| Titles (cs) | median 58 chars, 54/201 over 60 (brand suffix allowed up to 65, seo.ts:226-228), 0 duplicates |
| Descriptions (cs) | median 131 chars, 35 under 120, 1 duplicate. Template check: site_risk **low**, templated_ratio 0. However 148/201 end with the same closer, "Termín, místo na mapě a další závody v okolí." (date, place on the map and other races nearby) |

## Findings
1. **CRITICAL: thin programmatic pages at scale.** About 10k race URLs, roughly 80 words and 13 unique facts each. Half are past races with no results. This fails the quality-gates product/programmatic bar (400 words / 80% unique). The non-cs locales only translate the template.
   - Fix: in sitemap.ts and on the page, set noindex on past races that have no results and no next edition. Raise unique content using data already in the catalog (see Additions below).
2. **HIGH: discipline errors in titles, H1, breadcrumbs and hubs.**
   - `federciclismo.ts:47` matches `/pista|track/` before checking for "short track", "pump track" and "off track". In the /en/races/it/track hub, about 7 of the 10 races are not track races (4× "Short Track" XCC, ZONCROSS = CX, Bike Kids Challenge).
   - `seo-race-copy.ts:307-314` `leadDiscipline` matches the label "Track" inside a race name. Example: "25° OFF TRACK MTB GIOVANISSIMI" gets the title "dráhový závod" (track race).
   - Other wrong labels in the sample:
     - Maifelder Gravel Loops is labelled road.
     - Gran Fondo La Stelvio Santini is labelled gravel.
     - BMW 4er-Mannschaftszeitfahren (a team time trial) is labelled road race.
     - slowUp La Broye (not a race) is tagged XCO + gravel + road.
   - The FCI fallback `return ["road"]` (federciclismo.ts:49) labels anything it cannot classify as road.
3. **HIGH: country shown as the place name.** `placeOf` (seo-race-copy.ts, about l.362-369) takes the last comma-separated part of the municipality. When the field holds "Aigle, Switzerland" the result is the title "3 Jours d'Aigle 2026 – dráhový závod, Switzerland" and the description "Switzerland (Švýcarsko)". Seen on 8/201 pages (about 4%): Velodrom/Germany, Sardegna/Italy, Dobris/Czechia, Biłgoraj/Polska, Podbrezová/Slovakia and others. 28/201 have a venue in `addressLocality`.
   - Fix: strip a trailing country name in placeOf and in event-json-ld.
4. **HIGH: almost no E-E-A-T pages.**
   - /about, /contact and a methodology page all return 404.
   - There is no footer. Privacy (/cs/privacy) is linked only from the auth form (auth-form.tsx) and is missing from the sitemap.
   - No operator or data controller is named. The only contact is `contact@letsrace.cz`, in privacy/page.tsx:6.
   - There is no Organization JSON-LD.
   - Fix: add About/Data-sources pages (list the federation calendars the extractors read, the daily refresh, how ages are estimated), an imprint, and a site footer in the (shell) layout.
5. **MEDIUM: description closer promises content the page lacks.** "…další závody v okolí" (other races nearby; SNIPPET closers at seo-race-copy.ts:443-476, appended at :583). But `sameWeekend` (seo-race-copy.ts:27,71) is never rendered.
   - Fix: build that section in page.tsx after line 307.
6. **MEDIUM: raw scraped names in H1.** 42/201 H1s are all caps. `unshout` is applied to the title only, not to H1 at page.tsx:171-173. One name contains junk button text: "12. - - SP XCO MTB Poráč UCI C2 PŘIHLÁSIT SE SEZNA" ("Přihlásit se" = "sign up"). The home page shows "TBC" and "M" as places.
7. **MEDIUM: duplicate series.** /cs/serie/nolimited-cup-cx and /cs/serie/slovensky-pohar-cx are the same Slovak CX cup. Not yet checked: which races are on both pages.
8. **LOW: wording and soft-404 slips.**
   - Grammar: "Gravel 1 závodů" (wrong plural, should be "1 závod") on /cs/zavody/cz.
   - Unknown series slugs return 200 with an English "Series not found" title on cs pages (they are noindex).
   - en page dates are inconsistent: "September 26th, 2026" in the header vs "26 September 2026" in the summary.

## Additions without LLM spend (data already fetched)
- Category table with `distanceKm` and `ageMin/ageMax` (events.ts:58-65). Today page.tsx:215 shows names only.
- The source domain, from `sources` (already selected at events.ts:521), plus `updated_at` as "Last updated".
- Same weekend within N km, using `location.lat/lng`. The copy already exists (`sameWeekend`).
- Previous/next edition link, using the slug base plus year.
- A visible link to the discipline hub. The `hub` is computed at page.tsx:134 but used only in JSON-LD.
- Series context: round X of N, using `seriesData` (page.tsx:127-133).
- `organizer` in the JSON-LD.
- A unique intro on country hubs: counts by discipline and month, top series.
