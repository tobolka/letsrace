import { NextResponse } from "next/server";
import { withCron } from "@/lib/api/guards";
import { warmWeatherHistory } from "@/lib/weather-history";
import { pipelineJob } from "@/lib/pipeline/operations";

export const maxDuration = 60;
export const GET = withCron(async () => NextResponse.json(await pipelineJob("weather-history", async () => {
  const result = await warmWeatherHistory(new Date().toISOString().slice(0, 10));
  return { ...result, status: result.failed ? "attention" : result.pendingPeriods ? "deferred" : "ok" };
})));
export const POST = GET;
