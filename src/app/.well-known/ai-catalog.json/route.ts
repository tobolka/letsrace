import { NextResponse } from "next/server";
import { agentSiteUrl } from "@/lib/agent-discovery";

export function GET() {
  const base = agentSiteUrl();
  const catalog = {
    specVersion: "1.0",
    host: {
      displayName: "Let's Race",
      identifier: "did:web:letsrace.cz",
    },
    entries: [
      {
        identifier: "urn:air:letsrace.cz:api:events",
        displayName: "Race Events API",
        type: "application/openapi+json",
        url: `${base}/openapi.json`,
        representativeQueries: [
          "find gravel races in Czech Republic this weekend",
          "list MTB events near Prague in September",
          "kids cycling races in Slovakia",
        ],
      },
      {
        identifier: "urn:air:letsrace.cz:doc:api",
        displayName: "API Documentation",
        type: "text/html",
        url: `${base}/docs/api`,
        representativeQueries: [
          "how to query the race calendar API",
          "filter events by discipline and date",
        ],
      },
      {
        identifier: "urn:air:letsrace.cz:mcp:browser",
        displayName: "Let's Race WebMCP Tools",
        type: "application/mcp-server-card+json",
        url: `${base}/.well-known/mcp/server-card.json`,
        representativeQueries: [
          "search races on the map",
          "geocode a town for race discovery",
        ],
      },
      {
        identifier: "urn:air:letsrace.cz:skills:index",
        displayName: "Agent Skills Index",
        type: "application/json",
        url: `${base}/.well-known/agent-skills/index.json`,
        representativeQueries: [
          "discover agent skills for race search",
          "find authentication skill for Let's Race",
        ],
      },
    ],
  };

  return NextResponse.json(catalog, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
