import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/guards";
import { serverError } from "@/lib/api/respond";
import { httpUrl } from "@/lib/api/schemas";
import { parseJson } from "@/lib/api/validate";
import { createServerSupabase } from "@/lib/supabase/server";

const addSchema = z.object({
  urls: z.array(httpUrl).min(1, { error: "urls required" }).max(500, { error: "too many" }),
  kind: z.string().trim().min(1).max(40).default("race"),
});

const statusSchema = z.object({
  id: z.string().min(1).max(64),
  status: z.string().trim().min(1).max(40),
});

export const POST = withAdmin(async (req: NextRequest) => {
  const parsed = await parseJson(req, addSchema);
  if (!parsed.ok) return parsed.response;
  const { urls, kind } = parsed.data;

  const supabase = createServerSupabase();
  const now = new Date().toISOString();
  const rows = urls.map((url) => ({
    url,
    kind,
    status: "active",
    added_by: "admin",
    next_poll_at: now,
    updated_at: now,
  }));
  const { error } = await supabase.from("watched_urls").upsert(rows, { onConflict: "url" });
  if (error) return serverError("adding watched urls failed", error);
  return NextResponse.json({ ok: true, count: rows.length });
});

export const PATCH = withAdmin(async (req: NextRequest) => {
  const parsed = await parseJson(req, statusSchema);
  if (!parsed.ok) return parsed.response;

  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("watched_urls")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return serverError("updating watched url failed", error);
  return NextResponse.json({ ok: true });
});
