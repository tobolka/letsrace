import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsSection, filterSnapshot } from "../analytics-product";
import { analyticsBeforeSend, flushAnalytics, setAnalyticsEnabled, track } from "../analytics";

afterEach(() => { setAnalyticsEnabled(false); vi.unstubAllGlobals(); });

describe("product analytics", () => {
  it("maps localized section entries including collections and personal subsections", () => {
    const cases: Record<string, string> = { "/cs": "map", "/cs/seznam": "list", "/cs/kalendar": "schedule", "/cs/zavody": "browse_countries", "/cs/zavody/cz": "browse_country", "/cs/zavody/cz/mtb": "browse_discipline", "/cs/zavody/deti": "collection", "/de/rennen/race-2027": "race_page", "/cs/muj-plan": "plan", "/cs/muj-plan/doporuceni": "recommendations", "/cs/muj-plan/upozorneni": "alert_areas", "/cs/muj-plan/jezdci": "riders", "/cs/muj-plan/nastaveni": "settings" };
    for (const [path, section] of Object.entries(cases)) expect(analyticsSection(path)?.section, path).toBe(section);
    for (const path of ["/admin", "/cs/auth", "/cs/account/private-user"]) expect(analyticsSection(path)).toBeNull();
  });
  it("allows only coarse personal section/save signals without private paths or identities", () => {
    const payload = { url: "/cs/muj-plan/jezdci?email=private@example.com", title: "Child name", name: "section_view", data: { section: "riders", email: "private@example.com", name: "Child", lat: 50 } };
    expect(analyticsBeforeSend("event", payload)).toMatchObject({ url: "/cs", data: { section: "riders" } });
    expect(analyticsBeforeSend("event", { ...payload, name: undefined })).toBe(false);
    expect(analyticsBeforeSend("event", { ...payload, name: "race_view" })).toBe(false);
    expect(analyticsBeforeSend("event", { ...payload, url: "https://evil.example/cs/account", name: "section_view" })).toBe(false);
    expect(analyticsBeforeSend("event", { ...payload, url: "http://[" })).toBe(false);
  });
  it("reduces filter context without sending text, coordinates or exact dates", () => {
    const snapshot = filterSnapshot({ q: "private@example.com", country: ["SK", "CZ", "CZ", "private-name"], disciplines: ["mtb"], dateFrom: "2026-10-26", dateTo: "2026-10-31" }, 25);
    expect(snapshot).toMatchObject({ country_set: "CZ.SK", discipline_set: "mtb", has_query: true, date_span: "1_7", radius_km: 25 });
    expect(JSON.stringify(snapshot)).not.toMatch(/private|2026|lat|lng/);
  });
  it("does not track before opt-in, keeps queued context and expires blocked events", () => {
    vi.stubGlobal("window", { location: { pathname: "/cs", href: "https://letsrace.cz/cs?q=private" } });
    const spy = vi.fn();
    track("section_view", { section: "map" });
    setAnalyticsEnabled(true);
    track("section_view", { section: "map" });
    window.location.href = "https://letsrace.cz/cs/seznam";
    window.umami = { track: spy };
    flushAnalytics();
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = spy.mock.calls[0][0]({});
    expect(analyticsBeforeSend("event", payload)).toMatchObject({ url: "/cs", data: { section: "map" } });
    window.umami = undefined;
    track("section_view", { section: "list" });
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 11000);
    window.umami = { track: spy };
    flushAnalytics();
    expect(spy).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});
