/**
 * Hobby included usage, per team, per month:
 * 10 GB Fast Origin Transfer, 200,000 ISR write units (8 KB each), 4 h of
 * Fluid CPU.
 *
 * Shell pages (map home, list, schedule, browse hubs) are the same for every
 * visitor and change slowly — hold those on the CDN. Race and series detail
 * pages are not held: a watch or an editor change must show up on the next
 * request, and those pages do not need to be the fast path.
 */
export const CATALOGUE_CDN_SECONDS = 60 * 60 * 24 * 7;

export const CATALOGUE_CDN_CACHE = `public, s-maxage=${CATALOGUE_CDN_SECONDS}, stale-while-revalidate=86400`;

/** Shared by `unstable_cache` entries and `refreshPublicCatalogue`. */
export const PUBLIC_CATALOGUE_TAG = "public-catalogue";
