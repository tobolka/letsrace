import { ageCategoriesFromList } from "@/lib/age-bands";
import { ageCategoryLabel } from "@/lib/i18n/taxonomy";

const fold = (text: string) => text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

/**
 * Our name for an organiser's class, to put beside theirs: "MLADŠÍ ŽÁCI" (U13), "Men Under 23" (U23).
 * By the class's name first, its birth years only when the name says nothing; the umbrella groups
 * only when no exact band is known; nothing when our name only repeats theirs.
 */
export function categoryBandLabel(label: string, birthYears: string | undefined, refYear: number, locale: string): string | null {
  let ages = ageCategoriesFromList([{ name: label }], { refYear });
  if (!ages.length && birthYears) ages = ageCategoriesFromList([{ name: `${label} ${birthYears}` }], { refYear });
  const exact = ages.filter((a) => a !== "kids" && a !== "youth");
  const shown = (exact.length ? exact : ages).map((a) => ageCategoryLabel(a, locale));
  if (!shown.length) return null;
  const text = shown.join(", ");
  return fold(label).includes(fold(text)) ? null : text;
}
