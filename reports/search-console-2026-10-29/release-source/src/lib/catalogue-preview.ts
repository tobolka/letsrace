import { cache } from "react";
import { unstable_cache } from "next/cache";
import { listEvents } from "@/lib/events";
import { PUBLIC_CATALOGUE_TAG } from "@/lib/catalogue-cache";
import { addDaysIso } from "@/lib/seo-race-copy";
import { racePlace } from "@/lib/race-place";

// One shared read for all languages and views. Never cache a failed query as
// an empty calendar. This is a sample; country hubs provide the full catalogue.
const loadPreview = unstable_cache(async (today: string) => {
  const events = await listEvents({ dateFrom: today, dateTo: addDaysIso(today, 45) });
  return events.slice(0, 50).map((event) => ({
    slug: event.slug,
    name: event.name,
    startDate: event.startDate,
    place: racePlace(event),
    country: event.location?.countryCode ?? null,
  }));
}, ["catalogue-html-preview-v1"], { revalidate: 86400, tags: [PUBLIC_CATALOGUE_TAG] });

export const getCataloguePreview = cache(() => loadPreview(new Date().toISOString().slice(0, 10)));
