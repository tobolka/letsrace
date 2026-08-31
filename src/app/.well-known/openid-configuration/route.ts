import { NextResponse } from "next/server";
import { agentSiteUrl, AGENT_DISCOVERY_VERSION, supabaseAuthBase } from "@/lib/agent-discovery";

function authMetadata() {
  const auth = supabaseAuthBase();
  const base = agentSiteUrl();
  if (!auth) {
    return {
      issuer: base,
      authorization_endpoint: `${base}/en/auth`,
      token_endpoint: `${base}/.well-known/oauth-unavailable`,
      jwks_uri: `${base}/.well-known/oauth-unavailable`,
      grant_types_supported: ["authorization_code"],
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      scopes_supported: ["openid", "email", "profile"],
      agent_auth: {
        skill: `${base}/.well-known/agent-skills/auth/SKILL.md`,
        register_uri: `${base}/en/auth`,
        identity_types_supported: ["anonymous", "verified_email"],
      },
    };
  }

  return {
    issuer: auth,
    authorization_endpoint: `${auth}/authorize`,
    token_endpoint: `${auth}/token`,
    jwks_uri: `${auth}/.well-known/jwks.json`,
    grant_types_supported: ["authorization_code", "refresh_token"],
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256", "HS256", "ES256"],
    scopes_supported: ["openid", "email", "profile"],
    agent_auth: {
      skill: `${base}/.well-known/agent-skills/auth/SKILL.md`,
      register_uri: `${base}/en/auth`,
      identity_types_supported: ["anonymous", "verified_email"],
      verified_email: {
        credential_types_supported: ["oauth2"],
        claim_uri: `${base}/auth.md#verified-email`,
      },
    },
  };
}

export function GET() {
  return NextResponse.json(authMetadata(), {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
