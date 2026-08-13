/** @deprecated Prefer `@/lib/taxonomy` — kept for existing imports. */
export {
  RACE_LEVELS,
  RACE_LEVEL_LABELS as LEVEL_LABELS,
  type RaceLevel,
  inferClassification,
  type UciClass,
  UCI_CLASS_LABELS,
} from "@/lib/taxonomy";

import { inferClassification, type RaceLevel } from "@/lib/taxonomy";

/** Infer ČSC-style class from free text (propozice, title, adapter fields). */
export function inferRaceLevel(text: string): {
  level: RaceLevel;
  classLabel?: string;
  uciClass?: string | null;
} {
  const c = inferClassification({ name: text });
  return {
    level: c.level,
    classLabel: c.classLabel,
    uciClass: c.uciClass,
  };
}
