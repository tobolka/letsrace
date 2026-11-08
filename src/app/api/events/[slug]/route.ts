import { NextResponse } from "next/server";
import { PUBLIC_CATALOGUE_TAG, publicEventTag } from "@/lib/catalogue-cache";
import { getPublicEventBySlug } from "@/lib/events";

/**
 * One race with everything its own page knows — the timetable, fees,
 * categories, organiser — for the race card on the map, which opens from the
 * slimmer list rows. Read from the same cached loader as the race page and
 * held on the CDN, so opening a card costs no database read once someone has
 * opened it before.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const event = await getPublicEventBySlug(slug);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(event, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "CDN-Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
      "Vercel-CDN-Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
      "Vercel-Cache-Tag": `${PUBLIC_CATALOGUE_TAG},${publicEventTag(slug)}`,
    },
  });
}
