import { z } from "zod";
import { httpUrl, isoDay } from "@/lib/api/schemas";
import { createServerSupabase } from "@/lib/supabase/server";
import { organizerDb } from "@/lib/organizer";
import { refreshOrganizerPages } from "@/lib/organizer-publish";
import type { Json, Update } from "@/lib/supabase/tables";

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
        }),
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
  const supabase = createServerSupabase();
  const { data: before, error: readError } = await supabase
    .from("events")
    .select("slug, start_date, end_date, status, website_url, registration_url, regulations_url, registration_closes_at, description, categories:event_categories(name, distance_km, age_min, age_max)")
    .eq("id", eventId)
    .single();
  if (readError || !before) throw new Error(readError?.message ?? "race not found");
  const prev = before as unknown as Record<string, unknown>;

  const payload: Record<string, unknown> = {};
  const history: { field: string; previous: unknown; value: unknown }[] = [];
  for (const [key, column] of Object.entries(COLUMN) as [keyof typeof COLUMN, string][]) {
    if (edit[key] === undefined) continue;
    const value = edit[key] === "" ? null : edit[key];
    if (JSON.stringify(prev[column] ?? null) === JSON.stringify(value ?? null)) continue;
    payload[column] = value;
    history.push({ field: column, previous: prev[column] ?? null, value });
  }

  const locked: string[] = Object.keys(payload);
  if (payload.status) {
    // A cancelled race stays on the site and says so; nothing else changes its visibility.
    locked.push("status");
  }
  if (Object.keys(payload).length) {
    const { error } = await supabase
      .from("events")
      .update({ ...payload, updated_at: new Date().toISOString() } as Update<"events">)
      .eq("id", eventId);
    if (error) throw new Error(error.message);
  }

  if (edit.categories) {
    const rows = edit.categories.map((c) => ({
      name: c.name,
      distance_km: c.distanceKm ?? null,
      age_min: c.ageMin ?? null,
      age_max: c.ageMax ?? null,
    }));
    const previous = (prev.categories as Record<string, unknown>[] | null) ?? [];
    if (JSON.stringify(previous) !== JSON.stringify(rows)) {
      const { error: deleteError } = await supabase.from("event_categories").delete().eq("event_id", eventId);
      if (deleteError) throw new Error(deleteError.message);
      if (rows.length) {
        const { error: insertError } = await supabase
          .from("event_categories")
          .insert(rows.map((r) => ({ ...r, event_id: eventId })));
        if (insertError) throw new Error(insertError.message);
      }
      locked.push("categories");
      history.push({ field: "categories", previous, value: rows });
    }
  }

  if (!history.length) return { changed: 0 };

  const { data: existing } = await supabase
    .from("event_overrides")
    .select("locked_fields, fields")
    .eq("event_id", eventId)
    .maybeSingle();
  const prevFields = existing?.fields && typeof existing.fields === "object" ? (existing.fields as Record<string, unknown>) : {};
  await supabase.from("event_overrides").upsert(
    {
      event_id: eventId,
      fields: { ...prevFields, ...payload } as Json,
      locked_fields: [...new Set([...((existing?.locked_fields as string[] | null) ?? []), ...locked])],
      updated_by: "organizer",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id" },
  );

  await organizerDb()
    .from("organizer_edits")
    .insert(history.map((h) => ({ claim_id: claimId, user_id: userId, event_id: eventId, field: h.field, previous: h.previous, value: h.value })));

  await refreshOrganizerPages([String(prev.slug)]);
  return { changed: history.length };
}
