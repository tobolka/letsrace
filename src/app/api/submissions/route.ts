import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSessionUser } from "@/lib/supabase/user-server";
import { clientIp, rateLimit } from "@/lib/security";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`submissions:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const url = String(body.url || "").trim();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
  if (url.length > 2000) {
    return NextResponse.json({ error: "url too long" }, { status: 400 });
  }
  try {
    const parsed = new URL(url);
    if (!/^https?:$/i.test(parsed.protocol)) {
      return NextResponse.json({ error: "url must be http(s)" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  const user = await requireSessionUser();
  const supabase = createServerSupabase();
  const { data: sub, error } = await supabase
    .from("race_submissions")
    .insert({
      url,
      note: typeof body.note === "string" ? body.note.slice(0, 2000) : null,
      user_id: user?.id ?? null,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("admin_notifications").insert({
    kind: "race_submission",
    title: "New race URL submitted",
    body: url,
    payload: {
      submissionId: sub.id,
      url,
      note: typeof body.note === "string" ? body.note.slice(0, 2000) : null,
      userId: user?.id ?? null,
    },
  });

  return NextResponse.json({ ok: true, id: sub.id });
}
