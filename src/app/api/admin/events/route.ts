import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { upsertManualEvent, updateEventFields } from "@/lib/events";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Audience, Discipline } from "@/lib/domain";

/**
 * Name search for the command palette. Unlike the public one it sees hidden
 * races too — finding the row you need to unhide is most of why you opened it.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
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
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const id = await upsertManualEvent({
      name: body.name,
      startDate: body.startDate,
      endDate: body.endDate,
      placeName: body.placeName,
      municipality: body.municipality,
      countryCode: body.countryCode,
      lat: body.lat,
      lng: body.lng,
      audience: body.audience as Audience,
      disciplines: body.disciplines as Discipline[],
      websiteUrl: body.websiteUrl,
      registrationUrl: body.registrationUrl,
      regulationsUrl: body.regulationsUrl,
      status: body.status,
      visibility: body.visibility,
      lockFields: Boolean(body.lockFields),
    });
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();

    // Bulk visibility. Hiding twelve Zwift races one row at a time is twelve
    // chances to lose your place in a 2,000-row list.
    if (Array.isArray(body.ids)) {
      const ids = (body.ids as unknown[]).filter((v): v is string => typeof v === "string");
      if (ids.length === 0) return NextResponse.json({ error: "ids required" }, { status: 400 });
      if (ids.length > 200) return NextResponse.json({ error: "too many" }, { status: 400 });
      if (body.visibility !== "public" && body.visibility !== "hidden") {
        return NextResponse.json({ error: "visibility required" }, { status: 400 });
      }
      let changed = 0;
      for (const id of ids) {
        await updateEventFields(id, { visibility: body.visibility }, true);
        changed += 1;
      }
      return NextResponse.json({ changed });
    }

    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Re-create location + update via upsertManualEvent when place provided
    if (body.placeName) {
      const id = await upsertManualEvent(
        {
          name: body.name,
          startDate: body.startDate,
          endDate: body.endDate,
          placeName: body.placeName,
          municipality: body.municipality,
          countryCode: body.countryCode,
          lat: body.lat,
          lng: body.lng,
          audience: body.audience as Audience,
          disciplines: body.disciplines as Discipline[],
          websiteUrl: body.websiteUrl,
          registrationUrl: body.registrationUrl,
          regulationsUrl: body.regulationsUrl,
          status: body.status,
          visibility: body.visibility,
          lockFields: Boolean(body.lockFields),
        },
        body.id,
      );
      return NextResponse.json({ id });
    }

    await updateEventFields(
      body.id,
      {
        name: body.name,
        startDate: body.startDate,
        endDate: body.endDate,
        audience: body.audience,
        disciplines: body.disciplines,
        websiteUrl: body.websiteUrl,
        registrationUrl: body.registrationUrl,
        regulationsUrl: body.regulationsUrl,
        status: body.status,
        visibility: body.visibility,
      },
      Boolean(body.lockFields),
    );
    return NextResponse.json({ id: body.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
