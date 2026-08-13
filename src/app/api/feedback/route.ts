import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const KINDS = new Set(["feature", "feedback", "bug"]);

export async function POST(req: NextRequest) {
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

  const supabase = createServerSupabase();
  const { data: row, error } = await supabase
    .from("feedback_requests")
    .insert({
      kind,
      message,
      email,
      user_id: body.userId || null,
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
      email,
      userId: body.userId || null,
    },
  });

  return NextResponse.json({ ok: true, id: row.id });
}
