# Visual / mobile / images audit — letsrace.cz (2026-10-10)

Method: headless Chromium, 1366x768 desktop and 390x844 mobile (DPR 2, touch), pages /cs, /en, /cs/zavod/maifelder-gravel-loops-2026, /cs/zavody/pl, /cs/serie/alpentour-trophy. Screenshots in ../screenshots/ (`<page>-<viewport>-{early,fold,full}.png`, plus `og-*.png/jpg`).

## Findings

1. HIGH — Race-page og:image and JSON-LD image 404 on every race page (about 10k URLs).
   - Page emits `https://letsrace.cz/<loc>/zavod/<slug>/opengraph-image`, which returns 404 HTML (verified on 5 slugs, cs/en). Next serves the file-based route at a hashed path: `/cs/zavod/<slug>/opengraph-image-vodtca` returns 200, 1200x630 PNG, 28 KB, so the card itself is fine (see screenshots/og-race-1200x630.png).
   - Effect: no social preview, and SportsEvent `image` points to a 404.
   - Fix: `src/app/[locale]/(shell)/e/[slug]/page.tsx:63` and `src/components/seo/event-json-ld.tsx:74` hardcode `e/${slug}/opengraph-image`. Use Next's generated metadata image URL (drop the manual `images` override, or use `generateImageMetadata` / a stable non-hashed route handler).
   - Also set a long `Cache-Control` for that route; it is currently `max-age=0, must-revalidate` with MISS.

2. MEDIUM — Home layout shift is large and late (CLS 0.51 desktop, 0.47 mobile; Chromium, no throttling).
   - Desktop: the map skeleton (`animate-pulse bg-muted`) jumps from x=56/1302px wide to x=456/902px wide at about 3.1 s when the sidebar list appears (0.27).
   - Mobile: the list rows are injected at about 7.5 s (0.39) and the sheet reflows. The first screenshot shows an empty grey page with the bottom sheet collapsed, then the sheet snaps open.
   - Fix: reserve the sidebar width and sheet height in `loading.tsx` / `explore-shell.tsx:922`, and render the first N rows server-side.
   - Race, hub and series pages have CLS 0.

3. MEDIUM — Home above the fold is the map plus a welcome card, with no visible H1.
   - The H1 is a 1px sr-only element (top 7 px). The visible title in the card is not a heading.
   - The welcome card (`src/components/explore/welcome-card.tsx`) covers about 40% of the mobile viewport and the bottom-right map on desktop until dismissed.
   - This is dismissible, not a legal interstitial, but it shows on first paint and blocks the map and list on mobile.
   - There is no cookie or consent banner on any page.
   - Fix: collapse the card to a slim banner on mobile, and make the visible title a real heading.

4. MEDIUM — Race, hub and series pages are visually bare.
   - There are no images, map, or hero on the race page (0 `<img>`). The only visuals are chips and two buttons.
   - H1 and CTAs are above the fold on both viewports, which is good.
   - A past race still leads with "Web závodu" as the primary CTA.
   - Layout is a narrow left-aligned column in a wide white frame (desktop).
   - Fix: add a small static map or route image per race, and demote the CTA when the race is past.

5. LOW — Tap targets.
   - Desktop sidebar icons are 32x32.
   - Mobile breadcrumb links are 20 px tall (Procházet závody, Německo, Silnice), below the WCAG 2.2 AA 24 px minimum. Fix the breadcrumb link padding in `src/components/ui/breadcrumb.tsx`.
   - Mobile home list chips are 21 px tall.
   - Primary buttons are fine (about 44 px).
   - No horizontal overflow anywhere (scrollWidth equals viewport).

6. LOW — Fonts. Body is 16px, H1 is 30–34px, and the viewport meta is correct. Secondary metadata is 12px (about 18 elements on home, 11 on hub). Acceptable but light.

7. LOW — Static image caching.
   - `/intro-race*.webp` and the category SVGs are served with `max-age=0, must-revalidate`. Add long-cache headers in `next.config.ts` (the `headers()` block near line 90 only does this for `/maplibre`).
   - The category SVGs (`mtb/road/gravel/cyclocros/track/bmx.svg`, `alt=""`, 24px, `loading=auto`) are decorative and fine. `mtb.svg` and `cyclocros.svg` are both 2452 bytes, so possibly duplicate assets.
   - `public/og-race-v2.png` (2.7 MB) is not referenced in `src`; delete it.

## Images
- Home content image: `intro-race.webp` is 352x112 (19.8 KB) with a 704x224 @2x variant (70 KB). It has srcset, width/height, `fetchPriority=high` and a preload. `alt=""` is decorative, which is correct. This is good practice.
- Default OG (home/hub/series): JPEG 1600x840, about 246–250 KB. It renders correctly, is cached 1 h and is HIT on the CDN. The size is slightly heavy; 100–150 KB would be safer for WhatsApp/Messenger.
- Series and hub pages all reuse the generic home OG image, so there is no page-specific card.
- Race OG: the card is fine (dark 1200x630 PNG, wordmark, title, date), but its URL is broken (finding 1).
- The race card is plain text on dark with a large empty middle.

Images score: 55/100 (good home asset handling and a decent default OG, but all race OG/JSON-LD image URLs 404, no per-page imagery on content pages, weak static caching).

## Not checked / caveats
- Colour contrast of muted grey text was not measured.
- CLS source breakdown was captured on /cs only (desktop and mobile). /en showed the same totals (0.513 / 0.47) but its sources were not inspected. CLS was measured without throttling, so lab values only.
- Whether the hashed OG path (`opengraph-image-vodtca`) is stable across deploys was not verified. It is a local build hash, and it worked on prod today.
- OG images for pl/sk/de and for non-sample series/hubs were not fetched. Only cs/en home, the cs race card and the en race URL were checked.
- The 21px mobile home chips were measured, but I did not confirm whether they are visible or only in the off-screen drawer.
- `loading="lazy"` on below-fold images was not assessed beyond noting the hub category icons use `loading=auto`.
- Real-device rendering (Safari/iOS) was not tested; Chromium emulation only.
