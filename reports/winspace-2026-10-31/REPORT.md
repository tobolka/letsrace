# Winspace calendar review — 31 October 2026

Source: https://kalendar.winspace.cz/kalendar

Scope: all 95 upcoming entries visible in the supplied calendar (31 October 2026–2 October 2027). The historical toggle was not part of this audit.

## Published database changes

- One new separate 2027 edition: Předvýběr.CZ Bike Maraton Vysočina, 29 May 2027, Kněžice. Stable venue and provisional age groups come from the verified 2026 record; age_confidence = previous. No detailed old categories, fees, registrations or schedules copied.
- Twelve previously hidden records published, including the Trnava–Rysy ride (retained as ride). Together with the new edition: 12 more races plus one ride.
- Existing Prague track cup dates and Šamorín race title repaired.
- 15 events outside the seven current public countries have corrected countries, places, dates and source links, and remain hidden pending a country-coverage decision.
- 31 canonical events reviewed/written in total, plus one duplicate merged; 91 of the 95 source entries map to 89 existing or newly created events because Sudety Tour has three source entries for one weekend.

## Exclusions and unresolved evidence

| Source entry | Reason |
| --- | --- |
| [Vyhlášení výsledků - Rájec](https://kalendar.winspace.cz/kalendar/2026-vyhlaseni-vysledku-rajec-d75da1e6) | Prize-giving ceremony, not a race. |
| [Kritérium](https://kalendar.winspace.cz/kalendar/2026-kriterium-dd327ea9) | 31 December is a placeholder; series calendar lists cancelled July Žamberk criterium. |
| [Bike Attack](https://kalendar.winspace.cz/kalendar/2027-bike-attack-952454ac) | Linked organiser describes Triathlon Attack (swim/bike/run), not a standalone cycling time trial; identity needs review. |
| [SauwaldGiro](https://kalendar.winspace.cz/kalendar/2027-sauwaldgiro-85b8c8ae) | 2027 date only in aggregator; organiser still shows 2026 and says next date to be announced. Review before creating annual edition. |


The Bike Attack row already exists hidden; it was not promoted as a cycling race. SauwaldGiro 2027 has not been created from an uncorroborated aggregator date. The organiser page still gives 30 August 2026: https://www.sauwaldgiro.at/.

Mamut Tour: organiser confirms 22 May 2027 in Prosenice and timed 132/80 km routes; erroneous 23 May record repaired and duplicate 80 km record merged. https://miko-cycles.cz/mamut/mamut-tour/propozice/

## Outside current public coverage

| Event | Date | Country |
| --- | --- | --- |
| Gran Fondo Greece | 2026-11-01 | GR |
| Granfondo Antalya | 2026-11-06 | TR |
| Granfondo La Nucia | 2026-11-07 | ES |
| Granfondo Brazil | 2026-11-08 | BR |
| Granfondo Ecuador | 2026-11-14 | EC |
| Gran Fondo 7 Lagos | 2026-11-21 | AR |
| Granfondo Colombia | 2026-11-29 | CO |
| Granfondo La Guadeloupe | 2026-12-06 | GP |
| Gran Fondo Hainan | 2026-12-11 | CN |
| AD Ports Group Gran Fondo Abu Dhabi | 2026-12-20 | AE |
| Istria Granfondo | 2027-04-03 | HR |
| GranFondo Pag | 2027-05-15 | HR |
| Maraton Franja | 2027-06-13 | SI |
| L’Etape Slovenia by Tour de France | 2027-09-05 | SI |
| Istria 300 | 2027-10-02 | HR |


## Verification

The initial 30 writes and the additional Mamut Tour repair were read back and compared with the reviewed manifest. All 75 race source entries expected in the seven-country public calendar were found in the live public feed (73 unique events, since Sudety Tour has three entries and Trnava–Rysy remains a ride). Public map/list/catalogue refresh requested through an authenticated existing admin action. No application taxonomy or country expansion shipped.

The complete mapping is in coverage.csv; source snapshots, before/after backups and field evidence remain in this directory. Database writes are recorded in apply.sql, refinements.sql and mamut.sql; import provenance is saved in event_facts with version winspace-review-2026-10-31-v1.

Release note: Czech and English note added for 31 October 2026. Deployment verification is recorded separately.
