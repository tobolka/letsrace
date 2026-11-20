import { NextResponse } from "next/server";
import { withCron } from "@/lib/api/guards";
import { requestPublicRefreshes } from "@/lib/pipeline/public-refresh-requests";

const handler = withCron(async () => {
  const result = await requestPublicRefreshes();
  return NextResponse.json(result, { status: result.status === "deferred" ? 503 : 200 });
}, "publication");

// The Cloudflare cron trigger calls with GET; the GitHub workflow (blocked by bot protection) used POST.
export const GET = handler;
export const POST = handler;
