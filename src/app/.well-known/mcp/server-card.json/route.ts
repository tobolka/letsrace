import { NextResponse } from "next/server";
import { agentSiteUrl, AGENT_DISCOVERY_VERSION } from "@/lib/agent-discovery";

export function GET() {
  const base = agentSiteUrl();
  const card = {
    schemaVersion: "2025-03-26",
    serverInfo: {
      name: "Let's Race",
      version: AGENT_DISCOVERY_VERSION,
    },
    transport: {
      type: "streamable-http",
      endpoint: `${base}/en`,
    },
    capabilities: {
      tools: {
        listChanged: false,
      },
      resources: {},
      prompts: {},
    },
    description:
      "Browser WebMCP tools on the explore map. HTTP MCP transport is not deployed; use WebMCP on the homepage.",
  };

  return NextResponse.json(card, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
