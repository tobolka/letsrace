# SEO plan (2026-10-04)

Search Console, 3 months: 41 impressions, 0 clicks, English queries only.

## What a crawler sees today

- `/` sends everyone to `/en`, Czech readers included.
- Home (`/cs`): ~480 characters of text and no link to any race, country page or series. The map is drawn in the browser.
- `/cs/list` is canonical to `/cs`; `/cs/calendar` is noindex. Neither links a race.
- Country and discipline hubs list at most 40 races of the next 60 days. Their dates are in English ("3 Oct 2026") on every language.
- Race pages: ~350 characters of text. Classes with ages, entry deadline, the other rounds of the series and races nearby are not on the page. The description is generic.
- Sitemap: race, hub and series entries only as `/en/...` locs (other languages only as hreflang alternates). Series are missing entirely: the query joined `events` without naming the foreign key and silently returned nothing.
- No German pages, though Germany has the most races.

## Phases

1. **Crawlability**: sitemap with every language as its own entry and the series back; `/` by the reader's language; home with a crawlable section linking country hubs, discipline hubs, series and this weekend's races; hubs list every upcoming race grouped by month, dates in the page's language.
2. **Race pages**: local-language title and description built from the data; a written summary; classes with ages; entry link and deadline; regulations; the series' other rounds; races the same weekend nearby; breadcrumbs; fuller SportsEvent data (description, image, offers with the entry deadline, superEvent, sport).
3. **Series pages**: every round with place and date, the series' classes, links to the country and discipline hubs.
4. **German** as a fifth language.
5. **Off-site** (owner): organisers and clubs linking their race page; Search Console checks.

Each phase is checked on a local build (crawler's view: text, links, metadata) before it goes live.
