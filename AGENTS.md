<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## New annual editions: build on the previous edition

When an organiser announces a new annual edition, use the latest verified edition as the starting point instead of treating the race as unknown. For 2027 this usually means the 2026 record. Most recurring races retain their identity, discipline, venue and audience; reuse that knowledge and progressively replace it with information confirmed for the new edition.

- Verify that this is the same race and venue, not another round of a cup or a similarly named event. Keep each annual edition as a separate record and preserve the old one.
- A new date needs an explicit announcement for the new year from a reliable source. Never calculate it from last year's date, weekday or edition number. An announced date is enough to start the new record; do not wait for full regulations.
- Carry forward stable facts where there is no evidence of a change: the race identity, discipline, general classification, organiser's year-neutral website and established venue. Record their origin in the previous edition; venue changes announced for the new year take precedence.
- Use last year's age categories as a useful provisional guide, with `age_confidence = previous` and the existing “as last year” label. Do not present old categories, routes, distances or schedules as confirmed for the new year. Keep other edition-specific details as historical reference until verified.
- Do not copy completed/cancelled status, results, old registration state or deadlines, fees, year-specific regulations, birth-year limits, or year-specific links as current information. Do not clone detailed category rows with old age/year limits.
- New verified information replaces inherited assumptions field by field. Preserve sources and distinguish confirmed facts from inherited ones; respect manual locks and defer ambiguous matches for review.
- When reviewing a season, check the websites linked from the previous year's races for next-year announcements, including homepages whose navigation and regulations still refer to the old year. Deduplicate shared URLs; a date elsewhere on a shared site is not automatically the date of every linked race.

Operational guidance and limits of the current automation: `docs/annual-editions.md`.

## Adding or updating a race: finish it from its regulations

A race is not done when it has a name, a date and a place. Whenever an agent adds a race or updates one, it also looks for the race's regulations (propozice, Ausschreibung, regulamin, regolamento, rozpis, race guide) and fills in what they say, through the same checks as everything else (`scripts/read-race.ts`, `verifyPracticalExtraction`).

- Look where the race came from first: its own page, the series' page, the federation's page (rad-net, federciclismo, pzkol), sign-up portals (maraton.cz, sportsoft, wynikizawodow) and the organiser's site. Search the web only after that.
- Take every detail the regulations give: organiser and contact, venue, timetable, fees, categories with birth years, routes, parking, and the links to regulations, sign-up and results. Quote the document; never guess or carry last year's values over as this year's.
- If a source has a fixed shape that no reader handles yet, write the reader (`src/lib/catalog/` with a test, a script in `scripts/`, and a daily step in `scripts/local-cycle.cjs`), so the next thousand races from it need no one. Read a few by hand first to learn the shape.
- If nothing is published yet, say so and leave the race to the daily readers; do not fill gaps with assumptions.
- Details read from documents follow `docs/race-completion-system.md`.

## Release notes: explain every change in human words

Every change that goes live gets judged for the riders and parents who use Let's Race, and written up in `src/lib/release-notes.ts`, which the About page shows under "What's new". Newest day first, one entry per day.

- **Only the app, never the catalogue.** Features, screens and how the app behaves. Never individual races, added or corrected races, race data, coverage or duplicates, not even as a general "more races" line.
- **Decide first whether anyone cares.** Ask: would a rider, a parent or an organiser notice this, or be glad of it? If yes, write it. If it is only meh (a refactor, a dependency bump, a speed-up nobody can feel, a security fix with nothing to see, a tweak to an admin screen, a script, a test), leave it out. An empty day is fine. Do not pad.
- **Write for a non-technical person.** Say what they can now do, what is easier, or what stopped being wrong. No jargon: no "cache", "API", "refactor", "ISR", "migration", "endpoint", "bundle", "SSR", no component or file names. If you cannot say it without a technical word, say what the person sees instead.
- **One plain sentence per change**, in the present tense, about the thing as the reader meets it ("Races in your plan are tinted the same everywhere"), not about the work ("Unified PlannedRaceRow").
- **Write Czech and English by hand**; the other languages show the English until translated. Never claim more than the change does: check the diff before writing the sentence.
- **Group by the day it went live** (`YYYY-MM-DD`). Add to today's entry if it exists.
- Do this in the same change as the work, so the notes and the site go out together.

## Hosting allowance: pushes and crawlers cost CPU

The hosting plan allows 4 hours of function CPU a month, and every production deployment empties the page cache, so the next visitors and crawlers re-render pages. A commit whose message contains `[no deploy]` does not deploy (`ignoreCommand` in `vercel.json`; git itself is not available there, because `.vercelignore` keeps `.git/` out), and `src/app/robots.txt/route.ts` keeps the costliest crawlers to the pages worth reading.

- Push app changes together, not one commit at a time.
- Put `[no deploy]` in the message of the last commit of a push only if nothing in that push changes the running site: pipeline scripts, reports and docs. Only that last commit is looked at, so a marked commit on top of an app change would leave the change undeployed.
- Never check hundreds of live pages to confirm a change; check a handful.
- Page refreshes past the daily allowance need the owner's say each time.
- When CPU rises, look first at Firewall → Traffic (top user agents) and deployments per day.

## Agent for unresolved races: only through the desk

An AI agent looks for missing regulations and judges possible duplicates the readers could not settle. Its definition for Codex is `.codex/agents/race-finder.toml`; the design is in `docs/pipeline-v2.md`, part 7.

- The agent works only through `scripts/agent-desk.cjs` (`status`, `next`, `answer`). It never writes to the catalogue, the database or project files.
- The desk allows 20 answers a day and checks each answer's shape. The Mac's cycle then fetches each quoted page again (`scripts/agent-verify.ts`); only an answer whose quote is found there goes on, as a proposal to the gate (`scripts/agent-apply.ts`, `pipeline_apply_proposal`).
- A page with a robot check or a sign-in is never read, by any means.
- A second agent, `.codex/agents/reader-repair.toml`, repairs one reader a run in a branch `agent/reader-<site>`. Nobody reviews it by hand: `scripts/reader-accept.cjs` merges the branch only if it touches readers, their tests and saved pages alone, deletes no test, and types and the whole suite pass on the merged result. Otherwise the branch stays unmerged with the reason.
- The agent does not run in the Mac's cycle on the Claude subscription unless the owner sets `AGENT_IN_CYCLE=1`; the owner chose Codex for it on 2026-11-11.

