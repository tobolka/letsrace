# Let's Race

Map-first cycling race finder for kids and adults across Central Europe (CZ, DE, AT, SK, PL, IT, FR). Road, gravel, XC, XCM, and more — not just mountain bike.

## Stack

- Next.js (App Router) + TypeScript
- Supabase (Postgres + PostGIS)
- MapLibre GL + OpenFreeMap
- Watcher with layered extraction (JSON-LD → host adapters → generic)
- Admin for sources, discovery queue, **manual event create/edit with field locks**

## Setup

1. Copy `.env.example` → `.env.local` (a working `.env.local` is already prepared for the `startline` Supabase project).
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
- Run watcher on demand; Vercel Cron hits `/api/cron/watch` twice daily (05:00 & 17:00 UTC)

## Watcher

`GET/POST /api/cron/watch` with `Authorization: Bearer $CRON_SECRET`

Polls due `watched_urls`, hashes content, extracts events, discovers child links, respects locked overrides. Cron runs twice daily (05:00 and 17:00 UTC) on the Hobby plan.

## Locales

`en` (default), `cs`, `pl`, `sk` — race names stay in the original language.
