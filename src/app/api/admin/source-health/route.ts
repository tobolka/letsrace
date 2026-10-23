import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/guards";
import { apiError } from "@/lib/api/respond";
import { parseJson } from "@/lib/api/validate";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSourceHealth, verifyStalledSources, losingRaces } from "@/lib/admin/source-health";

export const maxDuration = 300;

/** Ask each suspect source what it actually returns right now. */
export const GET = withAdmin(async () => {
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
});

/**
 * Re-read one source now.
 *
 * Clears the stored content hash first: a stalled source often still serves
 * byte-identical HTML, and the unchanged-check would skip it for another week.
 */
const rereadSchema = z.object({ id: z.string().min(1, { error: "id required" }).max(64) });

export const POST = withAdmin(async (req: NextRequest) => {
  const parsed = await parseJson(req, rereadSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = parsed.data;

  const supabase = createServerSupabase();
  const { data: row } = await supabase
    .from("watched_urls")
    .select("id,url,kind")
    .eq("id", id)
    .maybeSingle();
  if (!row) return apiError(404, "not found");

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
});
