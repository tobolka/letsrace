import { describe, expect, it } from "vitest";
import { racePlace } from "@/lib/race-place";

const location = (name: string, municipality: string | null = null) => ({ id: "l", name, municipality, countryCode: "CZ", lat: null, lng: null });

describe("race venue evidence", () => {
  it("does not turn an imported title or discipline into a town", () => {
    expect(racePlace({ name: "Moravský pohár", location: location("Moravský pohár", "Moravský pohár") })).toBeNull();
    expect(racePlace({ name: "Cyklokros Chýnov", location: location("Cyklokros") })).toBeNull();
  });
  it("retains a useful municipality and an independently named venue", () => {
    expect(racePlace({ name: "Moravský pohár", location: location("Moravský pohár", "Brno") })).toBe("Brno");
    expect(racePlace({ name: "Jura-Radmarathon", location: location("Sportheim, Lupburg") })).toBe("Lupburg");
    expect(racePlace({ name: "JANEV Cup", location: location("Hlinsko") })).toBe("Hlinsko");
  });
});
