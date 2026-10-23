import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const listEvents = vi.fn();
const updateEventFields = vi.fn();
const setEventsVisibility = vi.fn();
const upsertManualEvent = vi.fn();
vi.mock("@/lib/events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/events")>()),
  listEvents: (...args: unknown[]) => listEvents(...args),
  updateEventFields: (...args: unknown[]) => updateEventFields(...args),
  setEventsVisibility: (...args: unknown[]) => setEventsVisibility(...args),
  upsertManualEvent: (...args: unknown[]) => upsertManualEvent(...args),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn() }));

const isAdminAuthenticated = vi.fn();
vi.mock("@/lib/auth/admin", () => ({ isAdminAuthenticated: () => isAdminAuthenticated() }));

// A Supabase stand-in that records inserts and can be told to fail.
const inserted: { table: string; row: unknown }[] = [];
let insertError: { message: string } | null = null;
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: () => ({
    from: (table: string) => ({
      insert: (row: unknown) => {
        inserted.push({ table, row });
        const result = insertError
          ? { data: null, error: insertError }
          : { data: { id: "row-1" }, error: null };
        return { select: () => ({ single: async () => result }), then: (r: (v: unknown) => void) => r(result) };
      },
    }),
  }),
}));
vi.mock("@/lib/supabase/user-server", () => ({ requireSessionUser: async () => null }));

import { GET as getEvents } from "@/app/api/events/route";
import { POST as postFeedback } from "@/app/api/feedback/route";
import { POST as postSubmission } from "@/app/api/submissions/route";
import { PATCH as patchAdminEvents } from "@/app/api/admin/events/route";

let ip = 0;
function request(url: string, init?: { method?: string; body?: unknown }) {
  return new NextRequest(`https://letsrace.test${url}`, {
    method: init?.method ?? "GET",
    // A fresh address per request: the in-process rate limit must not interfere.
    headers: { "x-forwarded-for": `10.0.0.${++ip}`, "content-type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  inserted.length = 0;
  insertError = null;
  listEvents.mockResolvedValue([]);
  isAdminAuthenticated.mockResolvedValue(true);
});

describe("GET /api/events", () => {
  it("passes the filters through as the list expects them", async () => {
    const res = await getEvents(
      request("/api/events?q=pohar&disciplines=mtb&disciplines=xco&country=CZ,SK&dateFrom=2026-10-01&anyDate=1"),
    );
    expect(res.status).toBe(200);
    expect(listEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "pohar",
        disciplines: ["mtb", "xco"],
        countryCodes: ["CZ", "SK"],
        dateFrom: "2026-10-01",
        anyDate: true,
        audience: undefined,
        west: undefined,
        polygon: undefined,
      }),
    );
  });

  it("reads a whole bounding box", async () => {
    await getEvents(request("/api/events?west=14&south=49&east=15&north=50"));
    expect(listEvents).toHaveBeenCalledWith(expect.objectContaining({ west: 14, south: 49, east: 15, north: 50 }));
  });

  it.each([
    ["/api/events?west=14&south=49", "west, south, east and north must all be finite numbers"],
    ["/api/events?west=a&south=49&east=15&north=50", "west, south, east and north must all be finite numbers"],
    ["/api/events?dateFrom=notadate", "dateFrom must be YYYY-MM-DD"],
    ["/api/events?dateTo=2026-02-30", "dateTo must be YYYY-MM-DD"],
    ["/api/events?polygon=%5B%5B1%2C2%5D%5D", "polygon must be 3–500 [lng, lat] pairs"],
    ["/api/events?polygon=nope", "polygon must be 3–500 [lng, lat] pairs"],
  ])("answers 400 to %s", async (url, message) => {
    const res = await getEvents(request(url));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(message);
    expect(listEvents).not.toHaveBeenCalled();
  });

  it("accepts a valid polygon", async () => {
    const ring = encodeURIComponent(JSON.stringify([[14, 49], [15, 49], [15, 50]]));
    await getEvents(request(`/api/events?polygon=${ring}`));
    expect(listEvents).toHaveBeenCalledWith(
      expect.objectContaining({ polygon: [[14, 49], [15, 49], [15, 50]] }),
    );
  });
});

describe("POST /api/feedback", () => {
  const send = (body: unknown) => postFeedback(request("/api/feedback", { method: "POST", body }));

  it("stores feedback and tells the admin", async () => {
    const res = await send({ message: "  Great site  ", kind: "Bug", email: "" });
    expect(res.status).toBe(200);
    expect(inserted[0]).toMatchObject({
      table: "feedback_requests",
      row: { kind: "bug", message: "Great site", email: null, status: "pending" },
    });
    expect(inserted[1]?.table).toBe("admin_notifications");
  });

  it.each([
    [{ message: "hi" }, "message required"],
    [{ message: "hello", kind: "praise" }, "invalid kind"],
    [{ message: "x".repeat(4001) }, "message too long"],
  ])("rejects %j", async (body, message) => {
    const res = await send(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(message);
    expect(inserted).toHaveLength(0);
  });

  it("does not hand the database's complaint to the visitor", async () => {
    insertError = { message: 'duplicate key value violates unique constraint "feedback_requests_pkey"' };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await send({ message: "hello there" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("constraint");
  });
});

describe("POST /api/submissions", () => {
  const send = (body: unknown) => postSubmission(request("/api/submissions", { method: "POST", body }));

  it("takes a race address and defaults the kind", async () => {
    const res = await send({ url: " https://example.com/race ", note: "n" });
    expect(res.status).toBe(200);
    expect(inserted[0]).toMatchObject({
      table: "race_submissions",
      row: { url: "https://example.com/race", kind: "race", note: "n", status: "pending" },
    });
  });

  it("knows a series", async () => {
    await send({ url: "https://example.com/cup", kind: "series" });
    expect(inserted[0]?.row).toMatchObject({ kind: "series" });
  });

  it.each([{}, { url: "" }, { url: "javascript:alert(1)" }, { url: "not a url" }, { url: `https://a.cz/${"x".repeat(2000)}` }])(
    "rejects %j",
    async (body) => {
      expect((await send(body)).status).toBe(400);
      expect(inserted).toHaveLength(0);
    },
  );
});

describe("PATCH /api/admin/events", () => {
  const send = (body: unknown) => patchAdminEvents(request("/api/admin/events", { method: "PATCH", body }), undefined);

  it("is for admins only", async () => {
    isAdminAuthenticated.mockResolvedValue(false);
    expect((await send({ id: "e1", visibility: "hidden" })).status).toBe(401);
    expect(updateEventFields).not.toHaveBeenCalled();
  });

  it("changes several races' visibility at once", async () => {
    const res = await send({ ids: ["a", "b"], visibility: "hidden" });
    expect(await res.json()).toEqual({ changed: 2 });
    expect(setEventsVisibility).toHaveBeenCalledTimes(1);
    expect(setEventsVisibility).toHaveBeenCalledWith(["a", "b"], "hidden");
  });

  it.each([
    [{ ids: [], visibility: "hidden" }],
    [{ ids: ["a"], visibility: "secret" }],
    [{ ids: Array.from({ length: 201 }, (_, i) => String(i)), visibility: "hidden" }],
    [{ visibility: "hidden" }],
    [{ id: "e1", status: "exploded" }],
    [{ id: "e1", startDate: "2026-13-01" }],
    [{ id: "e1", websiteUrl: "javascript:alert(1)" }],
  ])("answers 400 to %j instead of a 500 from the database", async (body) => {
    expect((await send(body)).status).toBe(400);
    expect(updateEventFields).not.toHaveBeenCalled();
    expect(setEventsVisibility).not.toHaveBeenCalled();
    expect(upsertManualEvent).not.toHaveBeenCalled();
  });

  it("updates fields and locks them unless told otherwise", async () => {
    await send({ id: "e1", name: "New name", visibility: "hidden", websiteUrl: "", lockFields: true });
    expect(updateEventFields).toHaveBeenCalledWith("e1", { name: "New name", visibility: "hidden" }, true);
  });

  it("re-creates the place when one is sent", async () => {
    upsertManualEvent.mockResolvedValue("e1");
    const res = await send({
      id: "e1",
      name: "Race",
      startDate: "2026-10-10",
      placeName: "Brno",
      countryCode: "cz",
      lat: 49.2,
      lng: null,
    });
    expect(res.status).toBe(200);
    expect(upsertManualEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Race", placeName: "Brno", countryCode: "CZ", lat: 49.2, lng: undefined }),
      "e1",
    );
  });
});
