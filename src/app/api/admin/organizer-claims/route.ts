import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/guards";
import { serverError } from "@/lib/api/respond";
import { parseJson } from "@/lib/api/validate";
import { createServerSupabase } from "@/lib/supabase/server";
import { organizerDb, syncBadge } from "@/lib/organizer";
import { refreshOrganizerPages } from "@/lib/organizer-publish";

const bodySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["verified", "rejected", "revoked"]),
});

/** Approves, rejects or withdraws an organiser's claim; the badge follows. */
export const PATCH = withAdmin(async (req: NextRequest) => {
  const parsed = await parseJson(req, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { id, status } = parsed.data;

  const { data: claim, error } = await organizerDb()
    .from("organizer_claims")
    .update({ status, method: status === "verified" ? "manual" : undefined, decided_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !claim) return serverError("deciding organiser claim failed", error);

  await syncBadge({ eventId: claim.event_id, seriesId: claim.series_id });
  const supabase = createServerSupabase();
  const { data: target } = claim.event_id
    ? await supabase.from("events").select("slug").eq("id", claim.event_id).maybeSingle()
    : await supabase.from("series").select("slug").eq("id", claim.series_id!).maybeSingle();
  if (target?.slug) {
    await refreshOrganizerPages(claim.event_id ? [target.slug] : [], claim.series_id ? [target.slug] : []);
  }
  return NextResponse.json({ id, status });
});
