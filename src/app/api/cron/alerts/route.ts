import { NextResponse } from "next/server";
import { withCron } from "@/lib/api/guards";
import { runRaceAlerts } from "@/lib/race-alerts-run";
import { runPlanChangeMails } from "@/lib/plan-mail-run";

export const maxDuration = 60;

export const GET = withCron(async () => {
  const [nearby, plan] = await Promise.all([runRaceAlerts(), runPlanChangeMails()]);
  return NextResponse.json({ ok: true, nearby, plan });
});

export const POST = GET;
