import { createHash } from "crypto";
import { getSiteUrl } from "@/lib/seo";

export const AGENT_DISCOVERY_VERSION = "1.0.0";

export function agentSiteUrl(): string {
  return getSiteUrl().replace(/\/$/, "");
}

export function agentLinkHeaders(): string[] {
  return [
    `</.well-known/api-catalog>; rel="api-catalog"`,
    `</.well-known/ai-catalog.json>; rel="describedby"`,
    `</docs/api>; rel="service-doc"`,
    `</openapi.json>; rel="service-desc"`,
    `</.well-known/agent-skills/index.json>; rel="describedby"`,
    `</.well-known/mcp/server-card.json>; rel="describedby"`,
    `</auth.md>; rel="describedby"`,
  ];
}

export function sha256Digest(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}
