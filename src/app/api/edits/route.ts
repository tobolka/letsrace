import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, serverError } from "@/lib/api/respond";
import { first } from "@/lib/api/schemas";
import { parseJson, parseQuery } from "@/lib/api/validate";
import { isAdminEmail } from "@/lib/auth/admin";
import { editingClaim } from "@/lib/organizer";
import { applyOrganizerEdit } from "@/lib/organizer-edit";
import { applyRaceCreate, applyRaceEdit, possibleDuplicates, raceCreateSchema, raceEditSchema } from "@/lib/race-edit";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSessionUser } from "@/lib/supabase/user-server";
import { clientIp, rateLimit } from "@/lib/security";
import type { User } from "@supabase/supabase-js";
import type { Json } from "@/lib/supabase/tables";

const EDIT_COLUMNS =
  "id, name, slug, start_date, end_date, status, website_url, registration_url, regulations_url, registration_closes_at, description, categories:event_categories(name, distance_km, age_min, age_max)";

async function adminUser(user: User) {
  const proved = Boolean(user.email_confirmed_at) || user.app_metadata?.provider === "google";
  return isAdminEmail(proved ? (user.email ?? "").toLowerCase() : null);
}

/** The race as the form shows it, and what saving it will do for this reader. */
export async function GET(req: NextRequest) {
  const user = await requireSessionUser();
  if (!user) return apiError(401, "Sign in first");
  const parsed = parseQuery(req.nextUrl.searchParams, z.object({ slug: first.pipe(z.string().min(1).max(200)) }));
  if (!parsed.ok) return parsed.response;
  const { data, error } = await createServerSupabase().from("events").select(EDIT_COLUMNS).eq("slug", parsed.data.slug).eq("visibility", "public").maybeSingle();
  if (error) return serverError("reading race for edit failed", error);
  if (!data) return apiError(404, "Not found");
  const admin = await adminUser(user);
  const organizer = !admin && Boolean(await editingClaim(user.id, data.id));
  return NextResponse.json(
    {
      race: {
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
      },
      // "direct": the change is on the site at once; "proposal": it waits for the admin.
      mode: admin || organizer ? "direct" : "proposal",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), slug: z.string().trim().min(1).max(200), changes: raceEditSchema }),
  z.object({ action: z.literal("create"), race: raceCreateSchema, notDuplicate: z.boolean().optional() }),
]);

/** Saves the form: at once for the admin and a verified organiser, as a proposal for anyone else. */
export async function POST(req: NextRequest) {
  if (!rateLimit(`edits:${clientIp(req)}`, 20, 60_000)) return apiError(429, "Too many requests");
  const user = await requireSessionUser();
  if (!user) return apiError(401, "Sign in first");
  const parsed = await parseJson(req, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const admin = await adminUser(user);
  const supabase = createServerSupabase();

  try {
    if (body.action === "edit") {
      const { data: race } = await supabase.from("events").select("id, name, slug").eq("slug", body.slug).eq("visibility", "public").maybeSingle();
      if (!race) return apiError(404, "Not found");
      if (admin) return NextResponse.json({ status: "applied", ...(await applyRaceEdit(race.id, body.changes)) });
      const claim = await editingClaim(user.id, race.id);
      if (claim) {
        return NextResponse.json({ status: "applied", ...(await applyOrganizerEdit({ eventId: race.id, claimId: claim.id, userId: user.id, edit: body.changes })) });
      }
      await propose(user, { action: "edit", eventId: race.id, slug: race.slug, changes: body.changes }, `Edit proposed: ${race.name}`);
      return NextResponse.json({ status: "proposed" });
    }

    if (!body.notDuplicate) {
      const duplicates = await possibleDuplicates(body.race);
      if (duplicates.length) return NextResponse.json({ status: "duplicates", duplicates });
    }
    if (admin) return NextResponse.json({ status: "applied", slug: await applyRaceCreate(body.race) });
    await propose(user, { action: "create", race: body.race }, `New race proposed: ${body.race.name}`);
    return NextResponse.json({ status: "proposed" });
  } catch (e) {
    return serverError("saving race form failed", e);
  }
}

/** A proposal waits in the admin inbox with everything needed to apply it. */
async function propose(user: User, payload: Record<string, unknown>, title: string) {
  const { error } = await createServerSupabase().from("admin_notifications").insert({
    kind: "race_proposal",
    title,
    body: user.email ?? user.id,
    payload: { ...payload, status: "pending", userId: user.id, email: user.email ?? null } as Json,
  });
  if (error) throw new Error(error.message);
}
