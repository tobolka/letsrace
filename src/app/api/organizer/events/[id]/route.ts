import { NextRequest, NextResponse } from "next/server";
import { apiError, serverError } from "@/lib/api/respond";
import { parseJson } from "@/lib/api/validate";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSessionUser } from "@/lib/supabase/user-server";
import { clientIp, rateLimit } from "@/lib/security";
import { editingClaim } from "@/lib/organizer";
import { applyOrganizerEdit, organizerEditSchema } from "@/lib/organizer-edit";

type Ctx = { params: Promise<{ id: string }> };

/** The race as its organiser edits it: only for the holder of a verified claim. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await requireSessionUser();
  if (!user) return apiError(401, "Sign in first");
  if (!(await editingClaim(user.id, id))) return apiError(403, "Not your race");
  const { data, error } = await createServerSupabase()
    .from("events")
    .select("id, name, slug, start_date, end_date, status, website_url, registration_url, regulations_url, registration_closes_at, description, categories:event_categories(name, distance_km, age_min, age_max)")
    .eq("id", id)
    .single();
  if (error || !data) return serverError("reading race for organiser failed", error);
  return NextResponse.json({
    id: data.id,
    name: data.name,
    slug: data.slug,
    startDate: data.start_date,
    endDate: data.end_date,
    status: data.status,
    websiteUrl: data.website_url,
    registrationUrl: data.registration_url,
    regulationsUrl: data.regulations_url,
    registrationClosesAt: data.registration_closes_at?.slice(0, 10) ?? null,
    description: data.description,
    categories: ((data.categories ?? []) as { name: string; distance_km: number | null; age_min: number | null; age_max: number | null }[]).map((c) => ({
      name: c.name,
      distanceKm: c.distance_km,
      ageMin: c.age_min,
      ageMax: c.age_max,
    })),
  });
}

/** Saves an organiser's change to their race. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!rateLimit(`organizer-edit:${clientIp(req)}`, 30, 60_000)) return apiError(429, "Too many requests");
  const { id } = await params;
  const user = await requireSessionUser();
  if (!user) return apiError(401, "Sign in first");
  const claim = await editingClaim(user.id, id);
  if (!claim) return apiError(403, "Not your race");
  const parsed = await parseJson(req, organizerEditSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json(await applyOrganizerEdit({ eventId: id, claimId: claim.id, userId: user.id, edit: parsed.data }));
  } catch (e) {
    return serverError("saving organiser edit failed", e);
  }
}
