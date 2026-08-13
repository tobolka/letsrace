import type { Discipline, RaceLevel } from "@/lib/taxonomy";

/** Race-level colors for map dots + list accents. Keep flat and readable. */
export const LEVEL_COLORS: Record<RaceLevel, string> = {
  local: "#16a34a",
  regional: "#2563eb",
  national: "#7c3aed",
  international: "#ea580c",
  world_cup: "#dc2626",
  european_championship: "#ca8a04",
  world_championship: "#ca8a04",
};

export const LEVEL_COLORS_DARK: Record<RaceLevel, string> = {
  local: "#15803d",
  regional: "#1d4ed8",
  national: "#6d28d9",
  international: "#c2410c",
  world_cup: "#b91c1c",
  european_championship: "#a16207",
  world_championship: "#a16207",
};

export function levelColor(level: string | null | undefined): string {
  const key = (level || "local") as RaceLevel;
  return LEVEL_COLORS[key] ?? LEVEL_COLORS.local;
}

export function levelColorDark(level: string | null | undefined): string {
  const key = (level || "local") as RaceLevel;
  return LEVEL_COLORS_DARK[key] ?? LEVEL_COLORS_DARK.local;
}

export function primaryDiscipline(disciplines: string[] | null | undefined): Discipline | null {
  const d = disciplines?.[0];
  return (d as Discipline) || null;
}
