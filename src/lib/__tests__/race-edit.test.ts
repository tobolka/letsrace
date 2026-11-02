import { describe, expect, it } from "vitest";
import { raceCreateSchema, raceEditSchema } from "@/lib/race-edit";

const race = {
  name: "Hůrka Cross",
  startDate: "2027-11-06",
  disciplines: ["cx"],
  place: { name: "Hůrka u Jistebnice", lat: 49.47, lng: 14.55, countryCode: "cz" },
};

describe("race form", () => {
  it("creates a race from name, date, place and discipline", () => {
    const parsed = raceCreateSchema.safeParse(race);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.place.countryCode).toBe("CZ");
  });

  it("refuses a new race without a place, a discipline or a sane date range", () => {
    expect(raceCreateSchema.safeParse({ ...race, place: undefined }).success).toBe(false);
    expect(raceCreateSchema.safeParse({ ...race, disciplines: [] }).success).toBe(false);
    expect(raceCreateSchema.safeParse({ ...race, disciplines: ["skateboard"] }).success).toBe(false);
    expect(raceCreateSchema.safeParse({ ...race, endDate: "2027-11-05" }).success).toBe(false);
  });

  it("edits the same fields an organiser may change", () => {
    expect(raceEditSchema.safeParse({ registrationUrl: "https://entry.example.com", categories: [{ name: "Elite", distanceKm: 60 }] }).success).toBe(true);
    expect(raceEditSchema.safeParse({ status: "hidden" }).success).toBe(false);
  });
});
