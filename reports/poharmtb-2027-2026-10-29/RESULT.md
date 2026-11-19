# Český pohár MTB 2027

Source checked: https://www.poharmtb.cz/cross-country on 2026-10-29.

Production data update: four new events, two existing events updated. No application deployment.

| Venue | Race dates 2027 | Action |
| --- | --- | --- |
| Město Touškov — Touškovská rokle | 24–25 April | Updated existing Czech MTB Cup; retained ID and slug |
| Vimperk — Vodník | 8–9 May | Created |
| Bedřichov — Sportovní stadion | 5–6 June | Created |
| Praha — Motol, MČR XCO & XCC | 17–18 July | Updated existing championship; corrected start from 16 July |
| Stupno — Ultramarínka | 14–15 August | Created |
| Nové Město na Moravě — Vysočina aréna | 18–19 September | Created |

All six linked to existing cesky-pohar-mtb series, include XCO/XCC, official source provenance and protected manually verified fields. Five cup venues carry UCI C1; MČR retains championship type. Venue labels recorded in event descriptions using existing municipal map locations. No precise venue coordinates invented.

Description notes the provisional schedule, mandatory licences, advance online registration and absence of children's categories from the cup. Placeholder Propozice/Časový plán/Technical guide links resolve to the same calendar page; no separate 2027 document or registration link was invented. Existing Motol registration/regulations links retained.

Verified after commit: six public scheduled unmerged events; one official canonical source, evidence record and series membership per event. Public production API returned all six with expected date ranges:

https://letsrace.cz/api/events?series=cesky-pohar-mtb&dateFrom=2027-01-01&dateTo=2027-12-31

Follow-up: added explicit event age categories u13, u15, u17, youth, junior, u23, elite, amateur (experts), masters for all six events from the provisional 2027 timetable. No kids/u7/u9/u11 labels. Description distinguishes XCC eligibility (junior/U23/elite) from XCO. Corrected internal UCI value to lowercase c1 and display label UCI C1. Existing schema represents age categories at weekend level; discipline eligibility is stated in description.

After the user reported the missing series card, confirmed the public hub was serving the old 48-event snapshot. Tag invalidation alone did not refresh that deployed snapshot. Purged production CDN and Data cache via Vercel CLI after confirming linked project and owner. Verified the live English and Czech MTB country hubs now render the Český pohár MTB XCO card with six weekends. Production API returns all nine taxonomy labels and explicit confidence for all six events. SQL validation: 6 events, 6 explicit classifications, 0 with child labels.

before.json preserves the original events, overrides and series. import.sql records the executed transaction; it is an audit artifact, not a rerunnable migration.

Additional follow-up: the series itself still had season 2026 and inherited kids/youth/junior/u23/elite metadata. Updated series season and description to 2027, copied the verified event age taxonomy without children, recorded confirmation time and a source-linked note distinguishing XCO and XCC. Fixed literal newline escapes in the six event descriptions. Preserved original series row in series-before-categories.json. Executed series-categories.sql, refreshed production cache and checked the public series endpoint and detail page.
