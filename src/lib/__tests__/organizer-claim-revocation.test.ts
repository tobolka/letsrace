import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ status: "revoked", insert: vi.fn() }));
vi.mock("@/lib/supabase/user-server", () => ({ requireSessionUser: async () => ({ id: "user", email: "info@race.test", email_confirmed_at: "2026-01-01" }) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ from: () => {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: "race", slug: "race-2027", name: "Race", website_url: "https://race.test" }, error: null }) };
  return q;
} }) }));
vi.mock("@/lib/organizer", () => ({ emailMatchesSite: () => true, syncBadge: vi.fn(), organizerDb: () => ({ from: () => {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: "claim", status: state.status }, error: null }), insert: state.insert };
  return q;
} }) }));
vi.mock("@/lib/organizer-publish", () => ({ refreshOrganizerPages: vi.fn() }));
import { POST } from "@/app/api/organizer/claims/route";
afterEach(() => vi.clearAllMocks());
describe("previous organiser decisions", () => {
  it.each(["rejected", "revoked"])("does not restore %s access even when the email domain matches", async status => {
    state.status = status;
    const response = await POST(new NextRequest("https://letsrace.cz/api/organizer/claims", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "race", slug: "race-2027" }) }));
    expect(response.status).toBe(403);
    expect((await response.json()).status).toBe(status);
    expect(state.insert).not.toHaveBeenCalled();
  });
});
