import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/guards";
import { apiError } from "@/lib/api/respond";
import { first, httpUrl, isoDay, optional } from "@/lib/api/schemas";
import { parseJson, parseQuery, validate } from "@/lib/api/validate";
import type { Discipline } from "@/lib/domain";
import { setEventsVisibility, upsertManualEvent, updateEventFields, type ManualEventInput } from "@/lib/events";
import { createServerSupabase } from "@/lib/supabase/server";

const AUDIENCES = ["kids", "youth", "adults", "mixed"] as const;
// "hidden" is the legacy status the form no longer offers; the library maps it to visibility.
const STATUSES = ["scheduled", "tbc", "postponed", "registration_open", "cancelled", "completed", "hidden"] as const;
const VISIBILITIES = ["public", "hidden"] as const;

const text = (max: number) => z.string().trim().min(1).max(max);
const coordinate = (limit: number) =>
  // A blank coordinate field arrives as `null` (Number("") is not sent, NaN is not JSON).
  z.preprocess((v) => v ?? undefined, z.number().min(-limit).max(limit).optional());

/** A race as the admin form writes it: place and all. */
const manualEventSchema = z.object({
  name: text(300),
  startDate: isoDay,
  endDate: optional(isoDay),
  placeName: text(300),
  municipality: optional(text(300)),
  countryCode: z.string().trim().length(2).toUpperCase(),
  lat: coordinate(90),
  lng: coordinate(180),
  audience: z.enum(AUDIENCES).optional(),
  disciplines: z.array(z.string().min(1).max(40)).max(20).optional(),
  websiteUrl: optional(httpUrl),
  registrationUrl: optional(httpUrl),
  regulationsUrl: optional(httpUrl),
  status: z.enum(STATUSES).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
  lockFields: z.boolean().optional().default(false),
});

/** Every field of a race that can change without touching its place. */
const fieldsSchema = z.object({
  name: optional(text(300)),
  startDate: optional(isoDay),
  endDate: optional(isoDay),
  audience: optional(z.enum(AUDIENCES)),
  disciplines: z.array(z.string().min(1).max(40)).max(20).optional(),
  websiteUrl: optional(httpUrl),
  registrationUrl: optional(httpUrl),
  regulationsUrl: optional(httpUrl),
  status: optional(z.enum(STATUSES)),
  visibility: optional(z.enum(VISIBILITIES)),
  lockFields: z.boolean().optional().default(false),
});

// Hiding twelve Zwift races one row at a time is twelve chances to lose your
// place in a 2,000-row list.
const bulkVisibilitySchema = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1, { error: "ids required" }).max(200, { error: "too many" }),
  visibility: z.enum(VISIBILITIES, { error: "visibility required" }),
});

const targetSchema = z.object({ id: z.string().min(1, { error: "id required" }).max(64) });

/** Disciplines are checked as ids, not against today's list: a race that still carries a retired one must stay editable. */
function withTypedLists(event: z.output<typeof manualEventSchema>): ManualEventInput {
  return { ...event, disciplines: event.disciplines as Discipline[] | undefined };
}

const searchSchema = z.object({ q: first.transform((v) => (v ?? "").trim()) });

/**
 * Name search for the command palette. Unlike the public one it sees hidden
 * races too — finding the row you need to unhide is most of why you opened it.
 */
export const GET = withAdmin(async (req: NextRequest) => {
  const parsed = parseQuery(req.nextUrl.searchParams, searchSchema);
  if (!parsed.ok) return parsed.response;
  const { q } = parsed.data;
  if (q.length < 2) return NextResponse.json({ events: [] });

  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("events")
    .select("id, name, slug, start_date, visibility, location:locations(municipality, name, country_code)")
    .ilike("name", `%${q.replace(/[%_,]/g, " ")}%`)
    .order("start_date", { ascending: false })
    .limit(12);

  const events = (data ?? []).map((row) => {
    const raw = (row as { location?: unknown }).location;
    const loc = (Array.isArray(raw) ? raw[0] : raw) as
      | { municipality?: string | null; name?: string | null; country_code?: string | null }
      | null
      | undefined;
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      startDate: row.start_date as string,
      visibility: row.visibility as string,
      place: loc?.municipality || loc?.name || null,
      countryCode: loc?.country_code ?? null,
    };
  });
  return NextResponse.json({ events });
});

export const POST = withAdmin(async (req: NextRequest) => {
  const parsed = await parseJson(req, manualEventSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const id = await upsertManualEvent(withTypedLists(parsed.data));
    return NextResponse.json({ id });
  } catch (e) {
    return apiError(500, e instanceof Error ? e.message : "Failed");
  }
});

export const PATCH = withAdmin(async (req: NextRequest) => {
  const raw = await parseJson(req, z.record(z.string(), z.unknown()));
  if (!raw.ok) return raw.response;

  try {
    if (Array.isArray(raw.data.ids)) {
      const bulk = validate(bulkVisibilitySchema, raw.data);
      if (!bulk.ok) return bulk.response;
      await setEventsVisibility(bulk.data.ids, bulk.data.visibility);
      return NextResponse.json({ changed: bulk.data.ids.length });
    }

    const target = validate(targetSchema, raw.data);
    if (!target.ok) return target.response;
    const { id } = target.data;

    // A place in the body re-creates the location, so it is the whole race again.
    if (raw.data.placeName) {
      const event = validate(manualEventSchema, raw.data);
      if (!event.ok) return event.response;
      await upsertManualEvent(withTypedLists(event.data), id);
      return NextResponse.json({ id });
    }

    const fields = validate(fieldsSchema, raw.data);
    if (!fields.ok) return fields.response;
    const { lockFields, ...changes } = fields.data;
    await updateEventFields(id, changes, lockFields);
    return NextResponse.json({ id });
  } catch (e) {
    return apiError(500, e instanceof Error ? e.message : "Failed");
  }
});
