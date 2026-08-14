import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { runDueWatches } from "@/lib/watcher/run";

export async function POST(req: NextRequest) {
  const url = new URL("/admin", req.url);
  try {
    await requireAdmin();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  try {
    await runDueWatches(40, { concurrency: 4, budgetMs: 55_000 });
  } catch (e) {
    console.error(e);
  }
  return NextResponse.redirect(url);
}
