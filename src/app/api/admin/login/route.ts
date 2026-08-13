import { NextRequest, NextResponse } from "next/server";
import { loginAdmin } from "@/lib/auth/admin";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const ok = await loginAdmin(String(body.password ?? ""));
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
