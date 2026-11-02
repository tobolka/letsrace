import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, serverError } from "@/lib/api/respond";
import { parseJson } from "@/lib/api/validate";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSessionUser } from "@/lib/supabase/user-server";
import { clientIp, rateLimit } from "@/lib/security";

const bodySchema = z.object({
  kind: z.enum(["race", "series"]),
  slug: z.string().trim().min(1).max(200),
  message: z.string().trim().min(3).max(3000),
});

/** A reader's correction to a race or series, for the admin to check and apply. */
export async function POST(req: NextRequest) {
  if (!rateLimit(`correction:${clientIp(req)}`, 10, 60_000)) return apiError(429, "Too many requests");
  const parsed = await parseJson(req, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { kind, slug, message } = parsed.data;

  const user = await requireSessionUser();
  if (!user) return apiError(401, "Sign in first");

  const supabase = createServerSupabase();
  const { data: target } = await (kind === "race"
    ? supabase.from("events").select("id, name").eq("slug", slug).maybeSingle()
    : supabase.from("series").select("id, name").eq("slug", slug).maybeSingle());
  if (!target) return apiError(404, "Not found");

  const { error } = await supabase.from("admin_notifications").insert({
    kind: "correction",
    title: `Correction for ${kind === "series" ? "series" : "race"}: ${target.name}`,
    body: `${message}\n\n— ${user.email ?? user.id}`,
    payload: { kind, slug, id: target.id, userId: user.id, email: user.email ?? null },
  });
  if (error) return serverError("saving correction failed", error);
  return NextResponse.json({ ok: true });
}
