import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { parseQuery } from "@/lib/api/validate";
import { eventsQuerySchema } from "@/lib/api/events-query";
import { PUBLIC_CATALOGUE_TAG } from "@/lib/catalogue-cache";
import { listEvents } from "@/lib/events";

/**
 * The map, list and calendar share this. One URL, held on the CDN, instead of
 * a new function response for every pan and chip. The window is "from today":
 * a date in the past is a different query and is not served from here.
 * Dropped by `refreshPublicCatalogue` when an admin write lands.
 */
const upcomingCatalogue = unstable_cache(
  () => listEvents({}),
  ["public-catalogue-feed-v1"],
  // 24h data cache + CDN below: Free-tier Supabase egress/log ingestion cannot
  // afford a full catalogue pull on every short TTL miss.
  { revalidate: 60 * 60 * 24, tags: [PUBLIC_CATALOGUE_TAG] },
);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("catalogue") === "1") {
    const events = await upcomingCatalogue();
    return NextResponse.json(events, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        "CDN-Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
        "Vercel-CDN-Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
      },
    });
  }

  const parsed = parseQuery(sp, eventsQuerySchema);
  if (!parsed.ok) return parsed.response;
  const query = parsed.data;

  const events = await listEvents({
    q: query.q,
    audience: query.audience.length ? query.audience : undefined,
    disciplines: query.disciplines.length ? query.disciplines : undefined,
    levels: query.levels.length ? query.levels : undefined,
    ageCategories: query.categories.length ? query.categories : undefined,
    seriesSlug: query.series,
    countryCodes: query.country,
    season: query.season,
    eventTypes: query.eventType,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    anyDate: query.anyDate,
    west: query.west,
    south: query.south,
    east: query.east,
    north: query.north,
    polygon: query.polygon,
  });
  return NextResponse.json(events, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
      "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      "Vercel-CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
