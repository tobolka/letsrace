import { NextResponse } from "next/server";
import { withCron } from "@/lib/api/guards";
import { runCatalogHygiene } from "@/lib/catalog/hygiene";

export const maxDuration = 180;

export const GET = withCron(async () => {
  const result = await runCatalogHygiene({ maxAgeFills: 400, maxMerges: 40 });
  // The database queues affected pages in the same transaction as each write.
  // Leave refreshes to the bounded publication job.
  return NextResponse.json({ ok: true, refreshed: false, ...result });
});

export const POST = GET;
