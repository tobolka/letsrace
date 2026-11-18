import { NextRequest, NextResponse } from "next/server";
import { apiError, serverError } from "@/lib/api/respond";
import { clientIp, rateLimit } from "@/lib/security";
import { createServerSupabase, hasServiceRole } from "@/lib/supabase/server";
import { requireSessionUser } from "@/lib/supabase/user-server";

/**
 * Deletes the signed-in person's account for good.
 *
 * The profile row goes first: riders, the plan, favourites, alerts and mail
 * deliveries hang off it and go with it, and races they sent in stay but lose
 * the link to them. Feedback they wrote stays too, without their name or
 * address. Then the sign-in itself goes, which takes blocked days and any
 * organiser claims and edits with it.
 */
export async function DELETE(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`account-delete:${ip}`, 5, 60_000)) {
    return apiError(429, "Too many requests");
  }

  const user = await requireSessionUser();
  if (!user) return apiError(401, "Sign in first");
  if (!hasServiceRole()) return serverError("account delete", "service role key missing");

  const db = createServerSupabase();

  const feedback = await db
    .from("feedback_requests")
    .update({ user_id: null, email: null })
    .eq("user_id", user.id);
  if (feedback.error) return serverError("account delete: feedback", feedback.error);

  const profile = await db.from("profiles").delete().eq("id", user.id);
  if (profile.error) return serverError("account delete: profile", profile.error);

  const auth = await db.auth.admin.deleteUser(user.id);
  if (auth.error) return serverError("account delete: auth user", auth.error);

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
