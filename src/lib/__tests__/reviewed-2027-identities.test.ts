import { expect, it } from "vitest";
import { reviewed2027Identity } from "@/lib/watcher/reviewed-2027-identities";

it("resolves stale and current Mediofondo listings to the preserved competition", () => {
  for (const name of ["DEKOM Sudety Tour MEDIO FONDO 2027", "DEKOM Sudety Tour MEDIO FONDO RR 85 km"]) {
    expect(reviewed2027Identity({ name, startDate: "2027-05-10" })).toMatchObject({ canonicalId: "a18b06a4-03b7-4b7c-a0f4-ece6a475441f", startDate: "2027-05-09" });
  }
});
it("resolves both Hilly Stage names independently of the source identifier", () => {
  for (const name of ["L'Etape Czech Republic – Hilly Stage 2027", "L’Etape Czech Republic by Tour de France 2027"]) {
    expect(reviewed2027Identity({ name, startDate: "2027-06-19" })?.canonicalId).toBe("c04842aa-824c-4879-af74-3013d5c47681");
  }
});
it("rejects the Grizzlyman cycling segment even when labelled Bike", () => {
  for (const startDate of ["2027-05-22", "2027-05-29"]) {
    expect(reviewed2027Identity({ name: "Grizzlyman – Bike 2027", startDate })).toEqual({ reject: true });
  }
});
it("leaves other editions, countries, stages and Sudety competitions alone", () => {
  for (const event of [
    { name: "Grizzlyman Bike", startDate: "2028-05-22" },
    { name: "Grizzlyman Bike", startDate: "2027-05-22", countryHint: "US" },
    { name: "L'Etape Czech Republic – Flat Stage", startDate: "2027-06-19" },
    { name: "Dekom System Sudety Tour 2027", startDate: "2027-05-08" },
    { name: "DEKOM Sudety Tour GRAN FONDO", startDate: "2027-05-09" },
  ]) expect(reviewed2027Identity(event)).toBeUndefined();
});
