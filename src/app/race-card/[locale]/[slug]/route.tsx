import { renderRaceOgImage } from "@/lib/og/race-opengraph-image";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; slug: string }> },
) {
  const { locale, slug } = await params;
  // The card only changes when the race's name, date or place does; a day at
  // the edge is plenty, and social crawlers refetch rarely anyway.
  return renderRaceOgImage(locale, slug, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
