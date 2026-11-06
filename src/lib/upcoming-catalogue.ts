import { unstable_cache } from "next/cache";
import { PUBLIC_CATALOGUE_TAG, PUBLIC_CATALOGUE_VIEWS_TAG } from "@/lib/catalogue-cache";
import { listEvents } from "@/lib/events";

/**
 * The map, list and calendar share this. One URL, held on the CDN, instead of
 * a new function response for every pan and chip. The window is "from today":
 * a date in the past is a different query and is not served from here.
 * Dropped by `refreshPublicCatalogue` when an admin write lands.
 */
export const upcomingCatalogue = unstable_cache(
  () => listEvents({}),
  ["public-catalogue-feed-v2"],
  // 24h data cache + CDN below: Free-tier Supabase egress/log ingestion cannot
  // afford a full catalogue pull on every short TTL miss.
  { revalidate: 60 * 60 * 24, tags: [PUBLIC_CATALOGUE_TAG, PUBLIC_CATALOGUE_VIEWS_TAG] },
);
