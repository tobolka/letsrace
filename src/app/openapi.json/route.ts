import { NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/openapi-spec";

export function GET() {
  return NextResponse.json(buildOpenApiSpec(), {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
