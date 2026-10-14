import { NextResponse } from "next/server";
import { agentSiteUrl } from "@/lib/agent-discovery";

export function GET() {
  const base = agentSiteUrl();
  const body = `# auth.md — Let's Race public agent access

## Access policy

Agents can read public race data without registration, an API key, or an access token.
No OAuth authorization server or agent credential issuance is provided for this API.

## Public endpoints

- [GET /api/events](${base}/api/events) — search cycling events by date, location, and discipline.
- [GET /api/series](${base}/api/series) — list race series.
- GET /api/places?q= — geocode a place name (at least three characters).

Send \`Accept: application/json\`. No \`Authorization\` header is required.
See [the API documentation](${base}/docs/api) and [OpenAPI schema](${base}/openapi.json) for parameters.

## Agent registration

Registration, identity assertions, claim ceremonies, and credential revocation do not apply to public reads.
Use the endpoints directly; do not attempt to register an agent or request OAuth tokens.

## Personal accounts

Human users can sign in through the website to manage a personal plan.
That browser session is separate from public agent access. Account, admin, and other write operations are outside the public read API documented here.

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
