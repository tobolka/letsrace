import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { getSourceHealth, verifyStalledSources, losingRaces } from "@/lib/admin/source-health";
import { sendOpsAlert } from "@/lib/ops/alerts";

/**
 * Watch the watchers.
 *
 * A source that breaks goes quiet, and quiet is indistinguishable from a
 * finished season unless someone asks the site directly. Six were stalled at
 * once while the admin showed them all as active, and the catalogue was missing
 * 57% of the Czech calendar as a result. Nothing reported it because nothing
 * was looking.
 */
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!requireCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Number(req.nextUrl.searchParams.get("limit") || 60);

  const report = await getSourceHealth();
  const verified = await verifyStalledSources(report.stalled, { limit: Math.min(limit, 80) });
  const losing = losingRaces(verified);

  if (losing.length) {
    const total = losing.reduce((sum, s) => sum + (s.liveRaces ?? 0), 0);
    await sendOpsAlert({
      title: `${losing.length} stalled source${losing.length === 1 ? "" : "s"} still listing races`,
      body: losing
        .slice(0, 10)
        .map((s) => `• ${s.liveRaces} races — ${s.url} (recorded: ${s.recordedState ?? "none"})`)
        .join("\n"),
      meta: { sources: losing.length, races: total },
    });
  }

  return NextResponse.json({
    ok: true,
    activeCalendars: report.activeCalendars,
    stalled: report.stalled.length,
    verified: verified.length,
    losingRaces: losing.length,
    racesAtRisk: losing.reduce((sum, s) => sum + (s.liveRaces ?? 0), 0),
    sources: losing.slice(0, 20).map((s) => ({
      url: s.url,
      recordedState: s.recordedState,
      reason: s.reason,
      liveRaces: s.liveRaces,
      daysSinceFetch: s.daysSinceFetch,
    })),
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
