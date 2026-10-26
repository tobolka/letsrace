import { describe, expect, it } from "vitest";
import { analyticsBeforeSend, createAnalyticsBeforeSend, sanitizeAnalyticsProps, sanitizeAnalyticsUrl } from "../analytics";

const page = { website: "test", hostname: "letsrace.cz", url: "/cs?email=guest%40example.com&q=private&token=secret&utm_source=newsletter&utm_medium=email&utm_campaign=autumn", title: "Guest email", referrer: "https://example.com/guest/private?token=secret", id: undefined };

describe("analytics privacy boundary", () => {
  it("keeps public routes and campaign attribution, strips personal query/hash/title/referrer path", () => {
    expect(analyticsBeforeSend("event", page)).toEqual({ website: "test", hostname: "letsrace.cz", url: "/cs?utm_source=newsletter&utm_medium=email&utm_campaign=autumn", screen: undefined, language: undefined, referrer: "https://example.com" });
    expect(sanitizeAnalyticsUrl("/cs/e/race-2027?code=secret#token")).toBe("/cs/e/race-2027");
    expect(sanitizeAnalyticsUrl("/cs?utm_campaign=guest@example.com")).toBe("/cs");
    for (const url of ["/cs/zavod/race-2027", "/cs/seznam", "/cs/kalendar", "/cs/zavody/deti", "/de/rennen/race-2027", "/pl/wyscig/race-2027"]) expect(sanitizeAnalyticsUrl(url)).toBe(url);
  });
  it("excludes account, authentication, admin, arbitrary paths, identity and replay", () => {
    for (const url of ["/cs/account/riders", "/cs/muj-plan/jezdci", "/de/mein-plan", "/auth/callback?code=secret", "/admin", "/cs/random/guest", "https://evil.example/cs"]) {
      expect(analyticsBeforeSend("event", { ...page, url })).toBe(false);
    }
    expect(analyticsBeforeSend("event", { ...page, id: "user" })).toBe(false);
    expect(analyticsBeforeSend("identify", page)).toBe(false);
    expect(analyticsBeforeSend("replay", page)).toBe(false);
  });
  it("only allows known events and nonpersonal properties", () => {
    expect(analyticsBeforeSend("event", { ...page, name: "race_registration_complete" })).toBe(false);
    expect(sanitizeAnalyticsProps({ slug: "race-2027", kind: "register", count: 1, email: "guest@example.com", url: "https://host?token=secret", location: "a@b.cz", source: { secret: true }, method: "email" })).toEqual({ slug: "race-2027", kind: "register", count: 1, method: "email" });
  });
  it("collapses filter/map URL updates, but tracks client navigation and back", () => {
    const send = createAnalyticsBeforeSend("https://letsrace.cz");
    expect(send("event", { url: "/cs" })).toBeTruthy();
    expect(send("event", { url: "/cs?q=search&west=1&e=race" })).toBe(false);
    expect(send("event", { url: "/cs/e/race-2027" })).toBeTruthy();
    expect(send("event", { url: "/cs/e/race-2027", name: "race_registration_start", data: { kind: "register" } })).toMatchObject({ name: "race_registration_start" });
    expect(send("event", { url: "/cs" })).toBeTruthy();
    expect(send("event", { url: "/cs?country=cz" })).toBe(false);
  });
});
