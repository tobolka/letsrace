import { NextRequest, NextResponse } from "next/server";
import { bootstrapAccount, displayNameFromAuthUser } from "@/lib/account-bootstrap";
import { clientIp, rateLimit } from "@/lib/security";
import { requireSessionUser } from "@/lib/supabase/user-server";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`bootstrap:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const user = await requireSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const displayName =
    (typeof body.displayName === "string" && body.displayName.trim()) ||
    displayNameFromAuthUser(user);

  await bootstrapAccount({
    userId: user.id,
    email: user.email,
    displayName,
  });
  return NextResponse.json({ ok: true });
}
