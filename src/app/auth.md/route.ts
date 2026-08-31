import { NextResponse } from "next/server";
import { agentSiteUrl, supabaseAuthBase } from "@/lib/agent-discovery";

export function GET() {
  const base = agentSiteUrl();
  const auth = supabaseAuthBase();
  const body = `# auth.md — Let's Race agent authentication

Agents can read public race data without credentials. Sign in is required to submit races or manage a personal plan.

## Protected resource

- Resource: \`${base}/api\`
- Metadata: [/.well-known/oauth-protected-resource](${base}/.well-known/oauth-protected-resource)

## Authorization server

${auth ? `- Issuer: \`${auth}\`\n- Discovery: [/.well-known/openid-configuration](${base}/.well-known/openid-configuration)` : "- Configure \`NEXT_PUBLIC_SUPABASE_URL\` for live OAuth metadata."}

## Registration

Human and agent clients start OAuth at [${base}/en/auth](${base}/en/auth).

Supported identity types:

- **anonymous** — browse and query public APIs
- **verified_email** — OAuth sign-in via Supabase (Google)

## Scopes

\`openid\`, \`email\`, \`profile\`

## Bearer usage

Send \`Authorization: Bearer <access_token>\` to protected endpoints such as \`POST /api/submissions\`.

## Agent skills

See [/.well-known/agent-skills/index.json](${base}/.well-known/agent-skills/index.json) for machine-readable skills.
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
