import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const isAdminAuthenticated = vi.fn();
vi.mock("@/lib/auth/admin", () => ({ isAdminAuthenticated: () => isAdminAuthenticated() }));

import { withAdmin, withCron } from "@/lib/api/guards";

const req = (headers: Record<string, string> = {}) =>
  new NextRequest("https://letsrace.test/api/x", { headers });

describe("withAdmin", () => {
  afterEach(() => isAdminAuthenticated.mockReset());

  it("runs the handler for an admin", async () => {
    isAdminAuthenticated.mockResolvedValue(true);
    const res = await withAdmin(() => new Response("ok"))(req(), undefined);
    expect(await res.text()).toBe("ok");
  });

  it("answers 401 to anyone else without running the handler", async () => {
    isAdminAuthenticated.mockResolvedValue(false);
    const handler = vi.fn();
    const res = await withAdmin(handler)(req(), undefined);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("lets a form post choose where an unauthorised visitor goes", async () => {
    isAdminAuthenticated.mockResolvedValue(false);
    const res = await withAdmin(vi.fn(), {
      onUnauthorized: () => Response.redirect("https://letsrace.test/admin/login", 307),
    })(req(), undefined);
    expect(res.status).toBe(307);
  });
});

describe("withCron", () => {
  beforeEach(() => vi.stubEnv("CRON_SECRET", "s3cret"));
  afterEach(() => vi.unstubAllEnvs());

  it("runs the handler with the right secret", async () => {
    const res = await withCron(() => new Response("ran"))(req({ authorization: "Bearer s3cret" }), undefined);
    expect(await res.text()).toBe("ran");
  });

  it.each<Record<string, string>>([{}, { authorization: "Bearer wrong" }, { authorization: "s3cret" }])(
    "answers 401 to %j",
    async (headers) => {
      const handler = vi.fn();
      const res = await withCron(handler)(req(headers), undefined);
      expect(res.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it("is closed when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await withCron(vi.fn())(req({ authorization: "Bearer " }), undefined);
    expect(res.status).toBe(401);
  });
});
