import { NextResponse } from "next/server";
import { agentSiteUrl } from "@/lib/agent-discovery";

export function GET() {
  const base = agentSiteUrl();
  const catalog = {
    linkset: [
      {
        anchor: `${base}/api`,
        "service-desc": [
          {
            href: `${base}/openapi.json`,
            type: "application/openapi+json",
          },
        ],
        "service-doc": [
          {
            href: `${base}/docs/api`,
            type: "text/html",
          },
        ],
        status: [
          {
            href: `${base}/api/events?dateFrom=2026-01-01&dateTo=2026-12-31`,
            type: "application/json",
          },
        ],
      },
    ],
  };

  return NextResponse.json(catalog, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
