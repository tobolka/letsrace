import { NextResponse } from "next/server";

// Public agent reads have no OAuth resource or authorization server.
// Keep an explicit response so old discovery URLs cannot advertise stale metadata.
export function GET() {
  return NextResponse.json(
    {
      error: "oauth_not_supported",
      error_description: "Public agent reads require no registration or access token. See /auth.md.",
    },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}
