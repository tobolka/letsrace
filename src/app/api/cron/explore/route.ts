import { NextResponse } from "next/server";
import { withCron } from "@/lib/api/guards";
import { runExplore } from "@/lib/watcher/explore";

export const maxDuration = 120;

export const GET = withCron(async () => {
  const result = await runExplore({ budgetMs: 90_000, maxFetch: 20 });
  return NextResponse.json({ ok: true, ...result });
});

export const POST = GET;
