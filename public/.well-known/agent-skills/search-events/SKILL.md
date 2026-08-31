---
name: search-events
description: Query the Let's Race public API to find cycling events by date, location, and discipline.
---

# Search Events

Use the Let's Race public API to discover cycling races across Central Europe.

## Endpoints

- `GET /api/events` — list events with filters (`q`, `dateFrom`, `dateTo`, `west`, `south`, `east`, `north`, `disciplines`, `country`)
- `GET /api/series` — list race series
- `GET /api/places?q=` — geocode a place for map bounds

## OpenAPI

Full schema: `/.well-known/api-catalog` → `service-desc` → `/openapi.json`

## Example

```http
GET /api/events?dateFrom=2026-09-01&dateTo=2026-09-30&disciplines=gravel&country=CZ
Accept: application/json
```
