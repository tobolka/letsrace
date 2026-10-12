import { unstable_cache } from "next/cache";
import { listEvents } from "@/lib/events";

/** Query pages render per request; the public catalogue still refreshes hourly. */
export const listHubEvents = unstable_cache(listEvents, ["race-hub-events-v1"], { revalidate: 3600 });
