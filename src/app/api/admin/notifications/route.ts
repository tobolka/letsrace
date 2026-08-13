import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isAdminAuthenticated } from "@/lib/auth/admin";

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const supabase = createServerSupabase();
  await supabase
    .from("admin_notifications")
    .update({ read_at: body.read ? new Date().toISOString() : null })
    .eq("id", body.id);
  return NextResponse.json({ ok: true });
}
