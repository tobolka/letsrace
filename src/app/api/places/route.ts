import { NextRequest, NextResponse } from "next/server";
import { geocodePublicPlace } from "@/lib/geocode";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 3) {
    return NextResponse.json({ error: "query too short" }, { status: 400 });
  }
  if (q.length > 80) {
    return NextResponse.json({ error: "query too long" }, { status: 400 });
  }

  const hit = await geocodePublicPlace(q);
  if (!hit?.bounds) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

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
