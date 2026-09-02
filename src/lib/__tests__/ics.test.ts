import { describe, expect, it } from "vitest";
import { buildIcs, type IcsEvent } from "@/lib/ics";

function race(over: Partial<IcsEvent> = {}): IcsEvent {
  return {
    uid: "race-1@letsrace.cz",
    startDate: "2026-09-12",
    endDate: null,
    summary: "Rallye Sudety",
    location: "Teplice nad Metují, CZ",
    description: null,
    url: "https://letsrace.cz/cs",
    updatedAt: "2026-09-01T10:00:00.000Z",
    ...over,
  };
}

describe("buildIcs", () => {
  it("writes an all-day event whose end is the day after", () => {
    const ics = buildIcs({ name: "Plan", description: "", events: [race()] });
    expect(ics).toContain("DTSTART;VALUE=DATE:20260912");
    expect(ics).toContain("DTEND;VALUE=DATE:20260913");
  });

  it("spans a stage race to the day after its last day", () => {
    const ics = buildIcs({
      name: "Plan",
      description: "",
      events: [race({ startDate: "2026-07-01", endDate: "2026-07-03" })],
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:20260701");
    expect(ics).toContain("DTEND;VALUE=DATE:20260704");
  });

  it("escapes the characters that would otherwise end a line early", () => {
    const ics = buildIcs({
      name: "Plan",
      description: "",
      events: [race({ summary: "Grand Prix, Brno; round 2" })],
    });
    expect(ics).toContain("SUMMARY:Grand Prix\\, Brno\; round 2");
  });

  it("folds a line no client would accept at full length", () => {
    const long = "Mistrovství České republiky v cyklistice horských kol maraton XCM 2026 ročník";
    const ics = buildIcs({ name: "Plan", description: "", events: [race({ summary: long })] });
    for (const line of ics.split("\r\n")) {
      expect(Buffer.from(line, "utf8").length).toBeLessThanOrEqual(75);
    }
  });

  it("uses CRLF, as every calendar client expects", () => {
    const ics = buildIcs({ name: "Plan", description: "", events: [race()] });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
