import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSourceHealth, verifyStalledSources, losingRaces } from "@/lib/admin/source-health";

export const maxDuration = 300;

/** Ask each suspect source what it actually returns right now. */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const report = await getSourceHealth();
  const verified = await verifyStalledSources(report.stalled, { limit: 60 });
  return NextResponse.json({
    ok: true,
    checkedAt: report.checkedAt,
    verified: verified.map((s) => ({
      id: s.id,
      url: s.url,
      reason: s.reason,
      recordedState: s.recordedState,
      daysSinceFetch: s.daysSinceFetch,
      liveRaces: s.liveRaces ?? 0,
    })),
    losing: losingRaces(verified).length,
  });
}

/**
 * Re-read one source now.
 *
 * Clears the stored content hash first: a stalled source often still serves
 * byte-identical HTML, and the unchanged-check would skip it for another week.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = createServerSupabase();
  const { data: row } = await supabase
    .from("watched_urls")
    .select("id,url,kind")
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  await supabase
    .from("watched_urls")
    .update({ content_hash: null, etag: null, last_modified: null, status: "active" })
    .eq("id", id);

  const { watchOne } = await import("@/lib/watcher/run");
  const outcome = await watchOne({
    id: row.id as string,
    url: row.url as string,
    kind: row.kind as string,
    content_hash: null,
    etag: null,
    last_modified: null,
  } as Parameters<typeof watchOne>[0]);

  return NextResponse.json({
    ok: outcome.ok,
    upserted: outcome.eventsUpserted,
    strategy: outcome.strategy ?? null,
    error: outcome.error ?? null,
  });
}
