import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, serverError } from "@/lib/api/respond";
import { parseJson } from "@/lib/api/validate";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSessionUser } from "@/lib/supabase/user-server";
import { clientIp, rateLimit } from "@/lib/security";

const TITLES = {
  feature: "Feature request",
  feedback: "Feedback",
  bug: "Bug report",
} as const;

const bodySchema = z.object({
  message: z.string().trim().min(3, { error: "message required" }).max(4000, { error: "message too long" }),
  kind: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(["feature", "feedback", "bug"], { error: "invalid kind" }))
    .default("feedback"),
  email: z
    .string()
    .trim()
    .max(320, { error: "email too long" })
    .nullish()
    .transform((v) => v || null),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`feedback:${ip}`, 10, 60_000)) {
    return apiError(429, "Too many requests");
  }

  const parsed = await parseJson(req, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { message, kind, email } = parsed.data;

  const user = await requireSessionUser();
  const supabase = createServerSupabase();
  const { data: row, error } = await supabase
    .from("feedback_requests")
    .insert({
      kind,
      message,
      email: email || user?.email || null,
      user_id: user?.id ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return serverError("feedback insert failed", error);

  await supabase.from("admin_notifications").insert({
    kind: "feedback",
    title: TITLES[kind],
    body: message.slice(0, 280),
    payload: {
      feedbackId: row.id,
      kind,
      email: email || user?.email || null,
      userId: user?.id ?? null,
    },
  });

  return NextResponse.json({ ok: true, id: row.id });
}
