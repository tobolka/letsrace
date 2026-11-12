import { NextResponse } from "next/server";
import { withCron } from "@/lib/api/guards";
import { requestPublicRefreshes } from "@/lib/pipeline/public-refresh-requests";

export const POST = withCron(async () => {
  const result = await requestPublicRefreshes();
  return NextResponse.json(result, { status: result.status === "deferred" ? 503 : 200 });
}, "publication");
