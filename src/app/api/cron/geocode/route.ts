import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { first } from "@/lib/api/schemas";
import { parseQuery } from "@/lib/api/validate";
import { withCron } from "@/lib/api/guards";
import { geocodePendingLocations } from "@/lib/geocode";

export const maxDuration = 120;

const querySchema = z.object({
  limit: first.transform((v) => Math.min(Math.max(Number(v || 80) || 80, 1), 120)),
  mode: first,
});

export const GET = withCron(async (req: NextRequest) => {
  const parsed = parseQuery(req.nextUrl.searchParams, querySchema);
  if (!parsed.ok) return parsed.response;
  const { limit, mode } = parsed.data;
  const result = await geocodePendingLocations(limit, { gazetteerOnly: mode === "gazetteer" });
  return NextResponse.json({ ok: true, ...result });
});

export const POST = GET;
