import { NextRequest, NextResponse } from "next/server";
import { listEvents } from "@/lib/events";

/** Guard against a huge ring turning the polygon filter into a CPU sink. */
const MAX_POLYGON_POINTS = 500;

function finiteNumber(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse `polygon` as a ring of [lng, lat] pairs; reject anything else. */
function parsePolygon(raw: string | null): [number, number][] | undefined {
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

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const audience = sp.getAll("audience").filter(Boolean);
  const disciplines = sp.getAll("disciplines").filter(Boolean);
  const levels = sp.getAll("levels").filter(Boolean);
  const ageCategories = sp.getAll("categories").filter(Boolean);

  // A bbox is only meaningful whole — a partial or non-numeric one used to
  // slip through as NaN and silently return an empty list.
  const west = finiteNumber(sp.get("west"));
  const south = finiteNumber(sp.get("south"));
  const east = finiteNumber(sp.get("east"));
  const north = finiteNumber(sp.get("north"));
  const bboxParts = [west, south, east, north].filter((v) => v !== undefined);
  if (bboxParts.length > 0 && bboxParts.length < 4) {
    return NextResponse.json(
      { error: "west, south, east and north must all be finite numbers" },
      { status: 400 },
    );
  }

  const polygonRaw = sp.get("polygon");
  const polygon = parsePolygon(polygonRaw);
  if (polygonRaw && !polygon) {
    return NextResponse.json(
      { error: `polygon must be 3–${MAX_POLYGON_POINTS} [lng, lat] pairs` },
      { status: 400 },
    );
  }

  const events = await listEvents({
    q: sp.get("q") || undefined,
    audience: audience.length ? audience : undefined,
    disciplines: disciplines.length ? disciplines : undefined,
    levels: levels.length ? levels : undefined,
    ageCategories: ageCategories.length ? ageCategories : undefined,
    seriesSlug: sp.get("series") || undefined,
    countryCodes: sp.getAll("country").filter(Boolean),
    season: sp.get("season") || undefined,
    eventTypes: sp.getAll("eventType").filter(Boolean),
    dateFrom: sp.get("dateFrom") || undefined,
    dateTo: sp.get("dateTo") || undefined,
    west,
    south,
    east,
    north,
    polygon,
  });
  return NextResponse.json(events, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
    },
  });
}
