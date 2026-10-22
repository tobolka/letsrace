import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { runCatalogHygiene } from "@/lib/catalog/hygiene";
import { refreshPublicCatalogue } from "@/lib/refresh-public-catalogue";

export const maxDuration = 180;

export async function GET(req: NextRequest) {
  if (!requireCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runCatalogHygiene({ maxAgeFills: 400, maxMerges: 40 });
  refreshPublicCatalogue();
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
