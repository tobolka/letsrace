---
name: auth
description: Authenticate with Let's Race via Supabase OAuth for protected actions like race submissions.
---

# Auth

Let's Race uses Supabase Auth (OpenID Connect) for signed-in users.

## Discovery

- OpenID configuration: `/.well-known/openid-configuration`
- Protected resource metadata: `/.well-known/oauth-protected-resource`
- Human guide: `/auth.md`

## Registration

Agents and users sign in at `/en/auth` (or `/cs/auth`, `/pl/auth`, `/sk/auth`) via OAuth (Google).

## Protected endpoints

- `POST /api/submissions` — submit a race URL (requires session)
- `POST /api/account/bootstrap` — account setup (requires session)

## Anonymous access

Public read endpoints (`/api/events`, `/api/series`, `/api/places`) require no authentication.
