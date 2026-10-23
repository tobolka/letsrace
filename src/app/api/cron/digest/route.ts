import { NextResponse } from "next/server";
import { withCron } from "@/lib/api/guards";
import { runWeeklyDigest } from "@/lib/plan-mail-run";

export const maxDuration = 60;

export const GET = withCron(async () => {
  const result = await runWeeklyDigest();
  return NextResponse.json({ ok: true, ...result });
});

export const POST = GET;
