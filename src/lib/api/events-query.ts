import { z } from "zod";
import { all, dayParam, first } from "@/lib/api/schemas";

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

/** What `GET /api/events` accepts, parsed. The client builds its requests with `buildEventsQuery`, which is tested against this. */
export const eventsQuerySchema = z
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
