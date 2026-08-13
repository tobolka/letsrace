import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isAdminAuthenticated } from "@/lib/auth/admin";

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const id = body.id as string;
  const status = body.status as string;
  if (!id || !status) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const supabase = createServerSupabase();
  const { data: sub, error } = await supabase
    .from("race_submissions")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status === "approved" && sub?.url) {
    await supabase.from("watched_urls").upsert(
      {
        url: sub.url,
        kind: "organizer",
        status: "active",
        added_by: "user_submission",
        notes: sub.note || "Approved from user submission",
        next_poll_at: new Date().toISOString(),
      },
      { onConflict: "url" },
    );
  }

  return NextResponse.json({ ok: true });
}
