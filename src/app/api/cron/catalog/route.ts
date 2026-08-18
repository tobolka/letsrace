import { NextRequest, NextResponse } from "next/server";
import { runCatalogHygiene } from "@/lib/catalog/hygiene";

export const maxDuration = 180;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runCatalogHygiene({ maxAgeFills: 400, maxMerges: 40 });
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
