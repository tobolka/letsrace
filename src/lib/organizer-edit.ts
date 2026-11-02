import { z } from "zod";
import { httpUrl, isoDay } from "@/lib/api/schemas";
import { createServerSupabase } from "@/lib/supabase/server";
import { refreshOrganizerPages } from "@/lib/organizer-publish";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/supabase/tables";

/** What an organiser may change on their race; anything left out stays as it is. */
export const organizerEditSchema = z
  .object({
    startDate: isoDay.optional(),
    endDate: isoDay.nullable().optional(),
    status: z.enum(["scheduled", "postponed", "cancelled"]).optional(),
    websiteUrl: httpUrl.nullable().optional(),
    registrationUrl: httpUrl.nullable().optional(),
    regulationsUrl: httpUrl.nullable().optional(),
    registrationClosesAt: isoDay.nullable().optional(),
    description: z.string().trim().max(3000).nullable().optional(),
    categories: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(120),
          distanceKm: z.number().positive().max(2000).nullable().optional(),
          ageMin: z.number().int().min(0).max(99).nullable().optional(),
          ageMax: z.number().int().min(0).max(99).nullable().optional(),
        }).refine((v) => v.ageMin == null || v.ageMax == null || v.ageMin <= v.ageMax, { error: "ageMin after ageMax" }),
      )
      .max(40)
      .optional(),
  })
  .refine((v) => !v.endDate || !v.startDate || v.endDate >= v.startDate, { error: "endDate before startDate", path: ["endDate"] });

export type OrganizerEdit = z.infer<typeof organizerEditSchema>;

const COLUMN: Record<Exclude<keyof OrganizerEdit, "categories">, string> = {
  startDate: "start_date",
  endDate: "end_date",
  status: "status",
  websiteUrl: "website_url",
  registrationUrl: "registration_url",
  regulationsUrl: "regulations_url",
  registrationClosesAt: "registration_closes_at",
  description: "description",
};

/**
 * Writes an organiser's change: the columns, a lock on each so the watcher
 * leaves them alone (the same lock an admin edit sets), a line per field in
 * the organiser's history, and a refresh of that race's pages only.
 */
export async function applyOrganizerEdit(opts: { eventId: string; claimId: string; userId: string; edit: OrganizerEdit }) {
  const { eventId, claimId, userId, edit } = opts;
  const payload = Object.fromEntries(
    Object.entries(COLUMN).filter(([key]) => edit[key as keyof OrganizerEdit] !== undefined)
      .map(([key, column]) => [column, edit[key as keyof OrganizerEdit]]),
  );
  const db = createServerSupabase() as unknown as SupabaseClient;
  const { data, error } = await db.rpc("organizer_apply_edit", {
    p_event_id: eventId, p_claim_id: claimId, p_user_id: userId,
    p_changes: payload as Json,
    p_categories: edit.categories === undefined ? null : edit.categories,
  });
  if (error) throw new Error(error.message);
  const result = data as { changed: number; slug: string; seriesSlug: string | null };
  // Publication is already queued in the same transaction. A refresh outage
  // must not tell the organiser their successfully committed edit was lost.
  if (result.changed) {
    await refreshOrganizerPages([result.slug], result.seriesSlug ? [result.seriesSlug] : [])
      .catch((error: unknown) => console.error("organizer page refresh deferred", error));
  }
  return { changed: result.changed };
}
