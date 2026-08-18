import { NextRequest, NextResponse } from "next/server";
import { bootstrapAccount } from "@/lib/account-bootstrap";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const userId = body.userId as string;
  const email = body.email as string;
  const displayName = (body.displayName as string) || email?.split("@")[0] || "Rider";
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  await bootstrapAccount({ userId, email, displayName });
  return NextResponse.json({ ok: true });
}
