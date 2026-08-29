import { afterEach, describe, expect, it, vi } from "vitest";
import { GeocodeUnavailableError } from "@/lib/geocode";

/**
 * A throttled geocoder must not look like an empty result.
 *
 * `nominatimSearch` returned null for a 429 exactly as it did for "no such
 * place", and the caller wrote `geocode_status = "failed"` either way — so one
 * rate-limited batch permanently marked Reggio Emilia, Maranello and ~80 other
 * real towns as unlocatable, and nothing ever retried them.
 */
describe("geocoder availability", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("separates 'cannot ask' from 'not found'", () => {
    const transient = new GeocodeUnavailableError("HTTP 429");
    expect(transient).toBeInstanceOf(Error);
    expect(transient.reason).toBe("HTTP 429");
    expect(transient.name).toBe("GeocodeUnavailableError");
  });

  it("treats throttling, timeouts and server errors as retryable", async () => {
    const { geocodePlace } = await import("@/lib/geocode");
    for (const status of [429, 408, 500, 503]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("", { status })),
      );
      await expect(geocodePlace("Reggio Emilia", "IT")).rejects.toBeInstanceOf(
        GeocodeUnavailableError,
      );
    }
  });

  it("still reports a genuinely unknown place as not found", async () => {
    const { geocodePlace } = await import("@/lib/geocode");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("[]", { status: 200 })),
    );
    await expect(geocodePlace("Zzzz Nowhere 12345", "IT")).resolves.toBeNull();
  });
});
