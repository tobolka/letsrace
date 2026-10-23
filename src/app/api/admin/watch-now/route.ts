import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/api/guards";
import { runDueWatches } from "@/lib/watcher/run";

export const POST = withAdmin(
  async (req) => {
    try {
      await runDueWatches(40, { concurrency: 4, budgetMs: 55_000 });
    } catch (e) {
      console.error(e);
    }
    return NextResponse.redirect(new URL("/admin", req.url));
  },
  { onUnauthorized: (req) => NextResponse.redirect(new URL("/admin/login", req.url)) },
);
