import { describe, expect, it } from "vitest";
import { raceCountWithDates } from "@/components/shell/race-count";

const now = new Date("2026-11-18T12:00:00");

describe("race count with its dates", () => {
  it("says upcoming races in the right form", () => {
    expect(raceCountWithDates(1074, "cs", "2026-11-18", "", now)).toBe("1074 nadcházejících závodů");
    expect(raceCountWithDates(3, "cs", "2026-11-18", "", now)).toBe("3 nadcházející závody");
    expect(raceCountWithDates(1, "sk", "2026-11-18", "", now)).toBe("1 nadchádzajúci pretek");
    expect(raceCountWithDates(5, "en", "2026-11-17", "", now)).toBe("5 upcoming races");
  });

  it("names a window and any date, but not a picked range", () => {
    expect(raceCountWithDates(5, "cs", "2026-11-21", "2026-11-22", now)).toBe("5 závodů tento víkend");
    expect(raceCountWithDates(1122, "cs", "", "", now)).toBe("1122 závodů včetně proběhlých");
    expect(raceCountWithDates(2, "en", "2026-12-01", "", now)).toBe("2 races");
    expect(raceCountWithDates(29, "cs", "2026-11-10", "2026-11-28", now)).toBe("29 závodů");
  });
});
