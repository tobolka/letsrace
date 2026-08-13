import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, status } = await req.json();
  const supabase = createServerSupabase();
  const { error } = await supabase.rpc("app_set_discovered_status", {
    p_id: id,
    p_status: status,
  });
  if (error) {
    // fallback without RPC
    await supabase.from("discovered_links").update({ status }).eq("id", id);
    if (status === "accepted") {
      const { data } = await supabase.from("discovered_links").select("*").eq("id", id).single();
      if (data) {
        await supabase.from("watched_urls").upsert(
          {
            url: data.url,
            kind: data.hint_kind || "race",
            status: "active",
            added_by: "discovery",
            parent_id: data.from_watched_url_id,
            next_poll_at: new Date().toISOString(),
          },
          { onConflict: "url" },
        );
      }
    }
  }
  return NextResponse.json({ ok: true });
}
