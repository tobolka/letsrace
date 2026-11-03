/**
 * Hobby included usage, per team, per month:
 * 10 GB Fast Origin Transfer, 200,000 ISR write units (8 KB each), 4 h of
 * Fluid CPU.
 *
 * Public catalogue pages (map, list, schedule, hubs, race + series detail)
 * are the same for every visitor and change slowly — hold them on the CDN.
 * Admin edits still call `refreshPublicCatalogue`; watch/catalog crons do
 * not, so a daily poll cannot rewrite thousands of ISR/data-cache entries.
 */
export const CATALOGUE_CDN_SECONDS = 60 * 60 * 24 * 7;

export const CATALOGUE_CDN_CACHE = `public, s-maxage=${CATALOGUE_CDN_SECONDS}, stale-while-revalidate=86400`;

/** Shared by `unstable_cache` entries and `refreshPublicCatalogue`. */
export const PUBLIC_CATALOGUE_TAG = "public-catalogue";

/** Shared lists only: refreshing a batch must not expire every race detail. */
export const PUBLIC_CATALOGUE_VIEWS_TAG = "public-catalogue-views";

/** One changed race must not invalidate every catalogue page. */
export function publicEventTag(slug: string) { return `public-event:${slug}`.slice(0, 256); }

/** One series, including its public round list. */
export function publicSeriesTag(slug: string) { return `public-series:${slug}`.slice(0, 256); }
