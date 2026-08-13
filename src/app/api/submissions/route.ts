import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const url = String(body.url || "").trim();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const supabase = createServerSupabase();
  const { data: sub, error } = await supabase
    .from("race_submissions")
    .insert({
      url,
      note: body.note || null,
      user_id: body.userId || null,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("admin_notifications").insert({
    kind: "race_submission",
    title: "New race URL submitted",
    body: url,
    payload: { submissionId: sub.id, url, note: body.note || null, userId: body.userId || null },
  });

  return NextResponse.json({ ok: true, id: sub.id });
}
