# UCI MTB World Series 2027 — 30 October 2026

Added ten 2027 editions directly to production, preserving existing 2026 records. No matching 2027 public/hidden records or pending candidates existed. One multi-discipline record per competition weekend. Existing series ID: 641843a4-5761-4533-9b46-e61a1e4da868.

Per the user's final instruction, five rounds are public in existing covered countries; France, Andorra, USA and Canada are hidden. No coverage/map-bound changes.

| Event | Dates 2027 | Disciplines | Visibility | Database ID |
|---|---|---|---|---|
| UCI MTB World Cup – Nové Město na Moravě 2027 | 2027-05-21 – 2027-05-23 | xco, xcc | public | 38af09e7-a920-47b5-8b75-e2d17f64d02a |
| UCI MTB World Cup – Loudenvielle – Peyragudes 2027 | 2027-05-29 – 2027-05-30 | dh | hidden | cb426e32-ce01-4ff6-913a-30d31780723b |
| UCI MTB World Cup – Saalfelden Leogang – Salzburgerland 2027 | 2027-06-11 – 2027-06-13 | xco, xcc, dh | public | 6ba023bb-f7d2-4589-ba5d-59fc990b5bea |
| UCI MTB World Cup – Les Gets – Haute-Savoie 2027 | 2027-06-18 – 2027-06-20 | xco, xcc, dh | hidden | 02a3ed88-fb3e-4069-b762-9a47b1872245 |
| UCI MTB World Cup – La Thuile – Valle d’Aosta 2027 | 2027-07-02 – 2027-07-04 | xco, xcc, dh | public | 0b9d55e6-4daa-45ce-97fc-c785767211bf |
| UCI MTB World Cup – Pal Arinsal 2027 | 2027-07-09 – 2027-07-11 | xco, xcc, dh | hidden | fca666d0-5c26-4492-91df-40a0ea1c3dc1 |
| UCI MTB World Cup – Bike Kingdom Lenzerheide 2027 | 2027-08-20 – 2027-08-22 | xco, xcc, dh | public | 66c9a81a-9e26-41d0-a11e-a8586b4b1d5e |
| UCI MTB World Cup – Val di Sole – Trentino 2027 | 2027-09-10 – 2027-09-12 | xco, xcc, dh | public | 5be695c3-4cdb-4b22-ba37-7430d5abebfe |
| UCI MTB World Cup – Soldier Hollow – Midway, Utah 2027 | 2027-09-25 – 2027-09-26 | xco, xcc | hidden | f9183743-fc0f-40b4-9881-d51f22f592c4 |
| UCI MTB World Cup – Whistler Mountain Bike Park 2027 | 2027-10-02 – 2027-10-03 | dh | hidden | 1307ef34-b067-4de4-aaa3-4a9193cffd39 |

## Sources

- Official 2027 announcement, 29 October 2026: https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar — all dates/formats, corroborated by the user's official calendar graphic.
- UCI: https://fr.uci.org/pressrelease/luci-et-skydance-devoilent-le-calendrier-de-la-serie-mondiale-mountain-bike-uci-whoop-2027/1tsGc2JgTjubnJs0nWHKbE
- Organiser: https://www.mtbnmnm.com/ — wider event header 20–23 May 2027; https://www.mtbnmnm.com/race-program and junior detail still describe 2026.
- Junior XCO: https://www.uci.org/competition-details/2027/MTB/80464 — men/women Junior Series, 21–23 May 2027; this is not a junior XCO World Cup.
- Venue: https://www.mtbnmnm.com/arena-camping and https://www.vysocina-arena.cz/en/ — Vysočina Arena, Vlachovická 1200, Nové Město na Moravě, Kraj Vysočina, CZ.
- Arena pin 49.577263, 16.053323: https://www.wikidata.org/wiki/Q29015670 cross-checked with mapped stadium. Venue-level pin, not a confirmed 2027 start line. New Leogang, Les Gets and Pal-Arinsal pins were checked with Photon/OpenStreetMap; other venues reuse existing approximate location records.

## Unresolved

The World Cup is stored as **21–23 May**. No 2027 source establishes the content of 20 May; it is not labelled practice-only. Day-by-day 2027 schedules, junior XCC, registration links/fees/deadlines and full admission categories remain unconfirmed. All registration URLs are null; no old results/registration/regulation links were copied. Seven rounds have provisional prior-edition categories (age_confidence=previous), with prior IDs/source URLs in event_facts. Three use default inferred categories. No detailed class rows or birth-year limits were invented.

## Protection and checks

Verified core fields and visibility are locked in event_overrides; provenance is in event_sources/event_facts. Unknown future entry/category details remain updatable. Creation is transactional, takes an advisory lock and refuses an unexpected existing event. Repeating it preserved the same ten event IDs with no extra event/location rows.

Nové Město import probes using World Cup/World Series/WHOOP/Czech names and 20/21 May returned match or review, never distinct. Existing watcher holds ambiguous matches instead of inserting duplicates. Five relevant test files passed (38 tests). Application typecheck excluding unrelated report copies and targeted lint passed. Broad typecheck found an unrelated untracked report copy missing race-skeleton; no unrelated source was changed.

Live public API returned exactly five 2027 World Cup entries, each with coordinates and expected discipline filters. Calendar UI visibly showed Nové Město on 21, 22 and 23 May. The main map visibly showed its selected venue pin/card with XCO/XCC, World Cup and the provisional-category label. The shared feed contained all five public rounds after refresh; discipline queries returned 5 XCO, 5 XCC and 4 DH entries. The production About page displayed the new release note. Release commit: 18ed8245390d9ee6aef71a54ac90311155e3f645; Git-triggered production deployment dpl_5MJuV2CzEDPAuvBGmm7SYZoZj9ba is READY on letsrace.cz. The shared catalogue/CDN was purged through the CLI after the connector invalidation endpoint returned 404; the new catalogue and discipline filters were rechecked.

apply.sql is the creation transaction; previous-categories.sql records the historical-category refinement; database-rows.json is the final DB snapshot. The preparation script generates SQL from rounds.json. Czech and English release notes are dated 2026-10-30.

