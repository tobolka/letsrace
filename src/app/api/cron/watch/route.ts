import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { runDueWatches } from "@/lib/watcher/run";
import { geocodePendingLocations } from "@/lib/geocode";
import { sendOpsAlert } from "@/lib/ops/alerts";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!requireCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  /*
   * A run gets through what it gets through, and it was not much.
   *
   * Measured over three days: 27 to 50 sources per run, at 22 to 42 seconds
   * each. Five at a time inside a 200-second budget works out to about
   * thirty-five — so three runs a day covered a hundred of the four hundred
   * active sources, and a full cycle took the better part of four days. The
   * tail of that is a race whose listing was last read four weeks ago.
   *
   * The time is nearly all network wait, so widening the pool costs little and
   * the busiest hosts are already held to two sources a run. `maxDuration` is
   * 300s, which is what the budget leaves room under.
   */
  const outcomes = await runDueWatches(120, { concurrency: 10, budgetMs: 260_000 });
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
