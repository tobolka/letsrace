import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, serverError } from "@/lib/api/respond";
import { httpUrl } from "@/lib/api/schemas";
import { parseJson } from "@/lib/api/validate";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSessionUser } from "@/lib/supabase/user-server";
import { clientIp, rateLimit } from "@/lib/security";

const bodySchema = z.object({
  url: httpUrl.min(1, { error: "url required" }),
  // Anything but "series" is a race, as it always was.
  kind: z
    .unknown()
    .optional()
    .transform((v) => (v === "series" ? ("series" as const) : ("race" as const))),
  note: z
    .unknown()
    .optional()
    .transform((v) => (typeof v === "string" ? v.slice(0, 2000) : null)),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`submissions:${ip}`, 10, 60_000)) {
    return apiError(429, "Too many requests");
  }

  const parsed = await parseJson(req, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { url, kind, note } = parsed.data;

  const user = await requireSessionUser();
  const supabase = createServerSupabase();
  const { data: sub, error } = await supabase
    .from("race_submissions")
    .insert({ url, kind, note, user_id: user?.id ?? null, status: "pending" })
    .select("id")
    .single();
  if (error) return serverError("submission insert failed", error);

  await supabase.from("admin_notifications").insert({
    kind: "race_submission",
    title: kind === "series" ? "New series URL submitted" : "New race URL submitted",
    body: url,
    payload: { submissionId: sub.id, kind, url, note, userId: user?.id ?? null },
  });

  return NextResponse.json({ ok: true, id: sub.id });
}
