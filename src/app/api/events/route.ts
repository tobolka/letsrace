import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseQuery } from "@/lib/api/validate";
import { all, dayParam, first } from "@/lib/api/schemas";
import { PUBLIC_CATALOGUE_TAG } from "@/lib/catalogue-cache";
import { listEvents } from "@/lib/events";

/**
 * The map, list and calendar share this. One URL, held on the CDN, instead of
 * a new function response for every pan and chip. The window is "from today":
 * a date in the past is a different query and is not served from here.
 * Dropped by `refreshPublicCatalogue` when a watch or an admin write lands.
 */
const upcomingCatalogue = unstable_cache(
  () => listEvents({}),
  ["public-catalogue-feed-v1"],
  { revalidate: 60 * 60 * 12, tags: [PUBLIC_CATALOGUE_TAG] },
);

/** Guard against a huge ring turning the polygon filter into a CPU sink. */
const MAX_POLYGON_POINTS = 500;

/** A number, or nothing: a blank or unreadable value is no value at all. */
const finiteNumber = first.transform((raw) => {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
});

/** Parse `polygon` as a ring of [lng, lat] pairs; reject anything else. */
function parsePolygon(raw: string | undefined): [number, number][] | undefined {
  if (!raw) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;
  if (parsed.length < 3 || parsed.length > MAX_POLYGON_POINTS) return undefined;
  const ring: [number, number][] = [];
  for (const pair of parsed) {
    if (!Array.isArray(pair) || pair.length < 2) return undefined;
    const lng = Number(pair[0]);
    const lat = Number(pair[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return undefined;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return undefined;
    ring.push([lng, lat]);
  }
  return ring;
}

const querySchema = z
  .object({
    q: first.transform((v) => v || undefined),
    audience: all,
    disciplines: all,
    levels: all,
    categories: all,
    series: first.transform((v) => v || undefined),
    country: all.transform((values) => values.flatMap((v) => v.split(",")).filter(Boolean)),
    season: first.transform((v) => v || undefined),
    eventType: all,
    dateFrom: dayParam("dateFrom"),
    dateTo: dayParam("dateTo"),
    anyDate: first.transform((v) => v === "1"),
    west: finiteNumber,
    south: finiteNumber,
    east: finiteNumber,
    north: finiteNumber,
    polygon: first,
  })
  // A bbox is only meaningful whole — a partial or non-numeric one used to
  // slip through as NaN and silently return an empty list.
  .refine(
    ({ west, south, east, north }) => {
      const given = [west, south, east, north].filter((v) => v !== undefined).length;
      return given === 0 || given === 4;
    },
    { error: "west, south, east and north must all be finite numbers" },
  )
  .transform((query, ctx) => {
    const polygon = parsePolygon(query.polygon);
    if (query.polygon && !polygon) {
      ctx.issues.push({
        code: "custom",
        message: `polygon must be 3–${MAX_POLYGON_POINTS} [lng, lat] pairs`,
        input: query.polygon,
      });
      return z.NEVER;
    }
    return { ...query, polygon };
  });

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("catalogue") === "1") {
    const events = await upcomingCatalogue();
    return NextResponse.json(events, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        "Vercel-CDN-Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400",
      },
    });
  }

  const parsed = parseQuery(sp, querySchema);
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
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
    },
  });
}
