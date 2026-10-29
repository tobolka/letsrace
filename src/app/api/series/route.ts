import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseQuery } from "@/lib/api/validate";
import { all, dayParam } from "@/lib/api/schemas";
import { listSeries } from "@/lib/events";

const querySchema = z.object({
  dateFrom: dayParam("dateFrom"),
  dateTo: dayParam("dateTo"),
  disciplines: all,
  levels: all,
  categories: all,
});

export async function GET(req: NextRequest) {
  const parsed = parseQuery(req.nextUrl.searchParams, querySchema);
  if (!parsed.ok) return parsed.response;
  const query = parsed.data;
  const series = await listSeries({
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    disciplines: query.disciplines.length ? query.disciplines : undefined,
    levels: query.levels.length ? query.levels : undefined,
    ageCategories: query.categories.length ? query.categories : undefined,
  });
  return NextResponse.json(series, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
      "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      "Vercel-CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
