import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/api/guards";
import { runExplore } from "@/lib/watcher/explore";

export const maxDuration = 60;

export const POST = withAdmin(
  async (req) => {
    const dest = new URL("/admin/discovery", req.url);
    try {
      const result = await runExplore({ budgetMs: 55_000, maxFetch: 12 });
      dest.searchParams.set("queued", String(result.queued));
      dest.searchParams.set("watched", String(result.autoWatched));
    } catch (e) {
      console.error(e);
      dest.searchParams.set("error", "1");
    }
    return NextResponse.redirect(dest);
  },
  { onUnauthorized: (req) => NextResponse.redirect(new URL("/admin/login", req.url)) },
);
