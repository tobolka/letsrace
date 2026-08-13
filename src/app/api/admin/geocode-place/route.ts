import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { geocodePlace } from "@/lib/geocode";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { query?: string; countryCode?: string };
    const query = body.query?.trim();
    if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

    const geo = await geocodePlace(query, body.countryCode || "CZ");
    if (!geo) {
      return NextResponse.json({ error: "No match for this place" }, { status: 404 });
    }
    return NextResponse.json({
      lat: geo.lat,
      lng: geo.lng,
      countryCode: geo.countryCode,
      displayName: geo.displayName,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
