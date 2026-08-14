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
