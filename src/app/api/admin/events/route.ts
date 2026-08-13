import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { upsertManualEvent, updateEventFields } from "@/lib/events";
import type { Audience, Discipline } from "@/lib/domain";

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
      status: body.status,
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
          status: body.status,
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
        status: body.status,
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
