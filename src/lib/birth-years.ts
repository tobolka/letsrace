/**
 * Birth years for an age category: what a parent actually knows about a
 * child. Racing age is the race year minus the birth year (UCI), so U11 in
 * 2027 is born 2017–2018. A cyclocross winter counts by its second year: a
 * race in November 2026 belongs to the 2027 season.
 */

/** Racing age a category covers; null for an open end. */
export const CATEGORY_AGES: Record<string, [number | null, number | null]> = {
  u7: [null, 6],
  u9: [7, 8],
  u11: [9, 10],
  u13: [11, 12],
  u15: [13, 14],
  u17: [15, 16],
  kids: [null, 10],
  youth: [11, 16],
  junior: [17, 18],
  u23: [19, 22],
  // Elite describes a competition category, not a universal minimum age.
  masters: [35, null],
};

/** The year racing ages are counted from for a race on this date. */
export function referenceYear(startDate: string, disciplines: string[]): number {
  const year = Number(startDate.slice(0, 4));
  const month = Number(startDate.slice(5, 7));
  return disciplines.includes("cx") && month >= 9 ? year + 1 : year;
}

/** "2017–2018", "2008 a starší", or null for a category with no age bounds. */
export function birthYears(category: string, startDate: string, disciplines: string[], locale: string): string | null {
  const ages = CATEGORY_AGES[category];
  if (!ages) return null;
  const year = referenceYear(startDate, disciplines);
  const [young, old] = ages;
  if (young != null && old != null) return `${year - old}–${year - young}`;
  if (old != null) {
    const from = year - old;
    return ({ cs: `${from} a mladší`, sk: `${from} a mladší`, pl: `${from} i młodsi`, de: `${from} und jünger`, en: `${from} and later` } as Record<string, string>)[locale] ?? `${from}+`;
  }
  if (young != null) {
    const to = year - young;
    return ({ cs: `${to} a starší`, sk: `${to} a starší`, pl: `${to} i starsi`, de: `${to} und älter`, en: `${to} and earlier` } as Record<string, string>)[locale] ?? `≤${to}`;
  }
  return null;
}

/**
 * schema.org `typicalAgeRange` for a race's categories: "7-12", or "17-" when
 * an open adult category is among them. Null when nothing bounds the ages.
 */
export function typicalAgeRange(categories: string[]): string | null {
  const known = categories.map((c) => CATEGORY_AGES[c]).filter((a): a is [number | null, number | null] => Boolean(a));
  if (!known.length || known.length !== categories.length) return null;
  const low = Math.min(...known.map(([young]) => young ?? 5));
  const open = known.some(([, old]) => old == null);
  return open ? `${low}-` : `${low}-${Math.max(...known.map(([, old]) => old!))}`;
}
