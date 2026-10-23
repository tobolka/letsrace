import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/guards";
import { parseJson } from "@/lib/api/validate";
import { createServerSupabase } from "@/lib/supabase/server";

const bodySchema = z.object({
  id: z.string().min(1).max(64),
  status: z.enum(["accepted", "rejected"]),
});

export const POST = withAdmin(async (req: NextRequest) => {
  const parsed = await parseJson(req, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { id, status } = parsed.data;

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
});
