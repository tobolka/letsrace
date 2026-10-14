---
name: auth
description: Use the Let's Race public read API without credentials or agent registration.
---

# Public Agent Access

No API key, access token, OAuth flow, or agent registration is required for public reads.

## Discovery

- Access policy: `/auth.md`
- API documentation: `/docs/api`
- OpenAPI schema: `/openapi.json`

## Public endpoints

- `GET /api/events` — search cycling events.
- `GET /api/series` — list race series.
- `GET /api/places?q=` — geocode a place (at least three characters).

Send `Accept: application/json`. No `Authorization` header is needed.

## Scope

Use these read endpoints directly. Account, admin, and write operations are outside this public agent interface.
Human browser sign-in is separate; no agent credentials are issued.
