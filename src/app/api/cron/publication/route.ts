import { completePlanChanges } from "@/lib/pipeline/plan-changes";
import { NextResponse } from "next/server";
import { withCron } from "@/lib/api/guards";
import { publishCatalogueBatch } from "@/lib/pipeline/catalogue-publication";
import { checkPublicRaceRevisions } from "@/lib/pipeline/race-publication-check";
import { checkPublicSeriesRevisions } from "@/lib/pipeline/series-publication-check";
import { requestPublicRefreshes } from "@/lib/pipeline/public-refresh-requests";
import { withDatabaseDeadline } from "@/lib/supabase/request-budget";

export const maxDuration = 240;

export const GET = withCron(async () => {
  const deadline = Date.now() + 215_000;
  // Each lane claims one revision at a time. The database shares one budget
  // across these lanes, manual requests and the Mac.
  const limits = { maxChecks: 60, deadline, timeoutMs: 8000 };
  const delivery = async () => {
    const requests = await requestPublicRefreshes();
    const [seriesChecks, ...races] = await Promise.allSettled([
      checkPublicSeriesRevisions(limits),
      ...Array.from({ length: 3 }, () => checkPublicRaceRevisions(limits)),
    ] as const);
    if (seriesChecks.status === "rejected") throw seriesChecks.reason;
    const raceChecks = { processed: 0, publicRevisionsVerified: 0, deferredInBatch: 0, eventWrites: 0 };
    for (const lane of races) {
      if (lane.status === "rejected") throw lane.reason;
      raceChecks.processed += lane.value.processed;
      raceChecks.publicRevisionsVerified += lane.value.publicRevisionsVerified;
      raceChecks.deferredInBatch += lane.value.deferredInBatch;
    }
    return { requests, raceChecks, seriesChecks: seriesChecks.value };
  };

  return withDatabaseDeadline(deadline + 10_000, async () => {
    const [planChanges, catalogue, delivered] = await Promise.allSettled([
      completePlanChanges(),
      publishCatalogueBatch(),
      delivery(),
    ]);
    if (planChanges.status === "rejected") throw planChanges.reason;
    if (catalogue.status === "rejected") throw catalogue.reason;
    if (delivered.status === "rejected") throw delivered.reason;
    return NextResponse.json({ planChanges: planChanges.value, catalogue: catalogue.value, ...delivered.value }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  });
}, "publication");
export const POST = GET;
