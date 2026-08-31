import { createHash } from "crypto";
import { getSiteUrl } from "@/lib/seo";

export const AGENT_DISCOVERY_VERSION = "1.0.0";

export function agentSiteUrl(): string {
  return getSiteUrl().replace(/\/$/, "");
}

export function agentLinkHeaders(): string[] {
  const base = agentSiteUrl();
  return [
    `</.well-known/api-catalog>; rel="api-catalog"`,
    `</.well-known/ai-catalog.json>; rel="describedby"`,
    `</docs/api>; rel="service-doc"`,
    `</openapi.json>; rel="service-desc"`,
    `</.well-known/agent-skills/index.json>; rel="describedby"`,
    `</.well-known/mcp/server-card.json>; rel="describedby"`,
    `<${base}/.well-known/openid-configuration>; rel="openid-configuration"`,
  ];
}

export function sha256Digest(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export function supabaseAuthBase(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return url ? `${url}/auth/v1` : null;
}
