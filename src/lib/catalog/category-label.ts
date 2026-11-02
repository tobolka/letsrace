import type { ParsedCategory } from "@/lib/domain";

/** Only literal units and age phrases; a class number, U-code or birth year is not an age. */
export function categoryFromLabel(name: string): ParsedCategory {
  const category: ParsedCategory = { name: name.trim() };
  const distances = [...name.matchAll(/\b(\d+(?:[.,]\d+)?)\s*km\b/gi)];
  if (distances.length === 1) {
    const km = Number(distances[0][1].replace(",", "."));
    if (km > 0 && km <= 2000) category.distanceKm = km;
  }
  const ages = name.match(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(?:let|rokov|lat|years?|jahre|anni|ans)\b/i);
  if (ages && Number(ages[1]) <= Number(ages[2])) {
    category.ageMin = Number(ages[1]); category.ageMax = Number(ages[2]);
  }
  return category;
}
