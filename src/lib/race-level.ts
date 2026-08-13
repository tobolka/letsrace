export const RACE_LEVELS = [
  "local",
  "district",
  "regional",
  "national",
  "c1",
  "c2",
  "c3",
  "uci",
  "kids_series",
  "other",
] as const;

export type RaceLevel = (typeof RACE_LEVELS)[number];

export const LEVEL_LABELS: Record<RaceLevel, string> = {
  local: "Local",
  district: "District",
  regional: "Regional",
  national: "National",
  c1: "C1",
  c2: "C2",
  c3: "C3",
  uci: "UCI",
  kids_series: "Kids series",
  other: "Other",
};

/** Infer ČSC-style class from free text (propozice, title, adapter fields). */
export function inferRaceLevel(text: string): { level: RaceLevel; classLabel?: string } {
  const t = text.toLowerCase();
  if (/\buci\b/.test(t)) return { level: "uci", classLabel: "UCI" };
  if (/\bc1\b|čp\s*\/\s*c1|cp\s*\/\s*c1/.test(t)) return { level: "c1", classLabel: "C1" };
  if (/\bc2\b/.test(t)) return { level: "c2", classLabel: "C2" };
  if (/\bc3\b/.test(t)) return { level: "c3", classLabel: "C3" };
  if (/\bmčr\b|mistrovství|cesky pohar|český pohár|\bčp\b|\bcp\b/.test(t)) {
    return { level: "national", classLabel: "ČP / MČR" };
  }
  if (/krajsk|regionál|přebor kraje/.test(t)) return { level: "regional", classLabel: "Regional" };
  if (/okres|district/.test(t)) return { level: "district", classLabel: "District" };
  if (/junior|žák|deti|děti|kids|talent/.test(t)) {
    return { level: "kids_series", classLabel: "Kids" };
  }
  return { level: "local", classLabel: "Local" };
}
