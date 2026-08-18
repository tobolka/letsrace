import { describe, expect, it } from "vitest";
import { disciplinesMatch, matchAlert, type AlertCandidate } from "@/lib/race-alerts";

const prague = {
  lat: 50.0755,
  lng: 14.4378,
  radiusKm: 80,
  disciplines: [] as string[],
  createdAt: "2026-08-01T00:00:00.000Z",
};

function event(partial: Partial<AlertCandidate> & Pick<AlertCandidate, "id" | "name">): AlertCandidate {
  return {
    slug: partial.slug ?? partial.id,
    startDate: "2026-09-06",
    disciplines: ["xco"],
    status: "scheduled",
    visibility: "public",
    createdAt: "2026-08-18T10:00:00.000Z",
    lat: 50.08,
    lng: 14.45,
    place: "Praha",
    countryCode: "CZ",
    ...partial,
  };
}

describe("disciplinesMatch", () => {
  it("empty alert means any discipline", () => {
    expect(disciplinesMatch(["road_race"], [])).toBe(true);
  });

  it("expands MTB to XCO", () => {
    expect(disciplinesMatch(["xco"], ["mtb"])).toBe(true);
    expect(disciplinesMatch(["road_race"], ["mtb"])).toBe(false);
  });
});

describe("matchAlert", () => {
  const today = "2026-08-18";

  it("matches a new nearby MTB race", () => {
    const hit = matchAlert({ ...prague, disciplines: ["mtb"] }, event({ id: "a", name: "Kbely XCO" }), today);
    expect(hit?.km).toBeLessThan(20);
  });

  it("rejects races beyond the radius", () => {
    expect(
      matchAlert(
        prague,
        event({ id: "b", name: "Brno", lat: 49.2, lng: 16.6 }),
        today,
      ),
    ).toBeNull();
  });

  it("rejects awards nights and past dates", () => {
    expect(
      matchAlert(prague, event({ id: "c", name: "Slavnostní večer" }), today),
    ).toBeNull();
    expect(
      matchAlert(prague, event({ id: "d", name: "Old", startDate: "2026-08-01" }), today),
    ).toBeNull();
  });

  it("does not backfill races that existed before the alert", () => {
    expect(
      matchAlert(
        prague,
        event({ id: "e", name: "Old pin", createdAt: "2026-07-01T00:00:00.000Z" }),
        today,
      ),
    ).toBeNull();
  });

  it("skips races on busy weekdays", () => {
    // 2026-09-06 is Sunday
    expect(matchAlert(prague, event({ id: "sun", name: "Kbely XCO" }), today, [7])).toBeNull();
    expect(matchAlert(prague, event({ id: "sun", name: "Kbely XCO" }), today, [6])?.event.id).toBe(
      "sun",
    );
  });
});
