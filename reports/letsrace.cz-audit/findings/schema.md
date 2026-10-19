# Schema.org audit: letsrace.cz (2026-10-10)

Method: crawled JSON-LD on all 1,989 /en race pages (sitemap), 4 other locales (cs/de/pl/sk) on 4 races, homepage, /en/races, /en/series, hubs (/races/cz, /races/cz/road, /races/this-weekend), series (alpentour-trophy). Code read: src/components/seo/event-json-ld.tsx, hub-json-ld.tsx, e/[slug]/page.tsx, events.ts.

**Schema score: 58/100**

## Detected
- Race pages: SportsEvent + BreadcrumbList (JSON-LD, https context, ISO dates, absolute URLs, `<` escaped; good).
- Hubs/series/this-weekend: CollectionPage + ItemList + BreadcrumbList.
- Homepage, /races, /series index: NO JSON-LD.
- FAQPage/HowTo not used (correct).

## Findings
| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | Critical | `image` (and og:image/twitter:image) = `/{locale}/{race}/{slug}/opengraph-image` returns **404 text/html** on every race page checked (en/cs). Internal path 308s to the same 404. Google gets no image; the Event image is recommended. | event-json-ld.tsx:74 and e/[slug]/page.tsx:63. Proxy rewrite of 3-segment path to `e/[slug]/opengraph-image` fails. Test locally. Serve at a non-rewritten path, or exempt `/opengraph-image` in proxy.ts:47-86. After that, 1200x630 is not 16:9/4:3/1:1; prefer 1200x675 as well. |
| 2 | High | 44/1986 races (2.2%) have no `location` (required by Google, e.g. stredecni-pohar-jicin-drevenice-2026). 50 more lack geo. | event-json-ld.tsx:93: omit the Event block or fall back to a country-level Place from the series country. Better: fix the data. |
| 3 | High | addressLocality misuse, 312/1986 (16%): value is a venue ("Bahnhof Empelde, Empelde"; "Turnhalle am Park, Karben"), "Todtnau, Germany", or placeholder "lokalita v jednání" (Valašský pohár). `municipality` holds the venue. | event-json-ld.tsx:49,93-104: use `municipality` only after cleaning (split on last comma, drop country, drop TBD strings). Put venue text in `Place.name`, locality in `addressLocality`. Also add `addressRegion` if known. |
| 4 | High | Offer is dishonest: `availability: InStock` on all 772 offers, 345 of them for races that already happened, no price/priceCurrency, `validThrough` only 46x. `offers.url` is also repeated in `sameAs` (772/772). Some offer URLs are uci.org event pages or a Strava club, not registration pages. | event-json-ld.tsx:84-92: emit Offer only if upcoming and (no `registrationClosesAt` or it is in the future); `availability` InStock; add `priceCurrency` + `price` only when known; otherwise omit Offer. Drop `registrationUrl` from `sameAs` (line 55). |
| 5 | Medium | No `organizer` anywhere. The catalog has no organizer column (events.ts:91 EVENT_LIST_COLUMNS; only website/registration/regulations/results URLs). Series has `website_url` only. | Add an `organizer` column (watcher extractors already see it), or interim: `organizer:{ "@type":"Organization","name":<series.name or host>,"url":websiteUrl }` at event-json-ld.tsx:~84. No `performer` (not needed for amateur races; skip). |
| 6 | Medium | Past races: `eventStatus` = EventScheduled; 0 EventCancelled/EventPostponed seen. `completed` maps to the default branch (event-json-ld.tsx:25-34). Cancelled races are not in PUBLIC_EVENT_STATUSES (event-visibility.ts:17), so cancelled pages 404 and that branch is dead code; postponed shows without a new date (also missing `previousStartDate`). 3 sitemap URLs return HTTP 200 "Race not found" (noindex), e.g. mtb-fahrtechnikkurs-allround-nurnberg-4-2026: soft-404s in the sitemap. | EventScheduled for completed is acceptable to Google. For postponed add `previousStartDate`. Remove not-found slugs from sitemap or return a real 404. |
| 7 | Medium | Homepage has no WebSite/Organization (also /races, /series). | See snippet below, in `(map)/page.tsx` (default export, line 15). |
| 8 | Low | SportsEvent is valid (subtype of Event). Keep it. `sport:"Cycling"` fine. Discipline-driven breadcrumb mislabels gravel/XCE races as Road (Maifelder Gravel Loops: Germany > Silnice; Cyclodome XCE: Road). | Check the `hub` pick at e/[slug]/page.tsx:127 and the discipline data. |
| 9 | Low | `inLanguage` missing everywhere; `description` is localized but not marked. | Add `inLanguage: locale` at event-json-ld.tsx:66 (and CollectionPage). |
| 10 | Low | Hub ItemList: `numberOfItems` 99 but only 50 items listed (hub-json-ld.tsx:59,63): inconsistent. Event-type ItemLists do not qualify for Google carousels (Course/Movie/Recipe/Restaurant only), so there is no rich-result gain either way. Item names are untranslated organizer names. Series ItemList lists upcoming only (n=1). | Set `numberOfItems` to the listed count, or list all. Keep as summary list (urls only), which is correct. |
| 11 | Low | Breadcrumbs: valid, positions OK. Series breadcrumb is Home > series with the long H1 title as name ("Alpentour Trophy 2027 – race calendar") and no "Series" parent; race breadcrumb omits the series though the on-page trail includes it; 44 races with no hub show only Home > Race. | hub-json-ld.tsx:72-76: use the short series name, add the series index crumb. |

## Ready-to-paste JSON-LD
Homepage (add to `(map)/page.tsx`):
```json
{"@context":"https://schema.org","@graph":[
 {"@type":"Organization","@id":"https://letsrace.cz/#org","name":"Let's Race","url":"https://letsrace.cz/","logo":"https://letsrace.cz/icon.png"},
 {"@type":"WebSite","@id":"https://letsrace.cz/#website","url":"https://letsrace.cz/","name":"Let's Race","inLanguage":["en","cs","pl","sk","de"],"publisher":{"@id":"https://letsrace.cz/#org"}}]}
```
(Use an existing PNG logo of at least 112px; no SearchAction, since the sitelinks search box is retired.)

Race page, target shape:
```json
{"@context":"https://schema.org","@type":"SportsEvent","name":"L'Etape Social Ride & Factory Tour","url":"https://letsrace.cz/en/race/l-etape-social-ride-factory-tour-2026","inLanguage":"en","startDate":"2026-09-13","endDate":"2026-09-13","eventStatus":"https://schema.org/EventScheduled","eventAttendanceMode":"https://schema.org/OfflineEventAttendanceMode","sport":"Cycling","image":["https://letsrace.cz/og/race/l-etape-social-ride-factory-tour-2026.png"],"organizer":{"@type":"Organization","name":"Posedla","url":"https://www.strava.com/clubs/posedla"},"location":{"@type":"Place","name":"Chrastava","address":{"@type":"PostalAddress","addressLocality":"Chrastava","addressCountry":"CZ"},"geo":{"@type":"GeoCoordinates","latitude":50.8172919,"longitude":14.968859}},"offers":{"@type":"Offer","url":"https://my.raceresult.com/...","priceCurrency":"CZK","price":"0","availability":"https://schema.org/InStock","validThrough":"2026-09-12T23:59:00+02:00"}}
```
(Include `offers` only when upcoming and the price is known. `organizer.name` is a placeholder to be filled from data.)
