import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { runExplore } from "@/lib/watcher/explore";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!requireCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runExplore({ budgetMs: 90_000, maxFetch: 20 });
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
