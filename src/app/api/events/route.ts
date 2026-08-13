import { NextRequest, NextResponse } from "next/server";
import { listEvents } from "@/lib/events";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const audience = sp.getAll("audience").filter(Boolean);
  const disciplines = sp.getAll("disciplines").filter(Boolean);
  const levels = sp.getAll("levels").filter(Boolean);
  let polygon: [number, number][] | undefined;
  const polygonRaw = sp.get("polygon");
  if (polygonRaw) {
    try {
      polygon = JSON.parse(polygonRaw) as [number, number][];
    } catch {
      polygon = undefined;
    }
  }
  const events = await listEvents({
    q: sp.get("q") || undefined,
    audience: audience.length ? audience : undefined,
    disciplines: disciplines.length ? disciplines : undefined,
    levels: levels.length ? levels : undefined,
    seriesSlug: sp.get("series") || undefined,
    dateFrom: sp.get("dateFrom") || undefined,
    dateTo: sp.get("dateTo") || undefined,
    west: sp.get("west") ? Number(sp.get("west")) : undefined,
    south: sp.get("south") ? Number(sp.get("south")) : undefined,
    east: sp.get("east") ? Number(sp.get("east")) : undefined,
    north: sp.get("north") ? Number(sp.get("north")) : undefined,
    polygon,
  });
  return NextResponse.json(events);
}
