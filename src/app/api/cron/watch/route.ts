import { NextRequest, NextResponse } from "next/server";
import { runDueWatches } from "@/lib/watcher/run";
import { geocodePendingLocations } from "@/lib/geocode";
import { sendOpsAlert } from "@/lib/ops/alerts";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const outcomes = await runDueWatches(120, { concurrency: 5, budgetMs: 200_000 });
  let geocode = null;
  try {
    geocode = await geocodePendingLocations(80);
  } catch (e) {
    console.error("geocode after watch failed", e);
  }

  const fails = outcomes.filter((o) => o && "ok" in o && o.ok === false);
  const failRate = outcomes.length ? fails.length / outcomes.length : 0;
  if (fails.length >= 3 || failRate >= 0.35) {
    await sendOpsAlert({
      title: "Let's Race ingest: elevated failures",
      body: `${fails.length}/${outcomes.length} watches failed in this cron run.`,
      meta: {
        failRate: Number(failRate.toFixed(2)),
        geocoded: geocode && typeof geocode === "object" && "updated" in geocode
          ? Number((geocode as { updated?: number }).updated ?? 0)
          : null,
      },
    });
  }

  return NextResponse.json({ ok: true, count: outcomes.length, outcomes, geocode });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
