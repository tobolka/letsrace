import { NextRequest, NextResponse } from "next/server";
import { loginAdmin } from "@/lib/auth/admin";
import { clientIp, rateLimit } from "@/lib/security";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`admin-login:${ip}`, 8, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const ok = await loginAdmin(String(body.password ?? ""));
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
