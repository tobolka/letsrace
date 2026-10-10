Finish the mobile performance work on the letsrace.cz home page (`/cs`, `/en`, …). Measure it, fix it and deploy it to production.

## Context
- Next.js 16.4 App Router on Vercel. Before writing Next code, read `node_modules/next/dist/docs/` (see AGENTS.md).
- The home page is `src/app/[locale]/(shell)/(map)/page.tsx`. It renders `ExploreShell` (client: a MapLibre map, a race list, `WelcomeCard`) and `SiteIndex` (an sr-only nav for crawlers, inside Suspense).
- Since 2026-10-10 the root layout is `app/[locale]/layout.tsx`. The race, series and hub pages are ISR and cached on the CDN. **The home page is still dynamic**: it reads `searchParams` (`?e=`).
- Audit: `reports/letsrace.cz-audit/` (`FULL-AUDIT-REPORT.md`, `findings/performance.md`).

## Working-tree state (do not commit other people's work)
- `src/components/seo/site-index.tsx`: done and not yet committed. Both `listEvents` queries are merged into one `Promise.all`, and the 10-day list is a slice of the 120-day one (`listEvents` pages through every row, so the result is the same). Commit it.
- The owner's other uncommitted changes (`src/lib/catalog/*`, `src/lib/llm/*`, `scripts/*`, `globals.css`, `skills-lock.json`, some tests) are **NOT** part of this task. Do not commit or change them. Commit only your own files: `git add <files>` and `git commit -- <files>`.
- `stash@{0}` holds a parked "organiser categories" feature. Leave it alone.

## Measurements so far
Helper: `scripts/lighthouse-ab.sh <label> <url> <runs>`, using `npx -y lighthouse@13`. The env var `LH_EXTRA="--throttling-method=devtools"` gives real throttling instead of the Lantern simulation. Use devtools throttling for decisions, because the simulation shows LCP of about 4.2 s even though the observed LCP is 95 ms.
- Local prod build (`npm run build`, then preview `letsrace-prod` on :3210), devtools throttling, **without** `(map)/loading.tsx`: score 68–72, LCP 2.5–2.7 s, TBT 310–380 ms, **CLS 0.39**.
- Without `loading.tsx`, the LCP element (the `WelcomeCard` image) renders with a delay of about 30–80 ms. With it, the delay was about 1,090 ms, because the card arrives in a later streamed chunk. `loading.tsx` is now restored in the repo. Its comment says the page waits about 1 s for a list, which **is no longer true** (see the comment in page.tsx).
- No A/B with `loading.tsx` under devtools throttling has been run yet. Run that first so the comparison is fair.

## What to do (in this order, measuring after each step with 3 runs and the median)
1. **Run the A/B for `(map)/loading.tsx`** with devtools throttling. If removing it helps LCP without breaking anything, remove it (git rm). Navigating to the map then has no skeleton, but the server responds quickly.
2. **CLS of about 0.39**: find the shifting elements (Lighthouse `layout-shifts` audit). Suspects:
   - `ListSkeleton` rows are `h-[60px]` (`src/components/explore/list-skeleton.tsx`), while the real rows in `explore-shell.tsx` are about 90 px.
   - The desktop map skeleton changes width (1302 → 902 px).
   - The MapLibre attribution control.
   Fix: make the skeletons the same size as the real elements and reserve the space.
3. **TBT**: `maplibre-gl.mjs` (about 1 MB raw, 0.6 s of scripting) loads eagerly through `loadMapLibre()` in `src/lib/maplibre.ts`. Defer map initialisation until after LCP or idle (`requestIdleCallback` with a timeout), at least on mobile. Do not break `?e=slug` (opening the map on a race) or the map↔list interaction.
4. Long cache for `/intro-race.webp`, `/intro-race@2x.webp` and the discipline SVGs (`/mtb.svg` etc.), which are currently `max-age=0`. Add an entry to `headers()` in `next.config.ts`, e.g. `public, max-age=31536000, immutable`, but only if the file names change when the content changes. Otherwise use something like a week plus `stale-while-revalidate`.
5. Optional, only if measurement shows a benefit: `experimental.inlineCss` in `next.config.ts`. The CSS is three times inside the HTML (about 455 KB of 590 KB uncompressed). Try it off and compare FCP and LCP.
6. Optional, a bigger change: make the home page static or ISR (drop `searchParams` from `page.tsx` and handle `?e=` on the client or in the proxy). Risk: `ExploreShell` uses nuqs (`useSearchParams`). Without its own `<Suspense>` the whole page falls back to client rendering, and `SiteIndex` and the LCP image disappear from the SSR. Only do this if the SSR HTML stays the same (check with `curl` that it contains `/cs/zavody/...` links and `intro-race`).

## If you are running in the cloud (a fresh clone without `.env.local`)
- Start from the `perf/home-handoff` branch (`git fetch origin && git checkout perf/home-handoff`). It contains this file, the `site-index.tsx` change and `scripts/lighthouse-ab.sh`.
- The owner's local in-progress files are not in the clone. You do not need to deal with them.
- Without Supabase env you cannot build or run the site locally. **Measure on Vercel preview deployments instead**: push the branch and Vercel builds a preview at `https://letsrace-git-<branch-with-slashes-as-dashes>-tobolkas-projects.vercel.app` (e.g. `letsrace-git-perf-home-handoff-tobolkas-projects.vercel.app`). Wait for the build first: `gh api repos/tobolka/letsrace/commits/<sha>/status` must be `success`.
- Baseline for comparison: production `https://letsrace.cz/cs`. Measure with the same script and devtools throttling.
- The first A/B (`loading.tsx` on/off) is then: production as is versus a preview without `loading.tsx`.
- If `vercel` or `gh` is not authenticated, push the branch and stop before merging to `main`. In the summary, give the preview URL and the measurements, and the owner merges it.

## Verification and deploy
- `npx tsc --noEmit`, `npm test` and `npx eslint <changed files>`. The maplibre-worker test fails only in a clean worktree without generated assets; in the main tree it passes.
- Visual check in the preview browser on mobile (375 px) and desktop: the map loads, the list and the welcome card show, and the `?e=<slug>` deep link opens the race.
- Deploy: commit only your files, then `git push origin HEAD:refs/heads/perf/home`. Wait for the Vercel preview: `gh api repos/tobolka/letsrace/commits/<sha>/status`, with the URL from `vercel ls letsrace`. Check the preview, then `git push origin HEAD:main` and delete the branch. Wait until the deployment is `Ready` in `vercel ls letsrace`, then measure production with `scripts/lighthouse-ab.sh prod https://letsrace.cz/cs 3` and devtools throttling.
- In the summary, give a before/after table: score, LCP, TBT and CLS, mobile, devtools throttling.
