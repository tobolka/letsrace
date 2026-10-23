import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/guards";
import { validate } from "@/lib/api/validate";
import { geocodePendingLocations } from "@/lib/geocode";

const bodySchema = z.object({
  limit: z.coerce.number().int().min(1).max(150).catch(80),
});

export const POST = withAdmin(async (req: NextRequest) => {
  const contentType = req.headers.get("content-type") || "";
  let limit = 80;
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    const parsed = validate(bodySchema, body);
    if (parsed.ok) limit = parsed.data.limit;
  }
  const result = await geocodePendingLocations(limit);
  // HTML form posts from admin dashboard — send user back
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data") || !contentType) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }
  return NextResponse.json({ ok: true, ...result });
});
