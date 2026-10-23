import { describe, expect, it } from "vitest";
import {
  detectPlanChanges,
  isCancelledRaceName,
  shouldTreatAsReschedule,
  type EventSnapshot,
} from "@/lib/plan-changes";

function snap(partial: Partial<EventSnapshot> = {}): EventSnapshot {
  return {
    name: "Kbely XCO",
    startDate: "2026-09-06",
    endDate: "2026-09-06",
    status: "scheduled",
    disciplines: ["xco"],
    registrationUrl: null,
    ...partial,
  };
}

describe("isCancelledRaceName", () => {
  it("catches Czech and German cancellations, not fee copy", () => {
    expect(isCancelledRaceName("KPŽ Praha – zrušeno")).toBe(true);
    expect(isCancelledRaceName("Rund um Köln abgesagt")).toBe(true);
    expect(isCancelledRaceName("Zrušení startovného v propozicích")).toBe(false);
  });
});

describe("shouldTreatAsReschedule", () => {
  it("treats a jump of 3+ days as a move, not a span", () => {
    expect(shouldTreatAsReschedule("2026-09-06", "2026-09-13")).toBe(true);
    expect(shouldTreatAsReschedule("2026-09-06", "2026-09-07")).toBe(false);
  });
});

describe("detectPlanChanges", () => {
  it("notifies when the start date moves", () => {
    const changes = detectPlanChanges(snap(), snap({ startDate: "2026-09-13", endDate: "2026-09-13" }));
    expect(changes.map((c) => c.kind)).toEqual(["date"]);
    expect(changes[0]?.payload).toEqual({ from: "2026-09-06", to: "2026-09-13" });
  });

  it("notifies cancellation from status or name", () => {
    expect(detectPlanChanges(snap(), snap({ status: "cancelled" }))[0]?.kind).toBe("cancelled");
    expect(detectPlanChanges(snap(), snap({ name: "Kbely XCO zrušeno" }))[0]?.kind).toBe("cancelled");
    expect(detectPlanChanges(snap({ status: "cancelled" }), snap({ status: "cancelled" }))).toEqual([]);
  });

  it("notifies when a real enter link appears, not a startlist", () => {
    expect(
      detectPlanChanges(snap(), snap({ registrationUrl: "https://njuko.com/kbely" }))[0]?.kind,
    ).toBe("registration");
    expect(
      detectPlanChanges(snap(), snap({ registrationUrl: "https://example.com/startovka.pdf" })),
    ).toEqual([]);
    expect(
      detectPlanChanges(snap(), snap({ status: "registration_open" }))[0]?.kind,
    ).toBe("registration");
  });

  it("notifies a discipline switch, not MTB family expansion", () => {
    expect(detectPlanChanges(snap(), snap({ disciplines: ["enduro"] }))[0]?.kind).toBe("discipline");
    expect(detectPlanChanges(snap(), snap({ disciplines: ["mtb", "xco"] }))).toEqual([]);
    expect(detectPlanChanges(snap(), snap({ disciplines: ["xco", "xcm"] }))).toEqual([]);
  });
});

describe("what a stored change is trusted to say", () => {
  it("knows the kinds it can mail about, and no others", async () => {
    const { isPlanChangeKind } = await import("@/lib/plan-changes");
    expect(["date", "cancelled", "registration", "discipline"].every(isPlanChangeKind)).toBe(true);
    expect(isPlanChangeKind("exploded")).toBe(false);
  });

  it("keeps only the text of a payload", async () => {
    const { stringPayload } = await import("@/lib/plan-changes");
    expect(stringPayload({ from: "2026-10-04", to: "2026-10-11", n: 3, nested: { a: 1 } })).toEqual({ from: "2026-10-04", to: "2026-10-11" });
    expect(stringPayload(null)).toEqual({});
    expect(stringPayload(["x"])).toEqual({});
    expect(stringPayload("text")).toEqual({});
  });
});
