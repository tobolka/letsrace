# Supabase

Remote project: `startline` (`xlomrxswdcekarazaahx`).

## Migrations

SQL files in `migrations/` are the source of truth for schema changes that
matter for explore performance and ingest health.

Apply with Supabase MCP / dashboard, or:

```bash
supabase db push
```

Existing production indexes are captured in `20260814_baseline_indexes.sql`
(idempotent). New composite indexes live in `20260814_explore_ingest_indexes.sql`.
