# GEO / AI Search Readiness: letsrace.cz (2026-10-10)

**AI Search Readiness score: 44/100**

| Dimension | Weight | Score | Notes |
|---|---|---|---|
| Citability | 25% | 45 | Race facts are in the SSR HTML, but the "About" paragraph is one templated ~40-word block. No distance or fee, and it can state wrong entry status |
| Structural readability | 20% | 50 | One H1 and one H2 on race pages. Facts sit in `div` rows with no `dl`/`table`. 3-4 nested `<main>` elements |
| Multi-modal | 15% | 25 | 0 images on race pages (OG image only). The map renders client-side |
| Authority & brand | 20% | 20 | No Organization or WebSite schema, no sameAs. Zero Wikipedia and HN presence |
| Technical accessibility | 20% | 75 | SSR, every AI user agent gets 200, agent surfaces exist. Some are inconsistent (see below) |

Platform estimates: Google AIO 40, ChatGPT Search 35, Perplexity 40, Bing Copilot 25.

## AI crawler access (verified)
The same robots group (`User-agent: *`, `Allow: /`) applies to every bot. I sent requests with spoofed user agents to `/`, a race page, a hub and robots.txt. All returned 200 (`/` returned 308 to /en). Bots tested: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Google-Extended, Googlebot, Applebot, Applebot-Extended, CCBot, bingbot, cohere-ai, meta-externalagent, Bytespider and python-requests. No Vercel or Cloudflare challenge appeared, and the code has no user-agent logic. **Unchecked:** whether bots coming from their real IPs (not spoofed user agents) get the same treatment.

- Search and citation crawlers (OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, Applebot, bingbot): allowed. This is correct.
- Training crawlers (GPTBot, ClaudeBot, CCBot, cohere-ai, Applebot-Extended): also allowed. `Content-Signal: ai-train=no` is only a preference that crawlers may choose to honour, so it does not stop them. Google-Extended also controls Gemini grounding, so keep it allowed while `ai-input=yes`.
- `/llms.txt`: 404. It is optional and Google ignores it. Info only.

## Findings
| Sev | Finding | Fix |
|---|---|---|
| High | **No entity graph.** No Organization or WebSite JSON-LD, no sameAs, no social profiles. Wikipedia has no article or external links (en search and cs exturlusage). HN has 0 hits | Add Organization (name, url, logo, founder Person "Radek Tobolka", sameAs) and WebSite to `src/app/[locale]/layout.tsx` (or the home page). Create LinkedIn, Instagram, Strava and YouTube profiles and list them in sameAs |
| High | **Coverage gap for target queries.** `/cs/zavody/cz/gravel` lists **1** race for the next 12 months. The API has only 99 upcoming CZ events (42 CX) and 28 CZ events in 2027. The page copy also says "1 závodů" (should be "1 závod") | This is a data and ingest problem: add Czech gravel sources. Fix the plural in the hub intro copy (string location not checked) |
| Med | **Wrong entry status.** The summary says "Přihlásit se dá online" (you can register online) after entry has closed: `src/lib/seo-race-copy.ts:420-424`. JSON-LD sets Offer `availability: InStock` even when `validThrough` is in the past: `src/components/seo/event-json-ld.tsx:84-91` | When entries are closed, emit the "entry closed {date}" sentence, and use SoldOut or drop the Offer |
| Med | **Distance and fee missing.** `event_categories.distance_km` is loaded (`src/lib/events.ts:63`), but the page shows category names only (`e/[slug]/page.tsx:211-215`). There is no fee field anywhere | Render a Category / Distance / Age table and add `price`/`priceCurrency` to the Offer. Put distances in `raceSummary` |
| Med | **Thin, templated passage.** The "About" paragraph is the same ~40-word template on about 10k URLs (target length is 134-167 words of distinct facts) | Extend `raceSummary` (`seo-race-copy.ts:413`) with distances, organizer, previous edition and series context |
| Med | **robots.txt blocks the API it advertises.** `Disallow: /api/` (`src/app/robots.txt/route.ts:18`), while ai-catalog, api-catalog, the skills and openapi all point agents to `/api/events` | Add `Allow: /api/events`, `/api/series` and `/api/places` before the Disallow |
| Med | **No Bing signals.** The `msvalidate.01` meta is not deployed (env var unset, `src/app/layout.tsx:83`) and there is no IndexNow. Bing feeds Copilot and part of ChatGPT Search | Verify the site in Bing Webmaster Tools, submit the sitemap and add IndexNow pings from the catalog cron |
| Low | **MCP server card is misleading.** It advertises `streamable-http` at `https://letsrace.cz/en`, but a JSON-RPC POST there returns HTML (the card itself says HTTP MCP is not deployed) | Remove `transport` from `src/app/.well-known/mcp/server-card.json/route.ts`, or deploy a real endpoint |
| Low | **sameAs misused.** Registration, regulations and results URLs are listed as sameAs (`event-json-ld.tsx:52-57,71`). There is no `organizer` | Use only the official website as sameAs. Add `organizer` when known |
| Low | **Facts not semantic.** The meta rows are `div`s (`e/[slug]/page.tsx:181-266`) | Use `<dl><dt><dd>` |
| Low | **Nested `<main>`.** `src/components/ui/sidebar.tsx:310` renders a `<main>` that wraps each page's own `<main>` | Change the sidebar inset to a `<div>` |
| Low | **Markdown on the homepage only.** `Accept: text/markdown` works on the homepage only (`src/proxy.ts:69`); race pages return HTML. `/` returns a 344 KB HTML body along with its 308 | Extend markdown to race and hub pages and serve the same content at `/llms.txt`. Redirect `/` → `/en` in the proxy |
| Low | **Training crawlers not blocked.** If `ai-train=no` is the real intent, it is not enforced | Add Disallow groups for GPTBot, ClaudeBot, CCBot, cohere-ai and Applebot-Extended only |

## Agent surfaces (verified working)
These all return 200: ai-catalog.json, api-catalog (linkset), agent-skills index (both SKILL.md sha256 digests match), server-card, openapi.json, `/docs/api` and `/auth.md`. Link headers are present on the homepage only. `/api/events` returns 830 KB (869 events) when called with no parameters, ignores `limit`, and its schema is an untyped `object`. **Open:** add pagination and a typed response schema.

## Unchecked
- SERP and AI-answer winners for "cyklistické závody 2027 kalendář" and "gravel race Czech 2027". Bing scraping was bot-detected and returned off-topic results, Google showed a consent wall, and DuckDuckGo returned a 202 challenge. Bing `site:letsrace.cz` showed no letsrace pages (low confidence).
- Reddit (API blocked), YouTube and LinkedIn mentions.
- Google and Bing verification set up over DNS.
- Live ChatGPT and Perplexity answers.
