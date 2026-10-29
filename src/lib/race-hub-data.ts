import { unstable_cache } from "next/cache";
import { PUBLIC_CATALOGUE_TAG } from "@/lib/catalogue-cache";
import { listEvents } from "@/lib/events";

/** Shared hub rows: weekly, or sooner after an admin `refreshPublicCatalogue`. */
export const listHubEvents = unstable_cache(listEvents, ["race-hub-events-v1"], {
  revalidate: 60 * 60 * 24 * 7,
  tags: [PUBLIC_CATALOGUE_TAG],
});
