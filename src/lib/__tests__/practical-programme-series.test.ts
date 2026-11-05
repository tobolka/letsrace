import { expect, it } from "vitest";
import { practicalProgramme } from "@/lib/catalog/practical-programme";

const series = { url: "https://x.de/ga.pdf", links: [], text: "crossmania Series 2026 | Generalausschreibung\n31.10.26 #1 crossmania in Prützke\nVeranstalter: Radsportkitz Kloster Lehnin e.V. Rundenlänge: 2,2 km\n08.11.26 #2 crossmania in Strausberg\nVeranstalter: 1. RSC Strausberg Rundenlänge: 2,1 km" };

it("takes the organiser of this round from a series document, without the rest of the row", () => {
  const found = practicalProgramme({ ...series, text: `Stand 8.11.2026\n${series.text}` }, { name: "Crossmania #2 - Strausberg", startDate: "2026-11-08" });
  expect(found.organizer?.value.name).toBe("1. RSC Strausberg");
});

it("names no organiser when no row belongs to this race day", () => {
  const found = practicalProgramme({ ...series, text: `Stand 29.11.2026\n${series.text}` }, { name: "Crossmania #3 - Berlin", startDate: "2026-11-29" });
  expect(found.organizer).toBeUndefined();
});
