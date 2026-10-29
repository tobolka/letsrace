# Race detail depth: gaps, order of work, what is done

Goal: a rider can decide whether to race, and prepare for it, from the race
page alone. This builds on `docs/source-enrichment.md` (collect first, combine
into a complete race) and on the existing `event_facts` / `source_evidence`
store. It is not a Sumator importer: Sumator is one adapter among several.

## 1. State before this work (measured 2026-10-21, production)

Population: 1,160 upcoming, public, unmerged races.

| Field | Races with it | Share |
| --- | ---: | ---: |
| official website | 1,068 | 92% |
| registration link | 546 | 47% |
| regulations link | 323 | 28% |
| registration deadline | 82 | 7% |
| categories (any) | 439 | 38% |
| category distance | 433 | 37% |
| category elevation | 0 | 0% |
| description | 2 | 0.2% |
| results link | 0 | 0% |
| route geometry / GPX | no place to store it | 0% |
| programme (times) | no place to store it | 0% |
| fees | no place to store it | 0% |
| organiser / contacts | no place to store it | 0% |
| source snapshot (`source_evidence`) | 1,027 | 89% |

### What exists, by where the information is lost

**In the source, never read.** Sumator's race page carries per-route length and
elevation, a route description, a dated programme with start times per group,
fees with price periods, conditions and payment method, categories grouped by
start wave, organiser name and phone, a GPX link, the other editions and the
partners. The adapter reads name, date, place, discipline, links, series and
category names. Typical rules PDFs and organiser sites state fees, programme,
route length/elevation, parking, capacity and GPX links; the document reader
extracts only class lists from them. Nobody reads GPX files at all.

**Read, then dropped.** The parser result is stored whole in `source_evidence`,
so anything an adapter returns is retained — but `ParsedEvent` has no field for
programme, fees, routes or organiser, so adapters cannot return them. Category
distance is stored; elevation is parsed nowhere (0%). A Sumator route
description, the `/map` pin (fixed separately), and the cup/edition links are
dropped.

**Stored, never shown.** `event_categories` (name, age, distance) is loaded by
list queries for filtering but the race page prints only age chips, so route
lengths are invisible. `registration_closes_at` is shown nowhere on the page.
Source URLs in `event_sources` and the evidence history are not shown.

**Not in the data model.** Routes as geometry, route-to-category mapping,
programme items, fees with periods and conditions, organiser contacts,
practical information (parking, transport, facilities, mandatory equipment,
capacity), edition status of a route (current/preliminary/historical), and
per-fact provenance for these.

### Surfaces

* Small detail: `components/explore/event-detail-panel.tsx` (map card and
  mobile sheet). Date, place, who, format, level, series, links.
* Large detail: `app/[locale]/(shell)/e/[slug]/page.tsx`. The same rows plus
  a generic summary paragraph, a point map and other rounds of the series.

## 2. Order of implementation

1. Types and pure libraries: rich `ParsedEvent` fields; GPX parser (distance,
   elevation computed from geometry, simplification, GeoJSON, GPX output);
   deterministic text extractors (programme, fees, route statistics,
   practical information) that return a quote with each fact.
2. Schema (additive migration): routes, programme items, fees, practical
   facts, organiser, each row with source, quote, retrieval time and edition;
   `events.detail_summary` for the small detail.
3. Adapters: Sumator in depth; the shared document reader feeds the text
   extractors for every source's rules/site pages.
4. Materialiser: from the stored evidence of a race to the typed rows —
   additive, edition-checked, never overwriting confirmed values with empty
   ones, conflicts kept side by side. GPX fetched with a hash cache; failures
   recorded as concrete unfinished work in `catalog_probes`.
5. Repeatable catalogue fill script (dry run by default, budgeted, cached).
6. UI: large detail sections; small detail summary; route map with elevation
   profile and GPX download; source/age of each section.
7. Measurement before/after, representative sample, desktop and mobile check,
   documentation.

(Implementation status is recorded at the end of this file as the work lands.)
