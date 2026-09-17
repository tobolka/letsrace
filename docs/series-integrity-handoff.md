# Series integrity — handoff

Written 2026-09-17 after two repair rounds. This is a brief for whoever (human or agent)
picks up the rest. Read it whole before touching data.

## The rule

**A series must list exactly the rounds its official website lists.** One series row per
series, one event per round, names / dates / places as the site writes them. Aggregators
(hynekmusil.cz, sumator.cz, mtbs.cz, nazavody.cz, maraton.cz, the ČSC portal, raceresult)
are welcome to add *random races* to the map, but they must never split a series, add a
ghost round, or rename one. When a source and the official site disagree, the site wins.

Radek's words: "hlavní série tam musí být úplně přesně, a potom tam ze všech ostatních
zdrojů mají být random závody." Always prefer the official web.

## How the pipeline works (the parts that matter here)

- `watched_urls` are sources. `src/lib/watcher/run.ts` → `watchOne(row)` fetches one,
  `extractEvents` picks an adapter by host (`src/lib/watcher/extractors/adapters.ts`), and
  `upsertParsedEvent` writes each `ParsedEvent` (`src/lib/domain.ts`).
- A `ParsedEvent` may carry `seriesName` / `seriesSlug`. `resolveSeriesId` upserts the
  `series` row by slug. **Two sources naming the same series with different slugs make two
  series rows** — that was the root of most damage (Hynek: `cp-mtb` vs official
  `cesky-pohar-mtb`, `prima-cup` vs `primacup`, `tbc-serie` vs `tbc-cyclocross`…).
- Hynek's labels resolve through `HYNEK_SERIES` and `canonicalizeSeries` in
  `src/lib/watcher/extractors/hynek.ts`. When you find a new mis-slugged series from Hynek,
  fix it there (alias → canonical name → slug via the code table).
- **Guard (new, in `run.ts` `seriesAcceptsSource`)**: if a series' `website_url` host is
  itself an active watched source, only that host may set `series_id`. Aggregator rows can
  still merge into an official round through dedup, but cannot add one. Series with no
  official source are unaffected. Consequence: to protect a series, make sure its official
  calendar URL is a watched source **and** `series.website_url` points at that host.
- `event_overrides(event_id, fields, locked_fields, updated_by)`: locked fields are stripped
  from the watcher payload, so a repaired keeper keeps its name/dates/series/location.
  `updated_by = "admin"` means Radek curated it by hand — never overwrite those values.
  The merge RPC refuses to drop a row with locks; the repair engine clears only its own
  locks or a bare `visibility`/`status` lock.
- Merging: `mergeEventPair(keepId, dropId)` in `src/lib/catalog/merge-duplicates.ts` moves
  sources, retires the loser's fingerprint, sets `merged_into_id`. `mergePublicDuplicates`
  (cron) only looks at active statuses, so *completed* duplicates from earlier in the season
  are never merged automatically — repair scripts must do it.

## The repair engine

`src/lib/catalog/repair-series.ts` → `repairSeriesPlans(plans, { dry, updatedBy })`.
A `SeriesPlan` is ground truth for one series:

```ts
{
  slug: "primacup", name: "Prima Cup",
  duplicates: ["prima-cup", "prima-cup-xcm"],        // series rows to fold in
  sourceUrl: "https://www.iprimacup.cz/zavody-2026/", // re-read before repairing
  officialHost: /iprimacup\.cz/i,
  rounds: [ { start, end?, swallowUntil?, name?, place, website?, adopt? }, … ],
  foreign: [ { test: /vyhlášení/i, seriesSlug: null, hide: true } ], // not rounds
  junk: (e) => e.start_date === "2026-05-01",          // scraping debris → hidden
}
```

Per series it: folds duplicate rows → `watchOne` on the official source → for each round
merges every row in `[start, swallowUntil ?? end ?? start]` into one keeper (admin-curated
row first, then official-host website, then oldest) and writes+locks name/dates/series/
website (respecting admin locks) → detaches everything left in the series (junk hidden).
`adopt` pulls a round from outside the series when the window is empty (partner races that
exist as standalone events). Always run with `--dry` first; note that dry mode skips the
fold and the re-read, so "MISSING" lines in a dry run are often not real.

Companion: `scripts/repair-major-series-locations-2026-09-17.ts` — venue fixes by
series slug + date (geocodes a town, creates/reuses a `locations` row, locks `location_id`).

Examples to copy: `scripts/repair-major-series-2026-09-17.ts` (round 1),
`scripts/repair-series-round-2-2026-09-17.ts` (round 2).

## Method that worked

1. `previewUrl(officialUrl)` (from `run.ts`) → what the parser reads now. Compare with the
   site by eye (curl + strip tags). If the parser is short, fix the parser first — every
   round-1/2 gap was a parser edge (unanchored regex, a `Kemp` tripping the non-race filter,
   partner slugs not matching `/26-xx/`, "Datum konání" not read).
2. Query the DB: all `series` rows that look like the series (`ilike` on slug and name), the
   events under each (`merged_into_id is null`, season ≥ 2026-01-01), and the sources per
   event (`event_sources` → `watched_urls.url`). Duplicate series rows show up here.
3. Write the plan with dates from the official site (not from the DB), dry-run, run, verify
   through `listEvents({ seriesSlug })` or `GET /api/events?series=<slug>` — the count must
   equal the site.
4. Check locations (`events → locations(lat,lng,municipality)`): aggregator rows often carry
   place text like "Drásal" or "NMNM" and land far away, or share one bogus point.
5. Commit script + parser fix + a regression test for the parser edge.

## Done (verified against the official sites, locked)

| series slug | site | rounds |
|---|---|---|
| tbc-cyclocross | tbcserie.cz/kalendar-2026 | 11 |
| cesky-pohar-mtb (incl. MČR rounds, as the site lists them) | poharmtb.cz/cross-country | 7 |
| primacup | iprimacup.cz/zavody-2026 | 11 |
| kolo-pro-zivot (partner events detached) | kolopro.cz/zavody | 8 |
| detsky-mtb-cup | detskymtbcup.cz | 8 |
| prazsky-mtb-pohar | prahamtb.cz/?page_id=12 | 4 |
| talent-cup | talentcup.cz/?tcdesignindex=data/zavody.php | 8 |
| pohar-kv-kraje-hk | pkk-hk.cz/?pkkdesignindex=data/zavody.php | 10 |
| ppkbike (site shows 9; #9 is the season party, dropped on purpose) | ppkbike.cz/ppk-races.js | 8 |
| peklo-severu | pekloseveru.cz/cz/rocnik-2026/propozice-serialu/ | 5 |
| sumavsky-mtb-pohar (canonical; `sumavsky-pohar-mtb` folded in) | jcp-mtb.cz | 6 |

## Open — do these next, in this order

### A. Certain duplicates of one series (fold, then verify against the site)
- `czech-enduro-series` (3) + `t-mobile-ceska-enduro-serie` (4) — enduroserie.cz. Decide
  which slug the parser (`parseEnduroSerie` in cz-calendars.ts) writes and keep that one.
- `zal` (5) + `zapadoceska-amaterska-liga` (13) — zapadoceskaamaterskaliga.cz (`parseZal`).
- `uci-cx-world-cup` (12) + `uci-cyclox-world-cup` (10, Hynek label) — ucicyclocrossworldcup.com.
- `uci-mtb-world-series` (11) + `uci-mtb-world-cup` (1, Hynek label) — ucimtbworldseries.com.
- `cp-cyklo-x` (1) + `cp-cyclocross` (1) — Český pohár cyklokros; official calendar is
  cyklokros.cz/kalendar (`parseCyklokros`). Also `janev-cup` (8) + `mcr-cyclocross` (2) +
  `mcr-cyklo-x` (1) all come from cyklokros.cz — check what the site actually calls the
  series and how many rounds it has before folding.
- `peklo-severu` vs `cpp-extraliga-masters` (14): the latter is a **road** series
  (extraligamasters.cz, website now fixed); it borrowed pekloseveru.cz as website. Leave as
  two series, but verify its rounds against extraligamasters.cz/calendar.
- `jihocesky-mtb-pohar` (6, jihoceskymtbpohar.cz, marathon) is a different series from
  `sumavsky-mtb-pohar` (XC) — keep both, verify the marathon one against its site.

### B. Series with an official site that nobody verified round by round
Elimon Ústí MTB Cup (ustimtbcup.cz), MTB Biatlon (mtb-biatlon.cz, Hynek-template site),
O Pohár MČ Praha 4 (skvelopraha.cz/velky-haj), Jarní Bahno (bahno.ambike.com), Gravel
Series (gravelseries.cz), Galaxy série (mtbmaratonsusice.cz), Junior Cup (juniorcup.net),
Jesenický šnek (jesenickysnek.cz), Czech Enduro Series (after A), ČP BMX / MND Cup /
ŠKODA Cup (federation portal only — treat the portal as official for these).

### C. Series fed only by aggregators (find the official site, add it as a watched source
with an adapter, then repair)
Moravský pohár (sk-mp.cz exists, not read), Slezský pohár amatérských cyklistů
(miko-cycles.cz), Povltavský bikerský pohár (da-ba.com), Severočeská amatérská liga
(skfavoritbilina.cz), Jihočeská amatérská liga (jalcyklo.cz), Pohár Drahanské vrchoviny
(pohardrahanskevrchoviny.cz), Wood Bikerally Series (woodbikerallyseries.cz), Nížina cup,
FOX Grom Enduro (trailkids.cz), Road Classics (roadclassics.cz), Author Maraton Tour
(prazska50.cz), Čerčany BabyBikers (bb.cesyk.cz). Also ČP silnice / ČP silnice Ml+Ž /
ČP gravel: federation-only, no website — leave unless a calendar page exists.

### D. Not series at all — Hynek's discipline labels minted as series rows
`2-xcm`, `5-xcm`, `2-xco-xcc`, `6-xco-xcc-dhi`, `3-xco-xcc-dhi-edr`, `zavod`, `uci-zavod`,
`pmtbp`, `mcr-xcc`, `sport-base` (= Jesenický surovec, one race), `decathlon-cyklomaraton-kids`,
`fresh-enduro-2026-1`, `mtb-trilogy-enduro` (stage rows of Trilogy; the race is in Prima Cup
now). Detach their events (`series_id = null`), delete the rows, and stop them coming back:
`canonicalizeSeries` in hynek.ts already rejects `xcm|xco|xcc|dh|edr…` labels — extend the
reject list to whatever produced these (`závod`, `UCI ZÁVOD`, `PMTBP`, numeric-prefixed
combos like "2. XCO/XCC").

### E. Structural follow-ups
- prahamtb.cz is **not a watched source** though `parsePrahaMtb` exists; add
  `https://prahamtb.cz/?page_id=12` as an active `series` watched URL so the guard protects
  Pražský MTB pohár next season.
- Prima Cup: two rounds (MTB Trilogy 26-te, Českopetrovická koolna 26-ck) have no date on
  their iprimacup.cz page; they are locked in the DB but the parser cannot recreate them.
  If the site gains dates, nothing to do; otherwise next season needs the same manual seed.
- `scripts/audit-source-yield.ts` compares what a source offers to what the catalogue holds
  — run it after each batch; a series source whose yield ≠ DB count is the next suspect.
- Consider a nightly check: for every series whose website host is an active source, count
  `previewUrl(source)` events vs non-hidden series events this season; alert on mismatch.

## Gotchas learned the hard way

- Exact date windows. A one-day spill folded Pražský's Sunday round into Saturday's.
  Weekend rounds must carry their Sunday in `end`; consecutive one-day rounds use
  `swallowUntil` to keep windows apart (see Talent Cup Skočice 25.–26.9. vs 26.9.).
- Read the whole site, not the homepage: Talent Cup/PKK calendars live at `zavody.php`;
  iprimacup.cz partner rounds use slugs like `freedom-race`, `pm-2026`.
- Some sites 403 the bot UA intermittently; `BROWSER_UA_HOSTS` in `src/lib/watcher/http.ts`
  is the switch.
- The ČP MTB page lists MČR rounds inside the cup calendar — we file them in
  `cesky-pohar-mtb` named "MČR — …", matching how riders read the season.
- Location: aggregator place text ("Soumar", "NMNM", "Manitou Železné hory") geocodes
  anywhere. After a repair, always list `locations` for the rounds and fix by town.
- Never trust `series.website_url` blindly for the guard — a series minted from an
  aggregator may carry a club or sponsor site. Set it to the calendar host when repairing.
- `Any date` in the UI floors at today except under a series filter, which shows the whole
  calendar year — that is deliberate (`src/lib/events.ts`).

## Verification snippet

```ts
// npx tsx --tsconfig tsconfig.json <file>
import { listEvents } from "@/lib/events";
const ev = await listEvents({ seriesSlug: "primacup" });
console.log(ev.length, ev.map((e) => `${e.startDate} ${e.name} | ${e.location?.municipality}`));
```

(Load `.env.local` first the way the scripts do.) Compare the count with the site. Done
means equal, every round placed in the right town, and nothing visible in the series that
the site does not list.
