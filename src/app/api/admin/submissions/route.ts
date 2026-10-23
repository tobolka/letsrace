import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/guards";
import { serverError } from "@/lib/api/respond";
import { parseJson } from "@/lib/api/validate";
import { createServerSupabase } from "@/lib/supabase/server";

const bodySchema = z.object({
  id: z.string().min(1).max(64),
  status: z.enum(["pending", "approved", "rejected"]),
});

export const PATCH = withAdmin(async (req: NextRequest) => {
  const parsed = await parseJson(req, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { id, status } = parsed.data;

  const supabase = createServerSupabase();
  const { data: sub, error } = await supabase
    .from("race_submissions")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return serverError("updating submission failed", error);

  if (status === "approved" && sub?.url) {
    await supabase.from("watched_urls").upsert(
      {
        url: sub.url,
        kind: "organizer",
        status: "active",
        added_by: "user_submission",
        notes: sub.note || "Approved from user submission",
        next_poll_at: new Date().toISOString(),
      },
      { onConflict: "url" },
    );
  }

  return NextResponse.json({ ok: true });
});
