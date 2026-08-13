import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth/admin";
import { geocodePendingLocations } from "@/lib/geocode";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const contentType = req.headers.get("content-type") || "";
  let limit = 80;
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    limit = Math.min(Number(body.limit || 80), 150);
  }
  const result = await geocodePendingLocations(limit);
  // HTML form posts from admin dashboard — send user back
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data") || !contentType) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }
  return NextResponse.json({ ok: true, ...result });
}
