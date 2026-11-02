import { describe, expect, it } from "vitest";
import { localClock, sunTimes } from "@/lib/sun";

const minutes = (clock: string) => {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m;
};

describe("sunTimes", () => {
  it("matches published times for Prague within a few minutes", () => {
    // timeanddate.com: Prague, 7 Nov 2026 — sunrise 6:59, sunset 16:28 (CET).
    const sun = sunTimes(50.08, 14.42, "2026-11-07")!;
    expect(Math.abs(minutes(localClock(sun.rise, "CZ", "en-GB")) - minutes("6:59"))).toBeLessThanOrEqual(3);
    expect(Math.abs(minutes(localClock(sun.set, "CZ", "en-GB")) - minutes("16:28"))).toBeLessThanOrEqual(3);
  });

  it("keeps summer time in June", () => {
    // Prague, 20 Jun 2027 — sunrise 4:52, sunset 21:14 (CEST).
    const sun = sunTimes(50.08, 14.42, "2027-06-20")!;
    expect(Math.abs(minutes(localClock(sun.rise, "CZ", "en-GB")) - minutes("4:52"))).toBeLessThanOrEqual(3);
    expect(Math.abs(minutes(localClock(sun.set, "CZ", "en-GB")) - minutes("21:14"))).toBeLessThanOrEqual(3);
  });

  it("gives nothing where the sun stays up", () => {
    expect(sunTimes(78, 15, "2027-06-20")).toBeNull();
  });
});
