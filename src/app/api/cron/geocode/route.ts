import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { geocodePendingLocations } from "@/lib/geocode";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!requireCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Number(req.nextUrl.searchParams.get("limit") || 80);
  const gazetteerOnly = req.nextUrl.searchParams.get("mode") === "gazetteer";
  const result = await geocodePendingLocations(Math.min(limit, 120), { gazetteerOnly });
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
