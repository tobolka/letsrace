import type { Locale } from "@/lib/i18n/messages";
import { isDistancePlaceholder } from "@/lib/category-distance";

const YEARS: Record<Locale, string> = { en: "years", cs: "let", sk: "rokov", pl: "lat", de: "Jahre" };

/**
 * What a published category adds to its own name: the distance and the ages,
 * as "120 km · 15–18 let". A distance the name already says ("600 km") is not
 * repeated, and a category with neither gives "".
 */
export function categoryDetail(
  category: { name: string; distanceKm: number | null; ageMin: number | null; ageMax: number | null },
  locale: Locale,
): string {
  const parts: string[] = [];
  const km = category.distanceKm;
  if (km != null && km > 0 && !/\d\s*km\b/i.test(category.name)) {
    parts.push(`${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(km)} km`);
  }
  const { ageMin: min, ageMax: max } = category;
  const years = YEARS[locale] ?? YEARS.en;
  if (min != null && max != null) parts.push(min === max ? `${min} ${years}` : `${min}–${max} ${years}`);
  else if (min != null) parts.push(`${min}+ ${years}`);
  else if (max != null) parts.push(`≤ ${max} ${years}`);
  return parts.join(" · ");
}

/** The categories with exact repeats removed — a duathlon's two "2.5 km" runs are one line to a reader. */
export function distinctCategories<T extends { name: string; distanceKm: number | null; ageMin: number | null; ageMax: number | null }>(
  categories: T[],
): T[] {
  const seen = new Set<string>();
  return categories.filter((c) => {
    if (isDistancePlaceholder(c.name)) return false;
    const key = [c.name.trim().toLowerCase(), c.distanceKm, c.ageMin, c.ageMax].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
