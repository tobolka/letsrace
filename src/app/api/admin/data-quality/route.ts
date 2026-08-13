import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { listIncompleteEvents } from "@/lib/admin/data-quality";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = await listIncompleteEvents({ upcomingOnly: true, limit: 500 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
