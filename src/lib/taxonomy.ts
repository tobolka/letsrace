import type { Audience } from "@/lib/domain";

/** Leaf + parent discipline ids stored on events / used in filters. */
export const DISCIPLINES = [
  "mtb",
  "xco",
  "xcc",
  "xcm",
  "dh",
  "enduro",
  "gravel",
  "road",
  "road_race",
  "tt",
  "criterium",
  "cx",
  "track",
  "bmx",
  "other",
] as const;

export type Discipline = (typeof DISCIPLINES)[number];

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  mtb: "MTB",
  xco: "XCO",
  xcc: "XCC",
  xcm: "XCM",
  dh: "Downhill",
  enduro: "Enduro",
  gravel: "Gravel",
  road: "Road",
  road_race: "Road Race",
  tt: "Time Trial",
  criterium: "Criterium",
  cx: "Cyclocross",
  track: "Track",
  bmx: "BMX",
  other: "Other",
};

/** Filter tree — parent selection expands to children (+ parent id). */
export const DISCIPLINE_TREE: {
  id: Discipline;
  label: string;
  children?: { id: Discipline; label: string }[];
}[] = [
  {
    id: "mtb",
    label: "MTB",
    children: [
      { id: "xco", label: "XCO" },
      { id: "xcc", label: "XCC" },
      { id: "xcm", label: "XCM" },
      { id: "dh", label: "Downhill" },
      { id: "enduro", label: "Enduro" },
      { id: "gravel", label: "Gravel" },
    ],
  },
  {
    id: "road",
    label: "Road",
    children: [
      { id: "road_race", label: "Road Race" },
      { id: "tt", label: "Time Trial" },
      { id: "criterium", label: "Criterium" },
    ],
  },
  { id: "cx", label: "Cyclocross" },
  { id: "track", label: "Track" },
  { id: "bmx", label: "BMX" },
  { id: "gravel", label: "Gravel" },
];

const MTB_LEAVES: Discipline[] = ["xco", "xcc", "xcm", "dh", "enduro", "gravel", "mtb"];
const ROAD_LEAVES: Discipline[] = ["road", "road_race", "tt", "criterium"];

export function expandDisciplineFilter(ids: string[]): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    if (id === "mtb") MTB_LEAVES.forEach((d) => out.add(d));
    else if (id === "road") ROAD_LEAVES.forEach((d) => out.add(d));
    else out.add(id);
  }
  return [...out];
}

/** Legacy scraper values → canonical. */
const LEGACY_DISC: Record<string, Discipline> = {
  xc: "xco",
  xco: "xco",
  xcc: "xcc",
  xcm: "xcm",
  mtb: "mtb",
  dh: "dh",
  downhill: "dh",
  enduro: "enduro",
  gravel: "gravel",
  road: "road",
  road_race: "road_race",
  silnice: "road",
  tt: "tt",
  "time trial": "tt",
  criterium: "criterium",
  crit: "criterium",
  cx: "cx",
  cyclocross: "cx",
  cyklokros: "cx",
  track: "track",
  draha: "track",
  bmx: "bmx",
  other: "other",
  mtbo: "other",
  biathlon: "other",
  kids: "other",
};

export function canonicalizeDiscipline(raw: string | null | undefined): Discipline | null {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  return LEGACY_DISC[key] ?? (DISCIPLINES.includes(key as Discipline) ? (key as Discipline) : null);
}

export function canonicalizeDisciplines(raw: string[] | null | undefined): Discipline[] {
  const out: Discipline[] = [];
  const seen = new Set<string>();
  for (const r of raw ?? []) {
    const d = canonicalizeDiscipline(r);
    if (d && d !== "other" && !seen.has(d)) {
      seen.add(d);
      out.push(d);
    } else if (d === "other" && !seen.has("other")) {
      // keep other only if nothing else
    }
  }
  if (!out.length && (raw ?? []).some((r) => canonicalizeDiscipline(r) === "other")) {
    return ["other"];
  }
  return out;
}

export function inferDisciplines(text: string, existing?: string[] | null): Discipline[] {
  const fromExisting = canonicalizeDisciplines(existing);
  const t = text.toLowerCase();
  const found = new Set<Discipline>(fromExisting);

  if (/\bxcc\b/.test(t)) found.add("xcc");
  if (/\bxcm\b|maraton|marathon/.test(t)) found.add("xcm");
  if (/\bxco\b/.test(t)) found.add("xco");
  if (/\bdh\b|downhill|sjezd/.test(t)) found.add("dh");
  if (/\benduro\b/.test(t)) found.add("enduro");
  if (/\bgravel\b/.test(t)) found.add("gravel");
  if (/\bcriterium\b|\bcrit\b|kriterium/.test(t)) found.add("criterium");
  if (/\btt\b|time[\s-]?trial|časovka|casovka|contre[- ]la[- ]montre/.test(t)) found.add("tt");
  if (/\bcx\b|cyclocross|cyklokros|cyclo[- ]cross/.test(t)) found.add("cx");
  if (/\btrack\b|dráha|draha|velodrom/.test(t)) found.add("track");
  if (/\bbmx\b/.test(t)) found.add("bmx");
  if (/\broad[\s-]?race\b|silniční závod|silnicni zavod/.test(t)) found.add("road_race");
  if (/\bmtb\b|horské|horske|cross[\s-]?country|\bxc\b/.test(t) && ![...found].some((d) => MTB_LEAVES.includes(d))) {
    found.add("mtb");
  }
  if (/\broad\b|silnic/.test(t) && ![...found].some((d) => ROAD_LEAVES.includes(d))) {
    found.add("road");
  }

  const list = [...found].filter((d) => d !== "other");
  if (list.length) return list;
  if (fromExisting.includes("other")) return ["other"];
  return fromExisting;
}

export const AGE_CATEGORIES = [
  "kids",
  "youth",
  "junior",
  "u23",
  "elite",
  "masters",
] as const;

export type AgeCategory = (typeof AGE_CATEGORIES)[number];

export const AGE_CATEGORY_LABELS: Record<AgeCategory, string> = {
  kids: "Kids",
  youth: "Youth",
  junior: "Junior",
  u23: "U23",
  elite: "Elite",
  masters: "Masters",
};

export function inferAgeCategories(
  text: string,
  categoryNames?: string[] | null,
): AgeCategory[] {
  const blob = `${text} ${(categoryNames ?? []).join(" ")}`.toLowerCase();
  const found = new Set<AgeCategory>();

  if (/kids|děti|deti|žák|zak|benjam|u\s*7|u\s*9|u\s*11|u\s*13|\bu7\b|\bu9\b|\bu11\b|\bu13\b/.test(blob)) {
    found.add("kids");
  }
  if (/youth|mládež|mladez|kadet|u\s*15|u\s*17|\bu15\b|\bu17\b/.test(blob)) {
    found.add("youth");
  }
  if (/\bjunior|\bjunioři|\bjuniori|\bjuniors?\b/.test(blob)) {
    found.add("junior");
  }
  if (/\bu\s*23\b|\bu23\b/.test(blob)) {
    found.add("u23");
  }
  if (/\belite\b|\belita\b/.test(blob)) {
    found.add("elite");
  }
  if (/\bmasters?\b|\bveteran|\bveterán/.test(blob)) {
    found.add("masters");
  }

  return AGE_CATEGORIES.filter((c) => found.has(c));
}

/** Series that always include a kids / family programme (even if the race title omits it). */
const FAMILY_OR_KIDS_SERIES =
  /\bkolo\s*pro\s*(život|zivot)\b|\bkolopro\b|\btalent\s*cup\b|\bjunior\s*cup\b|\bprima\s*cup\b/i;

/** Kids-first series (Talent Cup, Junior Cup) — not open adult marathons. */
const KIDS_PRIMARY_SERIES = /\btalent\s*cup\b|\bjunior\s*cup\b/i;

export function isFamilyOrKidsSeries(text: string | null | undefined): boolean {
  return Boolean(text && FAMILY_OR_KIDS_SERIES.test(text));
}

export function isKidsPrimarySeries(text: string | null | undefined): boolean {
  return Boolean(text && KIDS_PRIMARY_SERIES.test(text));
}

export function audienceFromAgeCategories(cats: AgeCategory[]): Audience {
  if (!cats.length) return "mixed";
  const hasKids = cats.includes("kids");
  const hasYouth = cats.includes("youth") || cats.includes("junior");
  const hasAdults =
    cats.includes("u23") || cats.includes("elite") || cats.includes("masters");
  const n = [hasKids, hasYouth, hasAdults].filter(Boolean).length;
  if (n > 1) return "mixed";
  if (hasKids) return "kids";
  if (hasYouth) return "youth";
  if (hasAdults) return "adults";
  return "mixed";
}

export const RACE_LEVELS = [
  "local",
  "regional",
  "national",
  "international",
  "world_cup",
  "european_championship",
  "world_championship",
] as const;

export type RaceLevel = (typeof RACE_LEVELS)[number];

export const RACE_LEVEL_LABELS: Record<RaceLevel, string> = {
  local: "Local",
  regional: "Regional",
  national: "National",
  international: "International",
  world_cup: "World Cup",
  european_championship: "European Championship",
  world_championship: "World Championship",
};

export const UCI_CLASSES = ["hc", "c1", "c2", "c3"] as const;
export type UciClass = (typeof UCI_CLASSES)[number];

export const UCI_CLASS_LABELS: Record<UciClass, string> = {
  hc: "HC",
  c1: "C1",
  c2: "C2",
  c3: "C3",
};

const LEGACY_LEVEL: Record<string, RaceLevel> = {
  local: "local",
  district: "regional",
  regional: "regional",
  national: "national",
  international: "international",
  world_cup: "world_cup",
  european_championship: "european_championship",
  world_championship: "world_championship",
  kids_series: "local",
  c1: "national",
  c2: "national",
  c3: "national",
  uci: "international",
  other: "local",
};

export type InferredClassification = {
  disciplines: Discipline[];
  ageCategories: AgeCategory[];
  audience: Audience;
  level: RaceLevel;
  uciClass: UciClass | null;
  classLabel: string;
};

export function inferClassification(opts: {
  name: string;
  placeText?: string;
  seriesName?: string | null;
  seriesSlug?: string | null;
  disciplines?: string[] | null;
  categoryNames?: string[] | null;
  existingLevel?: string | null;
  existingClassLabel?: string | null;
  existingAudience?: string | null;
}): InferredClassification {
  const seriesBlob = `${opts.seriesName ?? ""} ${opts.seriesSlug ?? ""}`;
  const text = `${opts.name} ${opts.placeText ?? ""} ${seriesBlob} ${(opts.categoryNames ?? []).join(" ")} ${opts.existingClassLabel ?? ""}`;
  const t = text.toLowerCase();

  const disciplines = inferDisciplines(text, opts.disciplines);
  const ageCategories = new Set(inferAgeCategories(text, opts.categoryNames));
  if (opts.existingAudience === "kids") ageCategories.add("kids");
  if (opts.existingAudience === "youth") ageCategories.add("youth");

  const familySeries = isFamilyOrKidsSeries(`${opts.name} ${seriesBlob}`);
  const kidsPrimary = isKidsPrimarySeries(`${opts.name} ${seriesBlob}`);
  if (familySeries || kidsPrimary) ageCategories.add("kids");
  // Open family series (Kolo pro život) also have adult hobby fields
  if (familySeries && !kidsPrimary) {
    if (![...ageCategories].some((c) => c === "elite" || c === "masters" || c === "u23")) {
      ageCategories.add("masters");
    }
  }

  const ageList = AGE_CATEGORIES.filter((c) => ageCategories.has(c));
  let audience = ageList.length
    ? audienceFromAgeCategories(ageList)
    : ((opts.existingAudience as Audience) || "mixed");
  if (kidsPrimary) audience = "kids";
  else if (familySeries) audience = "mixed";

  let uciClass: UciClass | null = null;
  if (/\bhc\b|hors[\s-]?categorie|hors catégorie/.test(t)) uciClass = "hc";
  else if (/\bc1\b|čp\s*\/\s*c1|cp\s*\/\s*c1/.test(t)) uciClass = "c1";
  else if (/\bc2\b/.test(t)) uciClass = "c2";
  else if (/\bc3\b/.test(t)) uciClass = "c3";
  else if (opts.existingLevel === "c1" || opts.existingLevel === "c2" || opts.existingLevel === "c3") {
    uciClass = opts.existingLevel;
  } else if (opts.existingClassLabel && /^[hcC][123]?$/i.test(opts.existingClassLabel.trim())) {
    const cl = opts.existingClassLabel.trim().toLowerCase();
    if (cl === "hc" || cl === "c1" || cl === "c2" || cl === "c3") uciClass = cl;
  }

  let level: RaceLevel = "local";
  if (/world\s*championship|mistrovství světa|mistrovstvi sveta|\bmw\b|\bwch\b|\bms\b/.test(t)) {
    level = "world_championship";
  } else if (
    /european\s*championship|mistrovství evropy|mistrovstvi evropy|\bech\b|\bme\b/.test(t)
  ) {
    level = "european_championship";
  } else if (/world\s*cup|světový pohár|svetovy pohar|\bwc\b|\bsp\b/.test(t)) {
    level = "world_cup";
  } else if (/international|mezinárodní|mezinarodni|\buci\b/.test(t) || uciClass) {
    level = uciClass ? "national" : "international";
    if (/\buci\b/.test(t) && !uciClass) level = "international";
    if (uciClass && /international|mezinárodní|mezinarodni|\buci\b/.test(t)) level = "international";
  } else if (/\bmčr\b|mistrovství|cesky pohar|český pohár|\bčp\b|\bcp\b|national/.test(t)) {
    level = "national";
  } else if (/krajsk|regionál|regional|přebor kraje|prebor kraje|okres|district/.test(t)) {
    level = "regional";
  } else if (opts.existingLevel && LEGACY_LEVEL[opts.existingLevel]) {
    level = LEGACY_LEVEL[opts.existingLevel];
  }

  // UCI class bumps vague local → national at minimum
  if (uciClass && level === "local") level = "national";

  const classLabel = uciClass
    ? UCI_CLASS_LABELS[uciClass]
    : RACE_LEVEL_LABELS[level];

  return {
    disciplines,
    ageCategories: ageList,
    audience: ageList.length ? audience : opts.existingAudience === "adults" ? "adults" : audience,
    level,
    uciClass,
    classLabel,
  };
}
