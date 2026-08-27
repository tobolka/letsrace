import {
  disciplineFamily,
  eventDisciplineFamily,
  type Discipline,
} from "@/lib/taxonomy";

export { disciplineFamily, eventDisciplineFamily };

/** One hue per discipline family — map pins, list dots, detail header. */
export const DISCIPLINE_FAMILY_COLORS: Record<string, string> = {
  mtb: "#16a34a",
  road: "#2563eb",
  gravel: "#d97706",
  cx: "#c2410c",
  track: "#7c3aed",
  bmx: "#e11d48",
  para: "#0891b2",
  other: "#78716c",
};

export const DISCIPLINE_FAMILY_COLORS_DARK: Record<string, string> = {
  mtb: "#15803d",
  road: "#1d4ed8",
  gravel: "#b45309",
  cx: "#9a3412",
  track: "#6d28d9",
  bmx: "#be123c",
  para: "#0e7490",
  other: "#57534e",
};

export function disciplineColor(disciplines: string[] | null | undefined): string {
  const fam = eventDisciplineFamily(disciplines);
  return DISCIPLINE_FAMILY_COLORS[fam] ?? DISCIPLINE_FAMILY_COLORS.other;
}

export function disciplineColorDark(disciplines: string[] | null | undefined): string {
  const fam = eventDisciplineFamily(disciplines);
  return DISCIPLINE_FAMILY_COLORS_DARK[fam] ?? DISCIPLINE_FAMILY_COLORS_DARK.other;
}

export function familyColor(id: string | null | undefined): string {
  return DISCIPLINE_FAMILY_COLORS[disciplineFamily(id)] ?? DISCIPLINE_FAMILY_COLORS.other;
}

export function primaryDiscipline(disciplines: string[] | null | undefined): Discipline | null {
  const d = disciplines?.[0];
  return (d as Discipline) || null;
}

/**
 * 16×16 glyph markup (currentColor). Distinct silhouettes so MTB vs road
 * is readable on a ~20px map pin, not color-only.
 */
export const DISCIPLINE_FAMILY_GLYPHS: Record<string, string> = {
  mtb: `<path fill="currentColor" d="M1 13.4 5.4 5.2 7.7 9.2 10.7 4.2 15 13.4Z"/>`,
  road: `<circle cx="4.1" cy="11.1" r="2.35" fill="none" stroke="currentColor" stroke-width="1.55"/><circle cx="12" cy="11.1" r="2.35" fill="none" stroke="currentColor" stroke-width="1.55"/><path fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" d="M4.1 11.1 6.7 6.2h4.1L12 11.1M6.7 6.2 5.5 11.1M8.6 6.2 7.5 3.2h2.6"/>`,
  gravel: `<circle cx="4.1" cy="10.4" r="2.2" fill="none" stroke="currentColor" stroke-width="1.45"/><circle cx="12" cy="10.4" r="2.2" fill="none" stroke="currentColor" stroke-width="1.45"/><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M4.1 10.4 6.6 5.8h4.1L12 10.4M6.6 5.8 5.5 10.4M8.5 5.8 7.5 3h2.5M2.2 14.2q5.8-2 11.6 0"/>`,
  cx: `<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="m3.2 3.2 9.6 9.6M12.8 3.2 3.2 12.8"/>`,
  track: `<ellipse cx="8" cy="8" rx="6.3" ry="3.5" fill="none" stroke="currentColor" stroke-width="1.55"/><ellipse cx="8" cy="8" rx="3.1" ry="1.55" fill="none" stroke="currentColor" stroke-width="1.3"/>`,
  bmx: `<circle cx="4.4" cy="11.3" r="2.05" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="11.5" cy="11.3" r="2.05" fill="none" stroke="currentColor" stroke-width="1.5"/><path fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" d="M4.4 11.3 7.1 5h4.4L11.5 11.3M7.1 5 6.2 11.3M7.1 5V2.4h3"/>`,
  para: `<circle cx="6.6" cy="9.4" r="3.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" d="M6.6 5.9V2.8h4.2M6.6 9.4h6.2"/>`,
  other: `<path fill="currentColor" d="M8 2.3 13.7 8 8 13.7 2.3 8Z"/>`,
};

export function familyGlyph(id: string | null | undefined): string {
  const fam = disciplineFamily(id);
  return DISCIPLINE_FAMILY_GLYPHS[fam] ?? DISCIPLINE_FAMILY_GLYPHS.other;
}

export function eventFamilyGlyph(disciplines: string[] | null | undefined): string {
  const fam = eventDisciplineFamily(disciplines);
  return DISCIPLINE_FAMILY_GLYPHS[fam] ?? DISCIPLINE_FAMILY_GLYPHS.other;
}
