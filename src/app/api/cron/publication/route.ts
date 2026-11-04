import { completePlanChanges } from "@/lib/pipeline/plan-changes";
import { NextResponse } from "next/server";
import { withCron } from "@/lib/api/guards";
import { publishCatalogueBatch } from "@/lib/pipeline/catalogue-publication";
import { checkPublicRaceRevisions } from "@/lib/pipeline/race-publication-check";
import { requestPublicRefreshes } from "@/lib/pipeline/public-refresh-requests";

export const maxDuration = 60;
export const GET = withCron(async () => {
  const deadline = Date.now() + 50_000;
  const [planChanges, catalogue, delivery] = await Promise.all([
    completePlanChanges(),
    publishCatalogueBatch(),
    (async () => {
      const requests = await requestPublicRefreshes();
      const raceChecks = await checkPublicRaceRevisions({ maxChecks: 4, deadline, timeoutMs: 8000 });
      return { requests, raceChecks };
    })(),
  ]);
  return NextResponse.json({ planChanges, catalogue, ...delivery }, { headers: { "Cache-Control": "private, no-store" } });
});
export const POST = GET;
