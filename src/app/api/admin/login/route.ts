import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/respond";
import { parseJson } from "@/lib/api/validate";
import { loginAdmin } from "@/lib/auth/admin";
import { clientIp, rateLimit } from "@/lib/security";

const bodySchema = z.object({ password: z.string().max(500) });

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`admin-login:${ip}`, 8, 60_000)) {
    return apiError(429, "Too many requests");
  }

  const parsed = await parseJson(req, bodySchema, { optional: true });
  // A missing password is a wrong password, not a malformed request.
  const ok = await loginAdmin(parsed.ok ? parsed.data.password : "");
  if (!ok) return apiError(401, "Unauthorized");
  return NextResponse.json({ ok: true });
}
