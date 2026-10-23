import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";
import {
  ADMIN_SESSION_SECONDS,
  adminSessionToken,
  passwordsMatch,
  verifyAdminCookieValue,
} from "@/lib/auth/admin-token";

const NOW = Date.UTC(2026, 9, 23);

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSWORD", "hunter2");
  vi.stubEnv("ADMIN_SESSION_SECRET", "s3cret");
});
afterEach(() => vi.unstubAllEnvs());

describe("admin session token", () => {
  it("verifies a token it just issued", () => {
    expect(verifyAdminCookieValue(adminSessionToken("hunter2", "s3cret", NOW), NOW + 1000)).toBe(true);
  });

  it("expires on its own", () => {
    const token = adminSessionToken("hunter2", "s3cret", NOW);
    const justBefore = NOW + (ADMIN_SESSION_SECONDS - 1) * 1000;
    expect(verifyAdminCookieValue(token, justBefore)).toBe(true);
    expect(verifyAdminCookieValue(token, NOW + (ADMIN_SESSION_SECONDS + 1) * 1000)).toBe(false);
  });

  it("cannot have its expiry extended", () => {
    const [version, exp, sig] = adminSessionToken("hunter2", "s3cret", NOW).split(".");
    const forged = `${version}.${Number(exp) + 86_400}.${sig}`;
    expect(verifyAdminCookieValue(forged, NOW)).toBe(false);
  });

  it("stops working when the password or the secret changes", () => {
    const token = adminSessionToken("hunter2", "s3cret", NOW);
    vi.stubEnv("ADMIN_PASSWORD", "other");
    expect(verifyAdminCookieValue(token, NOW)).toBe(false);
    vi.stubEnv("ADMIN_PASSWORD", "hunter2");
    vi.stubEnv("ADMIN_SESSION_SECRET", "rotated");
    expect(verifyAdminCookieValue(token, NOW)).toBe(false);
  });

  it("rejects the old static cookie, garbage and nothing", () => {
    const old = createHash("sha256").update("hunter2:s3cret").digest("hex");
    for (const value of [old, "", undefined, "v1", "v1.abc.def", "v1.1.2.3", "v2.9999999999.aa"]) {
      expect(verifyAdminCookieValue(value, NOW)).toBe(false);
    }
  });

  it("is closed when the environment is not configured", () => {
    const token = adminSessionToken("hunter2", "s3cret", NOW);
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    expect(verifyAdminCookieValue(token, NOW)).toBe(false);
  });
});

describe("passwordsMatch", () => {
  it("compares exactly", () => {
    expect(passwordsMatch("a", "a")).toBe(true);
    expect(passwordsMatch("a", "b")).toBe(false);
    expect(passwordsMatch("a", "ab")).toBe(false);
  });
});
