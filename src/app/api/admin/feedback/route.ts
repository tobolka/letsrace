import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const status = String(body.status || "");
  if (!id || !["pending", "done", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "id + status required" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("feedback_requests")
    .update({ status })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
