import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/respond";
import { first } from "@/lib/api/schemas";
import { parseQuery } from "@/lib/api/validate";
import { isAdminEmail } from "@/lib/auth/admin";
import { editingClaim, organizerDb } from "@/lib/organizer";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSessionUser } from "@/lib/supabase/user-server";

const querySchema = z.object({
  kind: first.pipe(z.enum(["race", "series"])),
  slug: first.pipe(z.string().min(1).max(200)),
});

/**
 * What the signed-in reader may do with a race or series: edit it as the
 * admin, edit it as its verified organiser, wait for a claim, or neither.
 * The "Edit details" dialog asks this before it offers anything.
 */
export async function GET(req: NextRequest) {
  const user = await requireSessionUser();
  if (!user) return apiError(401, "Sign in first");
  const parsed = parseQuery(req.nextUrl.searchParams, querySchema);
  if (!parsed.ok) return parsed.response;
  const { kind, slug } = parsed.data;

  const supabase = createServerSupabase();
  const { data: target } = await (kind === "race"
    ? supabase.from("events").select("id").eq("slug", slug).maybeSingle()
    : supabase.from("series").select("id").eq("slug", slug).maybeSingle());
  if (!target) return apiError(404, "Not found");

  const proved = Boolean(user.email_confirmed_at) || user.app_metadata?.provider === "google";
  const admin = await isAdminEmail(proved ? (user.email ?? "").toLowerCase() : null);

  const column = kind === "race" ? "event_id" : "series_id";
  const { data: own } = await organizerDb()
    .from("organizer_claims")
    .select("status")
    .eq("user_id", user.id)
    .eq(column, target.id)
    .maybeSingle();
  const verified = kind === "race" ? Boolean(await editingClaim(user.id, target.id)) : own?.status === "verified";

  return NextResponse.json(
    { id: target.id, admin, verified, pending: own?.status === "pending" },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
