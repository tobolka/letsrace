# Let's Race

Map-first cycling race finder for kids and adults across Central Europe (CZ, DE, AT, SK, PL, IT, FR). Road, gravel, XC, XCM, and more — not just mountain bike.

## Stack

- Next.js (App Router) + TypeScript on Cloudflare Workers
- Supabase (Postgres + PostGIS)
- Leaflet raster map (Carto Voyager tiles, a small custom runtime in `public/maps/light-v1`)
- Watcher with layered extraction (JSON-LD → host adapters → generic)
- Admin for sources, discovery queue, **manual event create/edit with field locks**

## Hosting

Cloudflare Workers (OpenNext), not Vercel. Pushes to `main` deploy automatically; cron triggers run the daily jobs; secrets are Worker secrets. Read [docs/hosting.md](docs/hosting.md) for where things run, how to deploy, roll back and read logs.

## Setup

1. Copy `.env.example` → `.env.local` (a working `.env.local` is already prepared for the `letsrace` Supabase project).
2. Set `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` (both required — no defaults).
3. Optional: add `SUPABASE_SERVICE_ROLE_KEY` from Supabase → Project Settings → API.
4. Install and run:

```bash
npm install
npm run dev
```

- Map: [http://localhost:3000/en](http://localhost:3000/en)
- Admin: [http://localhost:3000/admin](http://localhost:3000/admin)

## Admin features

- Paste federation / series / race URLs (bulk)
- Extraction preview before trusting a page
- Discovery queue (accept/reject found links)
- **Add event manually** with URL + full field edit
- **Edit scraped events** and lock fields so the watcher will not overwrite them
- Run watcher on demand; the cron triggers in `wrangler.jsonc` call the `/api/cron/*` jobs daily (Cloudflare Workers)

## Watcher

`GET/POST /api/cron/watch` with `Authorization: Bearer $CRON_SECRET`

Polls due `watched_urls`, hashes content, extracts events, discovers child links, respects locked overrides. Cron runs twice daily (05:00 and 17:00 UTC) on the Hobby plan.

## Locales

`en` (default), `cs`, `pl`, `sk` — race names stay in the original language.
