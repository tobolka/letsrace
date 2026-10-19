# Supabase transfer reduction — 2026-10-19

The supplied Free-plan usage screenshot showed 5.765 GB of uncached egress
against the 5 GB allowance. Already transferred bytes cannot be removed from
the current billing cycle. No plan or billing settings were changed.

## Confirmed sources

Read-only Supabase API logs over the preceding 24 hours showed approximately:

- 6,030 country/discipline tally requests returning 1,817,726 rows. Race
  details, country pages and the map navigation repeatedly recalculated these.
- 2,022 broad public event-list requests for the current/previous day returning
  563,347 rows. The map's navigation read four months of full event records
  for each dynamic map entry, then used only a small set of links.
- 7,453 race-detail requests and 2,164 series-round requests.

These are API request/row counts, not a byte breakdown of billed egress.

## Changes

- Country/discipline tallies now cache the small aggregate for all public
  countries, then select the requested countries in memory.
- Map navigation caches only its hub links, up to 24 series and 40 upcoming
  race links, rather than the full four-month catalogue. Language does not
  affect this data cache. Failures are handled outside the cache, so an empty
  error fallback is not stored for an hour.
- Public race details, public series rows and series rounds reuse persistent
  data caches across requests. Admin reads and writes are unchanged.
- All new caches revalidate after 3,600 seconds and carry the
  `public-catalogue` tag. Date-sensitive aggregates include the UTC day in
  their key so their date window changes at midnight. Cache misses, eviction,
  concurrent cold requests and separate runtime bundles can still cause reads.

This uses `unstable_cache`, matching the existing project without enabling
Cache Components globally. Next 16 recommends `use cache` for projects that
opt into Cache Components; changing the whole rendering model is outside this
targeted fix. Cache small derived data here: large cached HTML/RSC documents
previously caused excessive Vercel cache writes on long-tail race pages.

## Verification

- Production build, lint and all 855 existing tests passed.
- Local production server with a temporary upstream fetch meter, with the new
  generated data-cache entries cleared before the cold test:
  - First CZ race detail: one event read, one series read, one series-round
    read and the shared country tally. The same detail in EN and PL made zero
    additional Supabase calls. A different CH race read its own detail and
    series; revisiting it in CS made zero additional calls.
  - First dynamic map entry read a 370,183-byte event list and a 47,498-byte
    country tally. Three subsequent entries (EN, DE, CS) made zero additional
    Supabase calls. Pages remained HTTP 200 with navigation present.
- The meter and its output are temporary local verification tools, not shipped
  with the application. Public deployment verification is recorded with the
  delivery commit in the chat.

## Remaining operational limits

The map's filtered `/api/events` requests still query the database on CDN
misses; this change does not cache arbitrary locations or search strings.
Public details can take approximately an hour to reflect catalogue edits.
No measured post-deployment billing trend exists at implementation time.
Check the organization's usage graph over the following 24–48 hours, including
other projects sharing its quota. The dashboard can lag by an hour. Staying
under next cycle's allowance depends on traffic and other consumers; this fix
does not guarantee a hard 5 GB cap or reset this cycle's counter.
