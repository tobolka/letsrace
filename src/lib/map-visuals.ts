import {
  disciplineFamily,
  eventDisciplineFamily,
  type Discipline,
} from "@/lib/taxonomy";

export { disciplineFamily, eventDisciplineFamily };

/**
 * One hue per discipline family — map pins, list rules, detail header.
 *
 * Built in OKLCH rather than picked by eye: every family sits at the same
 * lightness and the same chroma, and only the hue moves. That is what makes
 * six colours read as one set — none of them shouts louder than the rest, and
 * a green pin next to a blue one differs in nothing but the thing it is
 * supposed to differ in.
 *
 * Six hues cannot all be far apart, so the crowding is put where it costs
 * least. Road and MTB are two thirds of the catalogue, so they sit a third of
 * the wheel apart; the closest pair is road against track, and track is the
 * rarest discipline we carry. At this lightness every colour holds at least
 * 3.5:1 against white, which is what the glyph inside the pin is drawn in.
 */
export const DISCIPLINE_FAMILY_COLORS: Record<string, string> = {
  mtb: "#009447",
  road: "#3778d7",
  gravel: "#ba5e00",
  cx: "#c54868",
  track: "#0092a7",
  bmx: "#975ac0",
  other: "#757b83",
};

/** The same wheel eight points of lightness down, worn by the selected pin. */
export const DISCIPLINE_FAMILY_COLORS_DARK: Record<string, string> = {
  mtb: "#007b2f",
  road: "#1d60bc",
  gravel: "#a04600",
  cx: "#a92e52",
  track: "#007a8e",
  bmx: "#7f42a6",
  other: "#5e646c",
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

/** Which baked pin a race wears — its family, glyph or no glyph. */
export function disciplineIcon(disciplines: string[] | null | undefined): string {
  return eventDisciplineFamily(disciplines);
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
