import { NextResponse } from "next/server";
import { withCron } from "@/lib/api/guards";
import { runCatalogHygiene } from "@/lib/catalog/hygiene";
import { refreshPublicCatalogue } from "@/lib/refresh-public-catalogue";

export const maxDuration = 180;

export const GET = withCron(async () => {
  const result = await runCatalogHygiene({ maxAgeFills: 400, maxMerges: 40 });
  refreshPublicCatalogue();
  return NextResponse.json({ ok: true, ...result });
});

export const POST = GET;
