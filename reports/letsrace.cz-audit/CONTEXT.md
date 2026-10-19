# Audit context: letsrace.cz (shared brief for specialist agents)

Audit date: 2026-10-10. Output dir: /Users/radektobolka/letsrace/reports/letsrace.cz-audit/
Write your findings to `findings/<category>.md` in that dir (write a partial file early, overwrite at end).
Do NOT modify any source code in the repo. Read-only on /Users/radektobolka/letsrace (except the findings file).

## Site
- Let's Race: map + calendar of amateur/pro cycling races (road, gravel, MTB, cyclocross, kids) across Central Europe.
- Business type: event directory / programmatic catalogue (publisher-like). Not local, not e-commerce.
- Stack: Next.js (App Router, a newer version with breaking changes — see node_modules/next/dist/docs/), hosted on Vercel (fra1), Supabase backend.
- Source is in /Users/radektobolka/letsrace — cite `file:line` for every fix you recommend. Key paths:
  - src/app/sitemap.ts, src/app/robots.txt, src/app/opengraph-image.tsx
  - src/app/[locale]/(shell)/... (routes; race detail is `e/[slug]/page.tsx`, rewritten to localized slugs)
  - src/lib/i18n/ (messages, localized path segments), src/proxy.ts or middleware (locale redirect)
- Plugin runtime: `"/Users/radektobolka/.claude/plugins/cache/agricidaniel-claude-seo/claude-seo/2.3.1/scripts/claude-seo" run <script.py>` (ready).
- No Google API creds, no Moz/Bing keys. No drift baseline.

## Locales & URL structure (5 locales: en, cs, pl, sk, de; x-default=en)
| type | en | cs | de | pl | sk | count per locale |
|---|---|---|---|---|---|---|
| race detail | /en/race/<slug> | /cs/zavod/ | /de/rennen/ | /pl/wyscig/ | /sk/pretek/ | 2016 |
| series | /en/series/ | /cs/serie/ | /de/serie/ | /pl/seria/ | /sk/seria/ | 79 |
| country/discipline hubs | /en/races/<cc>[/<discipline>] | /cs/zavody/ | /de/radrennen/ | /pl/wyscigi/ | /sk/preteky/ | 62 |
| home | /en | /cs | ... | | | 1 |
Sitemap: single file https://letsrace.cz/sitemap.xml, 10,790 URLs, 9.5 MB, 64,740 xhtml:link hreflang alternates, has changefreq/priority, lastmod present.

## Already observed (verify, extend, don't just repeat)
- `https://letsrace.cz` → 308 → /en for no Accept-Language and for Googlebot UA; 307 → /cs or /de when Accept-Language cs/de. www and http → 308 → https://letsrace.cz/.
- robots.txt: Allow /, Disallow /admin, /api/; Content-Signal: ai-train=no, search=yes, ai-input=yes; points to /.well-known/ai-catalog.json. /llms.txt → 404.
- Headers: HSTS (no includeSubDomains/preload), CSP, XFO DENY, nosniff, Referrer-Policy, Permissions-Policy. `cache-control: private, no-cache, no-store` on HTML, x-vercel-cache MISS → every page dynamically rendered.
- TTFB/total (curl, Prague-ish): home /cs 3.5s, race page 2.0s, series 1.7s, hub 1.3s.
- HTML weight: home ~636 KB, race page ~591 KB, 404 page ~365 KB; ~60 <script> tags on home.
- Home (/cs, /en): good title/desc/OG/Twitter, canonical self, 6 hreflang links, single H1, 4 H2s, ~780 visible words, **no JSON-LD at all** (no WebSite/Organization).
- Race page sample /cs/zavod/maifelder-gravel-loops-2026: title "Maifelder Gravel Loops 2026 – silniční závod, Naunheim" — a GRAVEL race labelled "road race" (silniční) and breadcrumb goes Germany › Silnice (road). Only ~83 visible words in SSR HTML, one H2 ("O závodě"), 0 images. og:type=website. JSON-LD SportsEvent (name, url, startDate, endDate, eventStatus, sport, image=OG, location Place w/ PostalAddress where addressLocality = "Grillhütte am Maifeldradweg, Naunheim" i.e. venue in locality field, geo) — no organizer, no offers, no performer. Plus BreadcrumbList. Past race still indexable with "Tento závod už proběhl".
- Series sample /cs/serie/alpentour-trophy: CollectionPage + ItemList(1) + Breadcrumb, ~70 words, default OG image.
- Hub sample /cs/zavody/pl: CollectionPage + ItemList(186) + Breadcrumb, ~94 visible words; item names are raw Polish organizer names (untranslated) on the Czech page.
- Programmatic concern: 2016 races × 5 locales ≈ 10k near-duplicate thin pages differing mainly in UI chrome.
