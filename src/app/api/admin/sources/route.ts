import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const urls: string[] = body.urls ?? [];
  const kind = body.kind || "race";
  const supabase = createServerSupabase();
  const rows = urls.map((url) => ({
    url,
    kind,
    status: "active",
    added_by: "admin",
    next_poll_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("watched_urls").upsert(rows, { onConflict: "url" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: rows.length });
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("watched_urls")
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
