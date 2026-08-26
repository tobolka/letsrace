import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSessionUser } from "@/lib/supabase/user-server";
import { clientIp, rateLimit } from "@/lib/security";

const KINDS = new Set(["feature", "feedback", "bug"]);

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`feedback:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const message = String(body.message || "").trim();
  const kind = String(body.kind || "feedback").trim().toLowerCase();
  const email = String(body.email || "").trim() || null;

  if (!message || message.length < 3) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "message too long" }, { status: 400 });
  }
  if (email && email.length > 320) {
    return NextResponse.json({ error: "email too long" }, { status: 400 });
  }

  const user = await requireSessionUser();
  const supabase = createServerSupabase();
  const { data: row, error } = await supabase
    .from("feedback_requests")
    .insert({
      kind,
      message,
      email: email || user?.email || null,
      user_id: user?.id ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const titles: Record<string, string> = {
    feature: "Feature request",
    feedback: "Feedback",
    bug: "Bug report",
  };

  await supabase.from("admin_notifications").insert({
    kind: "feedback",
    title: titles[kind] || "Feedback",
    body: message.slice(0, 280),
    payload: {
      feedbackId: row.id,
      kind,
      email: email || user?.email || null,
      userId: user?.id ?? null,
    },
  });

  return NextResponse.json({ ok: true, id: row.id });
}
