import { describe, expect, it } from "vitest";
import { emailMatchesSite } from "@/lib/organizer";
import { organizerEditSchema } from "@/lib/organizer-edit";
import { localePath, toInternalSegments } from "@/lib/localized-paths";

describe("emailMatchesSite", () => {
  it("accepts an address on the race website's own domain", () => {
    expect(emailMatchesSite("info@inveloveritas.at", "https://www.inveloveritas.at/")).toBe(true);
    expect(emailMatchesSite("Jan@Klub.cz", "https://zavod.klub.cz/2027")).toBe(true);
  });

  it("refuses other domains, look-alikes and public mailboxes", () => {
    expect(emailMatchesSite("info@other.cz", "https://www.inveloveritas.at/")).toBe(false);
    expect(emailMatchesSite("info@veritas.at", "https://www.inveloveritas.at/")).toBe(false);
    expect(emailMatchesSite("someone@gmail.com", "https://sites.google.com/view/race")).toBe(false);
    expect(emailMatchesSite("racer@seznam.cz", "https://seznam.cz")).toBe(false);
    expect(emailMatchesSite("info@klub.cz", null)).toBe(false);
    expect(emailMatchesSite(null, "https://klub.cz")).toBe(false);
  });
});

describe("organizerEditSchema", () => {
  it("takes the fields an organiser may change", () => {
    const parsed = organizerEditSchema.safeParse({
      startDate: "2027-06-05",
      endDate: "2027-06-06",
      status: "cancelled",
      registrationUrl: "https://entry.example.com",
      categories: [{ name: "70 km", distanceKm: 70 }],
    });
    expect(parsed.success).toBe(true);
  });

  it("refuses an end before the start, a hidden status and script links", () => {
    expect(organizerEditSchema.safeParse({ startDate: "2027-06-05", endDate: "2027-06-04" }).success).toBe(false);
    expect(organizerEditSchema.safeParse({ status: "hidden" }).success).toBe(false);
    expect(organizerEditSchema.safeParse({ websiteUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("organiser page address", () => {
  it("is translated and maps back", () => {
    expect(localePath("cs", "account/organizer")).toBe("/cs/muj-plan/poradatel");
    expect(toInternalSegments("de", ["mein-plan", "veranstalter"])).toEqual(["account", "organizer"]);
  });
});
