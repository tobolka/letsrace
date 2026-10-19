import { cache } from "react";
import { unstable_cache } from "next/cache";
import { listEvents } from "@/lib/events";
import { listQualifyingHubs } from "@/lib/discipline-hubs";
import { addDaysIso, seriesIn } from "@/lib/seo-race-copy";

export const SITE_INDEX_COUNTRIES = ["CZ", "SK", "PL", "DE", "AT", "IT", "CH"];

// Every page includes the same navigation. Cache only the links it needs,
// shared across pages and languages, rather than re-reading a whole season.
// Let failures reject: an empty fallback must not become the cached catalogue.
const loadSiteIndex = unstable_cache(async (today: string) => {
  const [hubs, season] = await Promise.all([
    listQualifyingHubs(SITE_INDEX_COUNTRIES),
    listEvents({ countryCodes: SITE_INDEX_COUNTRIES, dateFrom: today, dateTo: addDaysIso(today, 120) }),
  ]);
  const soonUntil = addDaysIso(today, 9);
  return {
    hubs,
    series: seriesIn(season).slice(0, 24),
    soon: season.filter((e) => e.startDate <= soonUntil).slice(0, 40).map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
      startDate: e.startDate,
      location: e.location ? { municipality: e.location.municipality } : null,
    })),
  };
}, ["site-index-links-v1"], { revalidate: 3600, tags: ["public-catalogue"] });

export const getSiteIndexData = cache(() =>
  loadSiteIndex(new Date().toISOString().slice(0, 10)).catch(() => ({ hubs: [], series: [], soon: [] })),
);
