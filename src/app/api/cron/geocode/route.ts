import { NextRequest, NextResponse } from "next/server";
import { geocodePendingLocations } from "@/lib/geocode";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Number(req.nextUrl.searchParams.get("limit") || 50);
  const gazetteerOnly = req.nextUrl.searchParams.get("mode") === "gazetteer";
  const result = await geocodePendingLocations(Math.min(limit, 100), { gazetteerOnly });
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
