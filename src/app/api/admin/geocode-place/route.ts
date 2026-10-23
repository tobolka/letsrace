import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/guards";
import { apiError } from "@/lib/api/respond";
import { parseJson } from "@/lib/api/validate";
import { geocodePlace } from "@/lib/geocode";

const bodySchema = z.object({
  query: z.string().trim().min(1, { error: "query required" }).max(200),
  countryCode: z.string().trim().max(2).optional(),
});

export const POST = withAdmin(async (req: NextRequest) => {
  const parsed = await parseJson(req, bodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const geo = await geocodePlace(parsed.data.query, parsed.data.countryCode || "CZ");
    if (!geo) return apiError(404, "No match for this place");
    return NextResponse.json({
      lat: geo.lat,
      lng: geo.lng,
      countryCode: geo.countryCode,
      displayName: geo.displayName,
    });
  } catch (e) {
    return apiError(500, e instanceof Error ? e.message : "Failed");
  }
});
