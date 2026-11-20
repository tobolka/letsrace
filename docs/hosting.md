# Hosting: Cloudflare Workers

Let's Race runs on **Cloudflare Workers** (Next.js through OpenNext). Since 2026-11-20 nothing
runs on Vercel; the old Vercel projects are paused and can be deleted (not before 2026-11-27).
This is the one page to read for "where does it run and how do I change it".

## What runs where

| Part | Where | Notes |
| --- | --- | --- |
| Website, API, admin | Worker `letsrace` on the owner's Cloudflare account | Domains `letsrace.cz` and `www.letsrace.cz` (custom domains in `wrangler.jsonc`); `www` redirects to the apex in `next.config.ts` |
| Database, sign-in | Supabase project `xlomrxswdcekarazaahx` (Frankfurt) | Unchanged |
| E-mail | Resend (sender `zavody@letsrace.cz`) | Unchanged |
| Analytics | Worker `umami` (repo `tobolka/umami-analytics`), `stats.letsrace.cz`, Neon database | Tracker loads only when `NEXT_PUBLIC_DEPLOY_ENV=production` (`src/components/analytics/umami.tsx`) |
| Pipeline (reading sources, AI) | The owner's Mac plus GitHub Actions | Talks to the Worker with `CRON_SECRET` (`scripts/local-runner.cjs`) |
| DNS | Cloudflare zone `letsrace.cz` | Mail and `_agents` records stay as they were |

## Deploying

- Every push to `main` is built and deployed by **Cloudflare Workers Builds** (Cloudflare →
  Workers & Pages → `letsrace` → Deployments). Build `npm run build:cloudflare`, deploy
  `npm run deploy:cloudflare`. A build takes about 3 minutes.
- By hand (needs `wrangler login`): `npm run build:cloudflare && npx opennextjs-cloudflare deploy`.
- Roll back: Cloudflare → `letsrace` → Deployments → pick an earlier version → Rollback, or
  `npx wrangler rollback`.
- Each deploy starts with an empty page cache (the cache key includes the deployment id), so
  group app changes into one push. Docs, reports and agent/CI files do not rebuild the site:
  `docs/**`, `reports/**`, `.agents/**` and `.github/**` are excluded under Worker → Settings → Builds →
  Build watch paths (set 2026-11-20). `scripts/**` is not excluded: the build uses it.
- The bundle is about 7.3 MB gzipped; the Workers Paid limit is 10 MB. If a deploy fails with
  a size error, look at what was newly imported into server code.

## Configuration and secrets

- **Public values** (`NEXT_PUBLIC_*`, the Supabase URL and publishable keys, budget switches) are in
  `wrangler.jsonc` `vars`. `NEXT_PUBLIC_*` values are inlined at build time, so a change needs a deploy.
- **Secrets** are Worker secrets, never in the repo: `CRON_SECRET`, `EMAIL_LINK_SECRET`,
  `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Set with `npx wrangler secret put NAME` or in the
  dashboard (Worker → Settings → Variables and secrets). Do not paste secrets into chat.
- `CRON_SECRET` must equal the value in `.env.local` on the Mac, or the pipeline's calls to
  `/api/cron/*` and `/api/ops/*` answer 401. After changing one, change the other.
- Old e-mail links (unsubscribe) signed with a former `EMAIL_LINK_SECRET` stop working when it changes.
- `SERVERLESS_RUNTIME=1` and `isServerless()` (`src/lib/runtime.ts`) mean "no browser, no disk";
  the pipeline on the Mac is the opposite. `process.env.VERCEL` no longer exists.

## Scheduled jobs

Cloudflare cron triggers (UTC) call the Worker's own routes with `CRON_SECRET`
(`cloudflare-worker.ts`, schedules in `wrangler.jsonc`):

| Cron | Route |
| --- | --- |
| `10 4 * * *` | `/api/cron/weather-history` |
| `0 4 * * 3` | `/api/cron/digest` |
| `15 5 * * *` | `/api/cron/catalog` |
| `30 5 * * *` | `/api/cron/public-refresh` |
| `40 5 * * *` | `/api/cron/publication` |
| `45 5 * * *` | `/api/cron/alerts` |

Each run may use up to 5 minutes of CPU (`limits.cpu_ms`). A failed run shows in the Worker's
logs; check the effect in the database (for example `weather_history_attempts.started_at`).

## Caching

- Prerendered pages come from the static assets (`staticAssetsIncrementalCache` in
  `open-next.config.ts`); they refresh only on deploy.
- `cloudflare-worker.ts` keeps public pages and API answers in the Workers cache for as long as
  `CDN-Cache-Control: public, s-maxage=N` says, capped at 30 minutes. There is no tag-based purge:
  a change reaches visitors after at most that time. Look for the response header `x-edge-cache: HIT`.
- Images are plain `<img>`; there is no image optimiser (`images.unoptimized`).

## Protection and cost

- Workers Paid plan, 5 USD a month: 10 million requests and 30 million CPU milliseconds included, then
  0.30 USD per million requests and 0.02 USD per million CPU ms. Watch Workers & Pages → `letsrace` → Metrics.
- Rate limit rule on the zone (Security → Security rules): 100 requests per 10 seconds per IP on
  `letsrace.cz` and `www`, then block for 10 seconds. `stats.` is excluded.
- Bot Fight Mode is off on purpose: it cannot be bypassed and would block the Mac's calls to the
  Worker. `robots.txt` (`src/app/robots.txt/route.ts`) keeps heavy crawlers to useful pages.

## Looking at problems

- Live logs: `npx wrangler tail letsrace --format pretty`.
- Errors in the dashboard: Workers & Pages → `letsrace` → Observability.
- Status code mismatch after a deploy: compare `https://letsrace.tobolka.workers.dev/<path>` with the live host.

## What is different from Vercel

No ISR tag purge, no Vercel Analytics or Speed Insights, no `Vercel-*` response headers, no build-time
database migrations, no per-branch preview deployments, no `vercel.json` (cron triggers are in
`wrangler.jsonc`). Older notes in `docs/` that mention Vercel describe the past and say so at the top.
