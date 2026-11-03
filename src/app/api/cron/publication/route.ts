import { completePlanChanges } from "@/lib/pipeline/plan-changes";
import { NextResponse } from "next/server";
import { withCron } from "@/lib/api/guards";
import { publishCatalogueBatch } from "@/lib/pipeline/catalogue-publication";

import { requestPublicRefreshes } from "@/lib/pipeline/public-refresh-requests";

export const maxDuration = 60;
export const GET = withCron(async () => NextResponse.json({ planChanges: await completePlanChanges(), requests: await requestPublicRefreshes(), catalogue: await publishCatalogueBatch() }, { headers: { "Cache-Control": "private, no-store" } }));
export const POST = GET;
