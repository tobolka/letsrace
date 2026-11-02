import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseQuery } from "@/lib/api/validate";
import { apiError } from "@/lib/api/respond";
import { first, isoDay } from "@/lib/api/schemas";
import { clientIp, rateLimit } from "@/lib/security";
import { raceWeather } from "@/lib/weather";
import { readWeatherHistory } from "@/lib/weather-history";
import { weatherCacheSeconds } from "@/lib/weather-cache";

// Two decimals is a kilometre: close enough for weather, and it lets the CDN
// answer every visitor of a race from one cached copy.
const coord = (min: number, max: number) =>
  first
    .transform((v) => (v ? Number(v) : Number.NaN))
    .pipe(z.number().min(min).max(max))
    .transform((n) => Math.round(n * 100) / 100);

const querySchema = z.object({
  lat: coord(-90, 90),
  lng: coord(-180, 180),
  date: first.pipe(isoDay),
});

/** The forecast for a race day close by, and what that day is usually like. */
export async function GET(req: NextRequest) {
  if (!rateLimit(`weather:${clientIp(req)}`, 60, 60_000)) return apiError(429, "Too many requests");
  const parsed = parseQuery(req.nextUrl.searchParams, querySchema);
  if (!parsed.ok) return parsed.response;
  const { lat, lng, date } = parsed.data;
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) return apiError(404, "race day has passed");

  const history = await readWeatherHistory(lat, lng, date).catch(() => null);
  const weather = await raceWeather(lat, lng, date, today, history?.climate ?? null);
  // A forecast moves every few hours; ten years of history barely moves at all.
  // But an answer with a part missing is Open-Meteo having a slow minute, not
  // the weather: held for a month, it hid the weather of a race for a month.
  const maxAge = weatherCacheSeconds(weather, date);
  return NextResponse.json({ ...weather, climateUpdatedAt: history?.updatedAt ?? null, climateReferenceYear: history?.referenceYear ?? null }, {
    headers: { "Cache-Control": `public, s-maxage=${maxAge}, must-revalidate` },
  });
}
