import {
  disciplineFamily,
  eventDisciplineFamily,
  type Discipline,
} from "@/lib/taxonomy";

export { disciplineFamily, eventDisciplineFamily };

/**
 * One hue per discipline family — map pins, list rules, detail header.
 *
 * Six hues spread right around the wheel rather than six neighbours from one
 * ramp. Six cannot all be far apart, so the crowding is put where it costs
 * least: road and MTB are two thirds of the catalogue and sit a third of the
 * wheel apart, while the pair that ends up closest — blue and teal — is road
 * against track, and track is the rarest discipline we carry. Every colour
 * holds at least 3.4:1 against white, which is what the glyph inside the pin
 * is drawn in.
 */
export const DISCIPLINE_FAMILY_COLORS: Record<string, string> = {
  mtb: "#1e9e57",
  road: "#3b6ff6",
  gravel: "#c2661a",
  cx: "#d62c7f",
  track: "#0e7c9b",
  bmx: "#7a5af8",
  other: "#6b7280",
};

export const DISCIPLINE_FAMILY_COLORS_DARK: Record<string, string> = {
  mtb: "#187e46",
  road: "#2f59c5",
  gravel: "#9b5215",
  cx: "#ab2366",
  track: "#0b637c",
  bmx: "#6248c6",
  other: "#565b66",
};

/**
 * One glyph per discipline family, drawn inside the map pin.
 *
 * `other` deliberately has none: a plain dot is the honest answer for a race
 * whose discipline we could not read, and inventing a symbol for it would be
 * worse than saying nothing.
 */
export const DISCIPLINE_FAMILY_ICONS: Record<string, string> = {
  mtb: "/mtb.svg",
  road: "/road.svg",
  gravel: "/gravel.svg",
  cx: "/cyclocros.svg",
  track: "/track.svg",
  bmx: "/bmx.svg",
};

/** The icon id for a race, or "" when its family has no glyph. */
export function disciplineIcon(disciplines: string[] | null | undefined): string {
  const fam = eventDisciplineFamily(disciplines);
  return DISCIPLINE_FAMILY_ICONS[fam] ? fam : "";
}

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
