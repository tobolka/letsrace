import { NextRequest, NextResponse } from "next/server";
import { runRaceAlerts } from "@/lib/race-alerts-run";
import { runPlanChangeMails } from "@/lib/plan-mail-run";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [nearby, plan] = await Promise.all([runRaceAlerts(), runPlanChangeMails()]);
  return NextResponse.json({ ok: true, nearby, plan });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
