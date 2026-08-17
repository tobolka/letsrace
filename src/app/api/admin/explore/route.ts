import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { runExplore } from "@/lib/watcher/explore";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const dest = new URL("/admin/discovery", req.url);
  try {
    await requireAdmin();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  try {
    const result = await runExplore({ budgetMs: 55_000, maxFetch: 12 });
    dest.searchParams.set("queued", String(result.queued));
    dest.searchParams.set("watched", String(result.autoWatched));
  } catch (e) {
    console.error(e);
    dest.searchParams.set("error", "1");
  }
  return NextResponse.redirect(dest);
}
