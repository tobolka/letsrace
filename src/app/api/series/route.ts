import { NextRequest, NextResponse } from "next/server";
import { listSeries } from "@/lib/events";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const disciplines = sp.getAll("disciplines").filter(Boolean);
  const levels = sp.getAll("levels").filter(Boolean);
  const ageCategories = sp.getAll("categories").filter(Boolean);
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
