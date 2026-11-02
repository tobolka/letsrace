import { NextResponse } from "next/server";
import { withCron } from "@/lib/api/guards";
import { publishCatalogueBatch } from "@/lib/pipeline/catalogue-publication";

export const maxDuration = 60;
export const GET = withCron(async () => NextResponse.json(await publishCatalogueBatch(), { headers: { "Cache-Control": "private, no-store" } }));
export const POST = GET;
