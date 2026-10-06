import { cache } from "react";
import { unstable_cache } from "next/cache";
import { listEvents } from "@/lib/events";
import { PUBLIC_COUNTRY_CODES } from "@/lib/geo/europe";
import { belongsToCollection, collectionAgeCategories, collectionDates, collectionWindow, COLLECTION_SLUGS, type CollectionSlug, type CollectionWindow } from "@/lib/race-collections";

export type CollectionSummary = { slug: CollectionSlug; countryCode: string | null; count: number };

const loadSummaries = unstable_cache(async (window: CollectionWindow): Promise<CollectionSummary[]> => {
  const events = await listEvents({ dateFrom: window.from, dateTo: window.to });
  return COLLECTION_SLUGS.flatMap((slug) => {
    const matches = events.filter((event) => belongsToCollection(event, slug, window));
    return [
      { slug, countryCode: null, count: matches.length },
      ...PUBLIC_COUNTRY_CODES.map((countryCode) => ({ slug, countryCode, count: matches.filter((event) => event.location?.countryCode === countryCode).length })),
    ];
  });
}, ["race-collection-summaries-v2"], { revalidate: 600 });

/** Cache the small counts, rather than megabytes of full race records. */
export const listCollectionSummaries = cache(() => loadSummaries(collectionWindow()));

/** Shared by metadata and the page, with the same membership rules as the sitemap. */
export const getRaceCollection = cache(async (slug: CollectionSlug, countryCode?: string) => {
  const window = collectionWindow();
  const { from, to } = collectionDates(slug, window);
  const events = await listEvents({
    countryCodes: countryCode ? [countryCode] : undefined,
    dateFrom: from,
    dateTo: to,
    ageCategories: collectionAgeCategories(slug),
  });
  return { window, events: events.filter((event) => belongsToCollection(event, slug, window)) };
});
