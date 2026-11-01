# Czech 2027 race corrections — 1 November 2026

Applied to production Supabase project `xlomrxswdcekarazaahx` (LetsRace). Only the requested event groups were changed. No event was deleted. Earlier annual editions were untouched.

| Issue | Applied change | Canonical database ID | Public URL | Status |
|---|---|---|---|---|
| Sudety Tour Mediofondo | Corrected 10 → 9 May; moved the competition to Broumov; merged the second Mediofondo listing into the older stable record; replaced the stale 2026 registration with the current form | `a18b06a4-03b7-4b7c-a0f4-ece6a475441f` | https://letsrace.cz/cs/zavod/dekom-sudety-tour-medio-fondo-2027 | Persisted and publicly verified |
| Sudety Tour weekend | Retained the distinct weekend record, with TT on 8 May and Mediofondo/Granfondo on 9 May; preserved the old route-row IDs, refined distances and added the time trial | `258bb5a5-8cc3-4cfb-8726-4211db0fc7a5` | https://letsrace.cz/cs/zavod/dekom-system-sudety-tour-2027 | Persisted; public detail shows the programme |
| L’Etape Czech Republic | Consolidated both names as the Hilly Stage on 19 June; retained older Hilly Stage ID/URL, both series memberships and every source mapping; added 60/100/130 km route variants from the current registration form | `c04842aa-824c-4879-af74-3013d5c47681` | https://letsrace.cz/cs/zavod/l-etape-czech-republic-hilly-stage-2027 | Persisted and publicly verified |
| Grizzlyman Bike | No Grizzlyman record or pending candidate existed. Verified the organiser lists multisport events, not a standalone bike race. Added a 2027-specific import rejection for the misleading Bike alias and other Grizzlyman multisport names | None | No cycling event URL created | Absent from public calendar/search; import guarded |

## Evidence and modelling decisions

- [Sudety organiser](https://www.sudetytour.cz/) explicitly publishes TT 8 May and both road competitions 9 May 2027. Distances 10.6/85.4/147.2 km are explicitly provisional 2026 routes; the database description, category labels and structured evidence retain that qualification.
- [2027 registration hub](https://nasecasomira.cz/events/sudety_2027/) is the weekend’s registration button; the [Mediofondo registration](https://nasecasomira.cz/register/6a0743188f03b406ed5194f7/), [TT registration](https://nasecasomira.cz/register/6a0742968f03b406ed5194f5/), [Granfondo registration](https://nasecasomira.cz/register/6a0743208f03b406ed5194f8/) are preserved individually in weekend description and structured evidence. The TT form gives Radków while the organiser's homepage gives Broumov for the weekend; the main venue follows the homepage and no separate precise TT start location is asserted.
- Weekend and individual Mediofondo were already separate records. This is legitimate: separate registration and RoadCup listing of the specific competition. A `duplicate_reviews=separate` decision now protects this pair against the automatic merger. The second Mediofondo record was the same named race, same RoadCup page and corrected day, without extra categories, series, user favourites or attendance; it was merged into the older stable record.
- [L’Etape registration](https://www.letapeczech.cz/registrace/krok1/) explicitly says “Kopcovitá etapa 19. června 2027, Praha” and offers 60/100/130 km. [The organiser's voucher announcement](https://www.letapeczech.cz/novinky/vyres-vanoce-snadno-a-rychle-s-voucherem-na-kopcovitou-etapu/) directly equates the general Tour de France name with the Prague Hilly Stage on that day. The two records were sportive/road, same date and city, with no distinct competition/route rows; each held a different series membership. Keeping the older Hilly Stage preserves its precise identity, two Eventiv source identifiers and established URL; the merge carries over Winspace, the second series and useful registration/regulations metadata. All previous links remain in merge recovery/field history, including the English registration link retained in the description.
- [Grizzlyman homepage](https://grizzlyman.cz/) announces 29 May 2027 and Full/Half/Teams triathlon and Duathlon Half. [Duathlon regulations](https://grizzlyman.cz/propozice-duathlon-half/) still describe 2026 and confirm the 91.5 km bike leg belongs to a multisport competition; that page is not treated as a 2027 schedule. LetsRace has no dedicated triathlon/duathlon discipline; no standalone cycling race or misleading 91.5 km cycling event was created.

## Preservation and ingestion

- Standard `app_merge_events` was used, preserving old event rows/IDs, public slug redirects, sources, categories, secondary series, facts and any personal-plan relationships. All four merge candidates had zero favourites and attendance before merging.
- Mediofondo alias `bf34b0d7-1933-41ef-9cf1-ef42b48e5956` redirects to `a18b06a4-03b7-4b7c-a0f4-ece6a475441f`.
- L’Etape alias `df085776-0dd2-4957-b98a-3ae14306177d` redirects to `c04842aa-824c-4879-af74-3013d5c47681`.
- Existing older Sudety alias `27654fb7-30c4-491e-b5a5-b270701696ea` stays merged into the weekend; it was not modified.
- All original source-row IDs, external IDs and source URLs survive. The old Granfondo external ID was incorrectly mapped to Mediofondo; it now maps to the weekend containing Granfondo.
- Verified dates, locations, links, descriptions and category rows are protected with native overrides. Existing locks were checked before changing records (none on the affected events).
- Narrow, exact-name/year/country ingestion decisions resolve the known aliases to the canonical IDs even if an aggregator creates a new external ID or repeats the stale date. The Grizzlyman Bike alias is rejected before database writes. Other editions, other countries and distinct stages/competitions are outside these rules. Future genuinely new names still require normal identity review.
- Public details previously omitted the stored description. They now read and render it with the existing summary as fallback, so the weekend programme and provisional-distance qualification are visible. This adds no client fetch or JavaScript; React escapes the stored text.

## Recovery and verification

- Full non-personal event/source/category/series/override/evidence snapshots: `before.json` and `after.json`. SQL: `apply.sql`, `category-locks.sql`. Changes were committed in a guarded transaction and reread from production.
- Private database merge recovery IDs: `2279c5e6-cd3b-4284-8204-2dbe59e2fee5` (Mediofondo), `531cd9ad-b220-4254-9eaa-2b21dee51629` (L’Etape). Subsequent reviewed corrections mean rollback must reconcile these later edits instead of blindly restoring an old snapshot.
- Public validation script checks Czech calendar, road/TT/gran-fondo filters, Sudety/L’Etape/Grizzly search, three detail pages and both alias redirects. It also checks exact event dates in structured page data, visible organiser descriptions, source preservation and locked route rows. Results: `public-verification.json`.
- Working-checkout tests: 183 files / 1,258 tests pass. Clean release tests: 182 files / 1,235 tests pass. The difference is unrelated uncommitted tests excluded from release. Changed-file lint, clean-release TypeScript and production build pass.
- Production release source starts at `aa726f3cc3f84680bb19de91c920c7083e163241` and includes only the six source/test files changed for this task. Other existing local work was excluded. Final deployment: `dpl_EFXp4tCNq5JgB7hs5Twya1dEgprE`, https://letsrace-jcbnuhb8f-tobolkas-projects.vercel.app .
- Czech and English release notes are included for 1 November 2026.
