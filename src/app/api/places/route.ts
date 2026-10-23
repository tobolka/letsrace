import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseQuery } from "@/lib/api/validate";
import { apiError } from "@/lib/api/respond";
import { first } from "@/lib/api/schemas";
import { geocodePublicPlace } from "@/lib/geocode";
import { clientIp, rateLimit } from "@/lib/security";

const querySchema = z.object({
  q: first
    .transform((v) => (v ?? "").trim())
    .refine((v) => v.length >= 3, { error: "query too short" })
    .refine((v) => v.length <= 80, { error: "query too long" }),
});

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`places:${ip}`, 30, 60_000)) {
    return apiError(429, "Too many requests");
  }

  const parsed = parseQuery(req.nextUrl.searchParams, querySchema);
  if (!parsed.ok) return parsed.response;
  const { q } = parsed.data;

  const hit = await geocodePublicPlace(q);
  if (!hit?.bounds) return apiError(404, "not found");

  return NextResponse.json(
    {
      lat: hit.lat,
      lng: hit.lng,
      countryCode: hit.countryCode ?? null,
      displayName: hit.displayName ?? q,
      bounds: hit.bounds,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
