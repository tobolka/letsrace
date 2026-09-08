import { NextRequest, NextResponse } from "next/server";
import { isIsoDay, listSeries } from "@/lib/events";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const disciplines = sp.getAll("disciplines").filter(Boolean);
  const levels = sp.getAll("levels").filter(Boolean);
  const ageCategories = sp.getAll("categories").filter(Boolean);
  // Same answer as /api/events gives: an unreadable date is a client error.
  for (const key of ["dateFrom", "dateTo"] as const) {
    const raw = sp.get(key);
    if (raw && !isIsoDay(raw)) {
      return NextResponse.json({ error: `${key} must be YYYY-MM-DD` }, { status: 400 });
    }
  }
  const series = await listSeries({
    dateFrom: sp.get("dateFrom") || undefined,
    dateTo: sp.get("dateTo") || undefined,
    disciplines: disciplines.length ? disciplines : undefined,
    levels: levels.length ? levels : undefined,
    ageCategories: ageCategories.length ? ageCategories : undefined,
  });
  return NextResponse.json(series, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
    },
  });
}
