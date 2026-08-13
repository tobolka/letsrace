import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { previewUrl } from "@/lib/watcher/run";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
  const result = await previewUrl(String(url));
  return NextResponse.json(result);
}
