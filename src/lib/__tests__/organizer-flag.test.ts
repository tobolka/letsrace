import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

afterEach(() => vi.unstubAllEnvs());

const call = (path: string) => new NextRequest(`https://letsrace.cz${path}`);

describe("organiser claim flow is switched off", () => {
  it("answers not found on every route while ORGANIZER_CLAIMS is not 1", async () => {
    vi.stubEnv("ORGANIZER_CLAIMS", "");
    const access = await import("@/app/api/organizer/access/route");
    const claims = await import("@/app/api/organizer/claims/route");
    const suggestions = await import("@/app/api/organizer/suggestions/route");
    const events = await import("@/app/api/organizer/events/[id]/route");
    const ctx = { params: Promise.resolve({ id: "x" }) };
    expect((await access.GET(call("/api/organizer/access?kind=race&slug=x"))).status).toBe(404);
    expect((await claims.GET()).status).toBe(404);
    expect((await claims.POST(call("/api/organizer/claims"))).status).toBe(404);
    expect((await suggestions.POST(call("/api/organizer/suggestions"))).status).toBe(404);
    expect((await events.GET(call("/api/organizer/events/x"), ctx)).status).toBe(404);
    expect((await events.PATCH(call("/api/organizer/events/x"), ctx)).status).toBe(404);
  });

  it("is a single switch: the flag reads the environment", async () => {
    const { organizerClaimsEnabled } = await import("@/lib/organizer-flag");
    vi.stubEnv("ORGANIZER_CLAIMS", "1");
    expect(organizerClaimsEnabled()).toBe(true);
    vi.stubEnv("ORGANIZER_CLAIMS", "0");
    expect(organizerClaimsEnabled()).toBe(false);
  });
});
