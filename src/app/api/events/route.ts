import { NextRequest, NextResponse } from "next/server";
import { parseQuery } from "@/lib/api/validate";
import { eventsQuerySchema } from "@/lib/api/events-query";
import { PUBLIC_CATALOGUE_VIEWS_TAG } from "@/lib/catalogue-cache";
import { listEvents } from "@/lib/events";
import { upcomingCatalogue } from "@/lib/upcoming-catalogue";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("catalogue") === "1") {
    const events = await upcomingCatalogue();
    return NextResponse.json(events, {
      headers: {
        "Cache-Control": "public, max-age=60, must-revalidate",
        "Vercel-Cache-Tag": PUBLIC_CATALOGUE_VIEWS_TAG,
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
