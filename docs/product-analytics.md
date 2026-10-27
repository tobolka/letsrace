# LetsRace product analytics

Implemented against the existing Umami 3.4.1 integration. No tracker migration,
new database, public sharing, replay, user identification or paid service.

## Where to look

Three private boards are maintained by `scripts/configure-product-analytics.mjs`:

- **LetsRace — Produkt**: section views; map/list/schedule → race detail;
  detail with a registration link → external registration intent; confirmed saves.
- **LetsRace — Hledání a filtry**: completed-search outcome, race/place branch,
  visible result buckets, applied filter groups, zero-result country/date context,
  errors, and search → detail.
- **LetsRace — Akvizice**: entry pages, referrers, controlled campaigns and devices.

The Umami `EventProperty` board component reuses its existing authenticated
property-series query. It does not add a data endpoint or change permissions.
Use board filters for device, source and period. Use website Retention separately:
D7 means a return on day 7 for a mature daily cohort, not any return within 7 days.
Anonymous identities and monthly rotation limit longer-term interpretation.

## Metric contract

Always show counts and denominators. Native funnels are ordered anonymous-session
steps with up to 30 minutes **between adjacent steps**. The pre-existing registration
funnel remains unchanged at 60 minutes. New funnels use property conditions per
step, which the installed 3.4.1 SQL implementation supports. They do not join a
variable race ID across steps. They may therefore connect different races in one
session. They are never presented as completed registration or participation.

- Section popularity: count `section_view`, group by `section`. These are views,
  not unique people. One route transition = one leaf section, not parent + child.
- Discovery progress: visitors completing section → `race_view` / visitors entering
  that section in the funnel. Direct detail entries have their own `race_view`.
- Search zero rate: completed searches with `outcome=zero` / completed searches
  with `outcome=zero|results`. Errors are shown separately, not as empty results.
- Filter zero rate: successful `results_view` with `trigger=filter` and
  `result_count=0` / all successful `results_view` with `trigger=filter`.
  Combined filter context is available in Events → Properties. Do not divide
  individual `filter_apply` clicks by result events: batching gives different units.
- Registration intent: `race_view` with `has_registration=true` →
  `race_registration_start`. External click only, never registration completion.
- Save completion: `plan_save_requested` → `plan_save_completed`. Confirmed new
  inserts only; existing favorites, restored lists and rejected writes do not add
  a success. A login followed by saving can span multiple pages/visits; the native
  funnel is an approximation, not a request-ID join.

Use the first 2–4 weeks as a baseline if sample size permits. Review completed
7-day periods in Europe/Prague; use 28 days for sparse segments. Check collection
health, source/device/season mix, zeros, detail opens and continuation in that order.
Choose one supported hypothesis and product change, not a target invented from no data.

## Events

Existing names remain compatible with the original goal/funnel:

| Event | Trigger / properties | Product decision |
| --- | --- | --- |
| `section_view` | Committed pathname transition; `section`, `section_group`, `locale`. Query/filter/panel changes do not count. | Which areas deserve navigation/content work? |
| `race_view` | Visible panel/sheet or standalone race page; `race_id`, slug, presentation, link availability, past/upcoming. | Does discovery lead to an actual race; do details offer a next step? |
| `race_registration_start` | Actual external registration link activation, including standalone page; `race_id`, `kind`, presentation/location. | Improve registration access and detail information. |
| `outbound_click` | Other external race link: website, listing, regulations, results or directions. | Which information do users need next? |
| `filter_apply` | Explicit user filter action, clear/reset or radius choice; filter group and controlled snapshot where available. Restored preferences are excluded. | Which filters need better defaults or placement? |
| `search_submit` | Explicit search submission only, never text. Preserved from the existing integration. | How often do users explicitly submit searches? |
| `results_view` | Latest valid committed visible result after settle; count/bucket, trigger, geographic scope and snapshot. | Where are results empty or too broad? |
| `search_completed` | A changed query of at least two characters finishes and results commit, including map place fallback; mode/outcome and length bucket. | Is the search branch successful or failing? |
| `plan_save_requested` | New save intent, with authentication requirement and source section. | Is login a barrier to plan use? |
| `plan_save_completed` | Database confirms a new favorite, including deferred save after login. | Does save intent become a useful plan entry? |
| `action_failed` | Final results request/geocoding error or rejected save. No aborts or superseded requests. | Fix reliability before changing UX. |
| `cta_click`, `share_native`, `share_link` | Existing internal-detail CTA and successful share handoff/copy. | Existing navigation/share context; sharing does not prove recipient engagement. |

Section keys: `map`, `list`, `schedule`, `browse_countries`, `browse_country`,
`browse_discipline`, `series`, `collection`, `race_page`, `plan`,
`recommendations`, `alert_areas`, `riders`, `settings`, `about`, `privacy`.
Localized routes resolve through the existing route translator. `/calendar` is an
old plan redirect; `schedule` is the public race calendar. A plan landing may show
its sign-in prompt: visiting that section does not prove authenticated plan use.

`schema_version=1` marks enriched events. Historical events lack new properties;
compare periods after this release for like-for-like product reporting. Extending
`race_view` to standalone pages increases its coverage; annotate the release date.

## Results and deduplication

Map counts exclude the padded fetch area and any retained selected race not in
the result. They use matching IDs, radius filtering and the actual camera bounds.
The calendar counts its displayed grid, including neighboring-month days. A map
zero is local to `geo_scope=viewport|radius`, not proof of a catalogue-wide gap.

Map search first tries a race, then a place. No intermediate race-search zero is
sent while place resolution is pending. A place 404 is no match, not a technical
error. New typing invalidates the previous operation immediately. Superseded
responses and canceled catalogue promises cannot replace the current result.

Search events describe completed executions, not a person's final intent. The
same unchanged query submitted again does not add another completed-search event.
Viewport-driven observations wait 800 ms, filter batches 150 ms, and completed
search/initial results are emitted without that extra wait. Failure events omit
result counts so old rows are not described as the failed search's results.

Detail effects dedupe Strict Mode/re-render; changing race ID or explicitly reopening
can count as a new view. Sheet expansion alone does not. Source section identifies
map vs list vs schedule; pin-vs-row attribution is not inferred.

## Privacy and environments

The existing production hostname/environment gate, DNT/GPC and sanitizing hook
remain. Public paths retain only approved UTM source/medium/campaign syntax.
No raw search, coordinates, titles, identity, profile, family or form data is sent.
Filters are reduced to controlled catalogue codes and date/radius buckets. No
persistent analytics identifier or cross-device account linking was added.

Private pages stay excluded from pageviews and all normal events. Only generic
section/save/error signals may leave a recognized personal section; their URL is
replaced by the locale root. Its actual private path is never sent. Profiles and
specific riders never become event properties. Privacy disclosure is updated in
all five languages.

Up to 50 early events may wait in memory for at most 10 seconds, only after the
existing environment/privacy gate passes. Original URL/time are preserved, and
the final hook still sanitizes them. No persistent replay queue or endless retry.

Normal preview/local runs remain off. Local QA here explicitly opts in with the
separate test website ID. Production ID and existing collector host stay unchanged.

## Setup and operation

The setup script reads a token from an existing ignored local session file named
by `UMAMI_SESSION_FILE`; it does not log credentials. Default website is LetsRace
production; `UMAMI_WEBSITE_ID` can target the isolated test website. It upserts only
its own named private reports/boards and independently reads boards back. It does
not rerun the original provisioning script or change existing registration reports.

Retention duration/legal basis and owner password/2FA remain the owner's decisions.
No automatic deletion, quota change, paid tariff or new migration is included.
No work on Supabase Log Ingestion or the shared import pipeline is included.

## Validation

Targeted automated tests cover URL/property privacy, localized sections, no private
pageviews, gated/expiring event delivery, post-login saves, duplicate/rejected writes,
and existing explore/filter behavior. Additional release evidence (builds, browser,
received test events, boards and deployments) is recorded in the release note.

Deferred deliberately: scroll/block visibility, detailed navigation placement,
raw query analysis, user identification and exact same-race joins. Add these only
when a concrete data gap warrants them; native funnels do not pretend to provide them.
