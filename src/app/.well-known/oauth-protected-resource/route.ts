import { NextResponse } from "next/server";
import { agentSiteUrl, supabaseAuthBase } from "@/lib/agent-discovery";

export function GET() {
  const base = agentSiteUrl();
  const auth = supabaseAuthBase();

  const metadata = {
    resource: `${base}/api`,
    authorization_servers: auth ? [auth] : [base],
    scopes_supported: ["openid", "email", "profile"],
    bearer_methods_supported: ["header"],
  };

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
