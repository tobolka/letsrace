import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminWorkCounts } from "@/lib/admin/work-counts";

export const dynamic = "force-dynamic";

/** Counts for the admin shell's badges. */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getAdminWorkCounts());
}
