import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { bootstrapAccount, displayNameFromAuthUser } from "@/lib/account-bootstrap";
import { apiError } from "@/lib/api/respond";
import { parseJson } from "@/lib/api/validate";
import { clientIp, rateLimit } from "@/lib/security";
import { requireSessionUser } from "@/lib/supabase/user-server";

const bodySchema = z.object({
  displayName: z
    .unknown()
    .optional()
    .transform((v) => (typeof v === "string" ? v.trim() : "")),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`bootstrap:${ip}`, 20, 60_000)) {
    return apiError(429, "Too many requests");
  }

  const user = await requireSessionUser();
  if (!user) return apiError(401, "Unauthorized");

  // The sign-in form sends a name when it has one and nothing when it has not.
  const parsed = await parseJson(req, bodySchema, { optional: true });
  if (!parsed.ok) return parsed.response;

  await bootstrapAccount({
    userId: user.id,
    email: user.email,
    displayName: parsed.data.displayName || displayNameFromAuthUser(user),
  });
  return NextResponse.json({ ok: true });
}
