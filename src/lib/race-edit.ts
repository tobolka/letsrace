import { z } from "zod";
import { httpUrl, isoDay } from "@/lib/api/schemas";
import { createServerSupabase } from "@/lib/supabase/server";
import { organizerEditSchema } from "@/lib/organizer-edit";
import { refreshOrganizerPages } from "@/lib/organizer-publish";
import { upsertManualEvent } from "@/lib/events";
import { DISCIPLINES, type Discipline } from "@/lib/taxonomy";
import type { Json, Update } from "@/lib/supabase/tables";

/**
 * One form for a race: editing an existing one and creating a new one share
 * the same fields. Who sends it decides what happens to it — the admin and a
 * verified organiser change the race at once, anyone else sends a proposal
 * that waits in the admin inbox.
 */

const category = z
  .object({
    name: z.string().trim().min(1).max(120),
    distanceKm: z.number().positive().max(2000).nullable().optional(),
    ageMin: z.number().int().min(0).max(99).nullable().optional(),
    ageMax: z.number().int().min(0).max(99).nullable().optional(),
  })
  .refine((v) => v.ageMin == null || v.ageMax == null || v.ageMin <= v.ageMax, { error: "ageMin after ageMax" });

export const raceEditSchema = organizerEditSchema;
export type RaceEdit = z.infer<typeof raceEditSchema>;

export const raceCreateSchema = z
  .object({
    name: z.string().trim().min(3).max(200),
    startDate: isoDay,
    endDate: isoDay.nullable().optional(),
    disciplines: z.array(z.enum(DISCIPLINES)).min(1).max(6),
    place: z.object({
      name: z.string().trim().min(2).max(200),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      countryCode: z.string().trim().length(2).toUpperCase(),
    }),
    websiteUrl: httpUrl.nullable().optional(),
    registrationUrl: httpUrl.nullable().optional(),
    regulationsUrl: httpUrl.nullable().optional(),
    registrationClosesAt: isoDay.nullable().optional(),
    description: z.string().trim().max(3000).nullable().optional(),
    categories: z.array(category).max(40).optional(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { error: "endDate before startDate", path: ["endDate"] });
export type RaceCreate = z.infer<typeof raceCreateSchema>;

const COLUMN = {
  startDate: "start_date",
  endDate: "end_date",
  status: "status",
  websiteUrl: "website_url",
  registrationUrl: "registration_url",
  regulationsUrl: "regulations_url",
  registrationClosesAt: "registration_closes_at",
  description: "description",
} as const;

/**
 * The admin's write of an edit — also how an approved proposal lands: the
 * columns, the routes and categories (rows keep their ids by name), a lock
 * on every changed field so the watcher leaves it alone, and a refresh of
 * that race's pages only.
 */
export async function applyRaceEdit(eventId: string, edit: RaceEdit) {
  const supabase = createServerSupabase();
  const { data: before, error } = await supabase
    .from("events")
    .select("slug, start_date, end_date, status, website_url, registration_url, regulations_url, registration_closes_at, description, series:series!events_series_id_fkey(slug)")
    .eq("id", eventId)
    .single();
  if (error || !before) throw new Error(error?.message ?? "race not found");
  const prev = before as unknown as Record<string, unknown>;

  const payload: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(COLUMN) as [keyof typeof COLUMN, string][]) {
    if (edit[key] === undefined) continue;
    if (JSON.stringify(prev[column] ?? null) === JSON.stringify(edit[key] ?? null)) continue;
    payload[column] = edit[key] ?? null;
  }
  const locked = Object.keys(payload);
  if (locked.length) {
    const { error: updateError } = await supabase
      .from("events")
      .update({ ...payload, updated_at: new Date().toISOString() } as Update<"events">)
      .eq("id", eventId);
    if (updateError) throw new Error(updateError.message);
  }

  if (edit.categories) {
    const { data: held } = await supabase.from("event_categories").select("id, name").eq("event_id", eventId);
    const kept: string[] = [];
    for (const c of edit.categories) {
      const values = { name: c.name, distance_km: c.distanceKm ?? null, age_min: c.ageMin ?? null, age_max: c.ageMax ?? null };
      const match = (held ?? []).find((h) => h.name === c.name && !kept.includes(h.id));
      if (match) {
        const { error: e } = await supabase.from("event_categories").update(values).eq("id", match.id);
        if (e) throw new Error(e.message);
        kept.push(match.id);
      } else {
        const { data: row, error: e } = await supabase.from("event_categories").insert({ ...values, event_id: eventId }).select("id").single();
        if (e || !row) throw new Error(e?.message ?? "category insert failed");
        kept.push(row.id);
      }
    }
    const gone = (held ?? []).filter((h) => !kept.includes(h.id)).map((h) => h.id);
    if (gone.length) await supabase.from("event_categories").delete().in("id", gone);
    locked.push("categories");
  }

  if (locked.length) {
    const { data: existing } = await supabase.from("event_overrides").select("locked_fields, fields").eq("event_id", eventId).maybeSingle();
    const prevFields = existing?.fields && typeof existing.fields === "object" ? (existing.fields as Record<string, unknown>) : {};
    await supabase.from("event_overrides").upsert(
      {
        event_id: eventId,
        fields: { ...prevFields, ...payload } as Json,
        locked_fields: [...new Set([...((existing?.locked_fields as string[] | null) ?? []), ...locked])],
        updated_by: "admin",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id" },
    );
    const seriesSlug = (prev.series as { slug?: string } | null)?.slug;
    await refreshOrganizerPages([String(prev.slug)], seriesSlug ? [seriesSlug] : []).catch(() => {});
  }
  return { changed: locked.length };
}

/** Creates a race from the form, public and locked against the watcher; returns its slug. */
export async function applyRaceCreate(input: RaceCreate): Promise<string> {
  const id = await upsertManualEvent({
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate ?? undefined,
    placeName: input.place.name,
    municipality: input.place.name.split(",")[0]?.trim(),
    countryCode: input.place.countryCode,
    lat: input.place.lat,
    lng: input.place.lng,
    disciplines: input.disciplines as Discipline[],
    websiteUrl: input.websiteUrl ?? undefined,
    registrationUrl: input.registrationUrl ?? undefined,
    regulationsUrl: input.regulationsUrl ?? undefined,
    status: "scheduled",
    visibility: "public",
    categories: (input.categories ?? []).map((c) => ({
      name: c.name,
      distanceKm: c.distanceKm ?? undefined,
      ageMin: c.ageMin ?? undefined,
      ageMax: c.ageMax ?? undefined,
    })),
    lockFields: true,
  });
  const supabase = createServerSupabase();
  if (input.description || input.registrationClosesAt) {
    await supabase
      .from("events")
      .update({ description: input.description ?? null, registration_closes_at: input.registrationClosesAt ?? null })
      .eq("id", id);
  }
  const { data } = await supabase.from("events").select("slug").eq("id", id).single();
  return data?.slug ?? "";
}

/**
 * Races that may be the same one: a day either side, within 20 km. Asked
 * before a new race is created so nobody adds a race we already list.
 */
export async function possibleDuplicates(input: Pick<RaceCreate, "startDate" | "place">) {
  const supabase = createServerSupabase();
  const day = (offset: number) => new Date(Date.parse(`${input.startDate}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
  const d = 20 / 111;
  const { data } = await supabase
    .from("events")
    .select("name, slug, start_date, location:locations!inner(lat, lng)")
    .eq("visibility", "public")
    .is("merged_into_id", null)
    .gte("start_date", day(-1))
    .lte("start_date", day(1))
    .gte("location.lat", input.place.lat - d)
    .lte("location.lat", input.place.lat + d)
    .gte("location.lng", input.place.lng - d * 1.6)
    .lte("location.lng", input.place.lng + d * 1.6)
    .limit(5);
  return (data ?? []).map((r) => ({ name: r.name, slug: r.slug, startDate: r.start_date }));
}
