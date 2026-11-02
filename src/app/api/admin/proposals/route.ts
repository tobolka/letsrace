import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/guards";
import { apiError, serverError } from "@/lib/api/respond";
import { parseJson } from "@/lib/api/validate";
import { applyRaceCreate, applyRaceEdit, raceCreateSchema, raceEditSchema } from "@/lib/race-edit";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/tables";

const bodySchema = z.object({ id: z.string().uuid(), decision: z.enum(["approve", "reject"]) });

/** Applies or rejects a reader's proposal; the inbox entry records which. */
export const POST = withAdmin(async (req: NextRequest) => {
  const parsed = await parseJson(req, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { id, decision } = parsed.data;
  const supabase = createServerSupabase();
  const { data: note, error } = await supabase.from("admin_notifications").select("id, kind, payload").eq("id", id).maybeSingle();
  if (error) return serverError("reading proposal failed", error);
  if (!note || note.kind !== "race_proposal") return apiError(404, "Not found");
  const payload = (note.payload ?? {}) as Record<string, unknown>;
  if (payload.status !== "pending") return apiError(409, "Already decided");

  let result: Record<string, unknown> = {};
  try {
    if (decision === "approve") {
      if (payload.action === "edit") {
        const changes = raceEditSchema.parse(payload.changes);
        result = await applyRaceEdit(String(payload.eventId), changes);
      } else {
        result = { slug: await applyRaceCreate(raceCreateSchema.parse(payload.race)) };
      }
    }
  } catch (e) {
    return serverError("applying proposal failed", e);
  }

  await supabase
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString(), payload: { ...payload, status: decision === "approve" ? "applied" : "rejected", ...result } as Json })
    .eq("id", id);
  return NextResponse.json({ id, status: decision === "approve" ? "applied" : "rejected", ...result });
});
