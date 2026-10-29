import { NextResponse } from "next/server";
import { withCron } from "@/lib/api/guards";
import { runCatalogHygiene, type CatalogHygieneResult } from "@/lib/catalog/hygiene";
import { refreshPublicCatalogue } from "@/lib/refresh-public-catalogue";

export const maxDuration = 180;

/** True when hygiene changed public rows enough to bother the CDN caches. */
function hygieneTouched(result: CatalogHygieneResult): boolean {
  return (
    result.ages.eventsFilled + result.ages.seriesFilled > 0 ||
    result.fciAges.filled > 0 ||
    result.timingAges.filled > 0 ||
    result.regulationAges.filled > 0 ||
    result.previousEditions.ages + result.previousEditions.disciplines + result.previousEditions.websites > 0 ||
    result.fciWebsites.filled > 0 ||
    result.rideAndRestLinks.filled > 0 ||
    result.austria.places + result.austria.ages + result.austria.websites > 0 ||
    result.seriesAges.rounds > 0 ||
    result.registrationLinks.filled > 0 ||
    result.seriesDisciplines.filled > 0 ||
    result.duplicates.merged > 0 ||
    result.locations.merged > 0 ||
    result.completed.completed > 0
  );
}

export const GET = withCron(async () => {
  const result = await runCatalogHygiene({ maxAgeFills: 400, maxMerges: 40 });
  const refreshed = hygieneTouched(result);
  if (refreshed) refreshPublicCatalogue();
  return NextResponse.json({ ok: true, refreshed, ...result });
});

export const POST = GET;
