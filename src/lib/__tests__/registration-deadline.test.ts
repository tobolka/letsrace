import { describe, expect, it } from "vitest";
import { parseRegistrationWindow, firstDateIn } from "@/lib/watcher/registration-deadline";

/**
 * `events.registration_closes_at` was empty for every upcoming race, so the
 * app could never answer the one question a rider actually has. These are the
 * phrasings the covered markets use.
 */
describe("registration deadline", () => {
  const cases: [string, string, string][] = [
    ["Přihlášky do 15. 9. 2026 na místě i online.", "2026-09-20", "2026-09-15"],
    ["Uzávěrka přihlášek: 12.09.2026", "2026-09-20", "2026-09-12"],
    ["Registrácia do 5.9.2026, potom na mieste.", "2026-09-13", "2026-09-05"],
    ["Anmeldeschluss: 10.09.2026", "2026-09-19", "2026-09-10"],
    ["Nennschluss 1. September 2026", "2026-09-12", "2026-09-01"],
    ["Entries close 11/09/2026", "2026-09-20", "2026-09-11"],
    ["Registration closes on 2026-09-04", "2026-09-12", "2026-09-04"],
    ["Iscrizioni entro il 8 settembre 2026", "2026-09-13", "2026-09-08"],
    ["Zapisy do 3.09.2026", "2026-09-12", "2026-09-03"],
  ];
  for (const [text, start, expected] of cases) {
    it(`reads "${text.slice(0, 34)}"`, () => {
      expect(parseRegistrationWindow(text, start).closesAt).toBe(expected);
    });
  }

  it("fills in a missing year from the race date", () => {
    expect(parseRegistrationWindow("Přihlášky do 15. 9.", "2026-09-20").closesAt).toBe("2026-09-15");
  });

  it("reads an opening date separately", () => {
    const w = parseRegistrationWindow(
      "Přihlášky od 1.6.2026 do 15.9.2026.",
      "2026-09-20",
    );
    expect(w.opensAt).toBe("2026-06-01");
    expect(w.closesAt).toBe("2026-09-15");
  });

  it("refuses a deadline after the race", () => {
    // A misread is worse than nothing: entries cannot close after the start.
    expect(parseRegistrationWindow("Přihlášky do 25.9.2026", "2026-09-20").closesAt).toBeNull();
  });

  it("refuses a deadline more than a year before the race", () => {
    expect(parseRegistrationWindow("Přihlášky do 1.1.2024", "2026-09-20").closesAt).toBeNull();
  });

  it("ignores dates that are not next to a deadline phrase", () => {
    expect(
      parseRegistrationWindow("Závod se koná 20.9.2026. Startovné 500 Kč.", "2026-09-20").closesAt,
    ).toBeNull();
  });

  it("does not reach across the page for a far-away date", () => {
    const text = "Přihlášky do vyčerpání kapacity. " + "x".repeat(80) + " 15.9.2026";
    expect(parseRegistrationWindow(text, "2026-09-20").closesAt).toBeNull();
  });

  it("parses the date formats these calendars use", () => {
    expect(firstDateIn("15. 9. 2026", 2026)).toBe("2026-09-15");
    expect(firstDateIn("2026-09-15", 2026)).toBe("2026-09-15");
    expect(firstDateIn("15 settembre 2026", 2026)).toBe("2026-09-15");
    expect(firstDateIn("31.2.2026", 2026)).toBeNull();
  });
});

describe("visible text", () => {
  it("ignores inline scripts", async () => {
    const { visibleText } = await import("@/lib/watcher/registration-deadline");
    // Sentry and DataTables bundles carry "entries" beside numbers, which is
    // exactly the shape a deadline has.
    const html =
      '<body><script>var s="showing 0 to 0 of 0 entries close 11/09/2026";</script><p>Start 20.9.2026</p></body>';
    const text = visibleText(html);
    expect(text).not.toContain("entries close");
    expect(text).toContain("Start 20.9.2026");
  });
});
