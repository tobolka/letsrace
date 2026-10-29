<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Release notes: explain every change in human words

Every change that goes live gets judged for the riders and parents who use Let's Race, and written up in `src/lib/release-notes.ts`, which the About page shows under "What's new". Newest day first, one entry per day.

- **Decide first whether anyone cares.** Ask: would a rider, a parent or an organiser notice this, or be glad of it? If yes, write it. If it is only meh (a refactor, a dependency bump, a speed-up nobody can feel, a security fix with nothing to see, a tweak to an admin screen, a script, a test), leave it out. An empty day is fine. Do not pad.
- **Write for a non-technical person.** Say what they can now do, what is easier, or what stopped being wrong. No jargon: no "cache", "API", "refactor", "ISR", "migration", "endpoint", "bundle", "SSR", no component or file names. If you cannot say it without a technical word, say what the person sees instead.
- **One plain sentence per change**, in the present tense, about the thing as the reader meets it ("Races in your plan are tinted the same everywhere"), not about the work ("Unified PlannedRaceRow").
- **Write Czech and English by hand**; the other languages show the English until translated. Never claim more than the change does: check the diff before writing the sentence.
- **Group by the day it went live** (`YYYY-MM-DD`). Add to today's entry if it exists.
- Do this in the same change as the work, so the notes and the site go out together.
