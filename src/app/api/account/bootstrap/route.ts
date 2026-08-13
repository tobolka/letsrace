import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const userId = body.userId as string;
  const email = body.email as string;
  const displayName = (body.displayName as string) || email?.split("@")[0] || "Rider";
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const supabase = createServerSupabase();
  await supabase.from("profiles").upsert({
    id: userId,
    email,
    display_name: displayName,
    updated_at: new Date().toISOString(),
  });

  const { data: existing } = await supabase
    .from("family_members")
    .select("id")
    .eq("user_id", userId)
    .eq("is_self", true)
    .maybeSingle();

  if (!existing) {
    await supabase.from("family_members").insert({
      user_id: userId,
      name: displayName,
      relationship: "self",
      is_self: true,
    });
  }

  return NextResponse.json({ ok: true });
}
