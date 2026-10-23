import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/guards";
import { serverError } from "@/lib/api/respond";
import { parseJson } from "@/lib/api/validate";
import { createServerSupabase } from "@/lib/supabase/server";

const bodySchema = z.object({
  id: z.string().min(1).max(64),
  status: z.enum(["pending", "done", "dismissed"]),
});

export const PATCH = withAdmin(async (req: NextRequest) => {
  const parsed = await parseJson(req, bodySchema);
  if (!parsed.ok) return parsed.response;

  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("feedback_requests")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);
  if (error) return serverError("updating feedback failed", error);

  return NextResponse.json({ ok: true });
});
