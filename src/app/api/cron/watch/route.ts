import { NextRequest, NextResponse } from "next/server";
import { runDueWatches } from "@/lib/watcher/run";
import { geocodePendingLocations } from "@/lib/geocode";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const outcomes = await runDueWatches(12, { concurrency: 3, budgetMs: 50_000 });
  let geocode = null;
  try {
    geocode = await geocodePendingLocations(40);
  } catch (e) {
    console.error("geocode after watch failed", e);
  }
  return NextResponse.json({ ok: true, count: outcomes.length, outcomes, geocode });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
