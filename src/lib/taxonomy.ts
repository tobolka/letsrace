import type { Audience } from "@/lib/domain";

/**
 * Controlled vocabulary for Startline.
 *
 * `disciplines` on an event is a text[] of these ids (parents + leaves).
 * Filters expand a parent (mtb, road) to its leaves. Do not introduce a
 * separate formats table — leaf ids *are* the formats (xco, tt, gran_fondo).
 */

export const DISCIPLINES = [
  "mtb",
  "xco",
  "xcc",
  "xce",
  "xcm",
  "dh",
  "enduro",
  "gravel",
  "road",
  "road_race",
  "tt",
  "criterium",
  "hill_climb",
  "gran_fondo",
  "cx",
  "track",
  "bmx",
  "para",
  "other",
] as const;

export type Discipline = (typeof DISCIPLINES)[number];

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  mtb: "MTB",
  xco: "XCO",
  xcc: "XCC",
  xce: "XCE",
  xcm: "XCM",
  dh: "Downhill",
  enduro: "Enduro",
  gravel: "Gravel",
  road: "Road",
  road_race: "Road Race",
  tt: "Time Trial",
  criterium: "Criterium",
  hill_climb: "Hill Climb",
  gran_fondo: "Gran Fondo",
  cx: "Cyclocross",
  track: "Track",
  bmx: "BMX",
  para: "Para-cycling",
  other: "Other",
};

/** High-level families used as filter parents. Gravel is a sibling of MTB, not a child. */
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
      { id: "xce", label: "XCE" },
      { id: "xcm", label: "XCM" },
      { id: "dh", label: "Downhill" },
      { id: "enduro", label: "Enduro" },
    ],
  },
  {
    id: "road",
    label: "Road",
    children: [
      { id: "road_race", label: "Road Race" },
      { id: "tt", label: "Time Trial" },
      { id: "criterium", label: "Criterium" },
      { id: "hill_climb", label: "Hill Climb" },
      { id: "gran_fondo", label: "Gran Fondo" },
    ],
  },
  { id: "gravel", label: "Gravel" },
  { id: "cx", label: "Cyclocross" },
  { id: "track", label: "Track" },
  { id: "bmx", label: "BMX" },
  { id: "para", label: "Para-cycling" },
];

const MTB_LEAVES: Discipline[] = ["xco", "xcc", "xce", "xcm", "dh", "enduro", "mtb"];
const ROAD_LEAVES: Discipline[] = [
  "road",
  "road_race",
  "tt",
  "criterium",
  "hill_climb",
  "gran_fondo",
];

/** Leaf ids stored also in `formats` for display / finer queries. */
export const FORMAT_IDS = [
  "xco",
  "xcc",
  "xce",
  "xcm",
  "dh",
  "enduro",
  "road_race",
  "tt",
  "criterium",
  "hill_climb",
  "gran_fondo",
] as const;

export type Format = (typeof FORMAT_IDS)[number];

export function formatsFromDisciplines(ids: Discipline[]): Format[] {
  const set = new Set<string>(FORMAT_IDS);
  return ids.filter((d): d is Format => set.has(d));
}

export function expandDisciplineFilter(ids: string[]): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    if (id === "mtb") MTB_LEAVES.forEach((d) => out.add(d));
    else if (id === "road") ROAD_LEAVES.forEach((d) => out.add(d));
    else out.add(id);
  }
  return [...out];
}

const MTB_RACE = new Set<string>(["mtb", "xco", "xcc", "xce", "dh", "enduro"]);
const FAMILY_FILTERS = new Set<string>(["mtb", "road", "gravel", "cx", "track", "bmx", "para"]);

export function disciplineFamily(id: string | null | undefined): Discipline {
  if (!id) return "other";
  if (MTB_LEAVES.includes(id as Discipline)) return "mtb";
  if (ROAD_LEAVES.includes(id as Discipline)) return "road";
  if (id === "gravel" || id === "cx" || id === "track" || id === "bmx" || id === "para") {
    return id;
  }
  return "other";
}

/**
 * Drop XCM that was inferred from "marathon" on a road/gravel event.
 * Keep XCM when the event also has a real MTB format.
 */
export function canonicalEventDisciplines(raw: string[] | null | undefined): Discipline[] {
  const ids = canonicalizeDisciplines(raw);
  const hasRealMtb = ids.some((d) => MTB_RACE.has(d));
  const hasRoad = ids.some((d) => disciplineFamily(d) === "road");
  const hasGravel = ids.includes("gravel");
  const stripped = ids.filter((d) => {
    if (d === "xcm" && (hasRoad || hasGravel) && !hasRealMtb) return false;
    return true;
  });
  const fam = eventDisciplineFamily(stripped);
  return [...stripped].sort((a, b) => {
    const af = disciplineFamily(a) === fam ? 0 : 1;
    const bf = disciplineFamily(b) === fam ? 0 : 1;
    return af - bf;
  });
}

/** Dominant family for color + family filters — not "whatever is first in the array". */
export function eventDisciplineFamily(disciplines: string[] | null | undefined): Discipline {
  const ids = canonicalizeDisciplines(disciplines);
  const hasRealMtb = ids.some((d) => MTB_RACE.has(d));
  const hasRoad = ids.some((d) => disciplineFamily(d) === "road");
  const hasGravel = ids.includes("gravel");
  const cleaned = ids.filter((d) => {
    if (d === "xcm" && (hasRoad || hasGravel) && !hasRealMtb) return false;
    return true;
  });
  const families = cleaned.map((d) => disciplineFamily(d)).filter((f) => f !== "other");
  if (!families.length) return "other";
  const unique = new Set(families);
  if (unique.size === 1) return families[0]!;
  if (unique.has("mtb") && hasRealMtb) return "mtb";
  if (unique.has("gravel")) return "gravel";
  if (unique.has("cx")) return "cx";
  return families[0]!;
}

/** Family chips match the dominant family so a road radmarathon is not an MTB pin. */
export function matchesDisciplineFilter(
  disciplines: string[] | null | undefined,
  selected: string[],
): boolean {
  if (!selected.length) return true;
  const ids = canonicalEventDisciplines(disciplines);
  const fam = eventDisciplineFamily(ids);
  return selected.some((s) => {
    if (FAMILY_FILTERS.has(s)) return fam === s;
    return (ids as string[]).includes(s);
  });
}

const LEGACY_DISC: Record<string, Discipline> = {
  xc: "xco",
  xco: "xco",
  xcc: "xcc",
  xce: "xce",
  xcm: "xcm",
  marathon: "xcm",
  maraton: "xcm",
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
  casovka: "tt",
  časovka: "tt",
  criterium: "criterium",
  crit: "criterium",
  hill_climb: "hill_climb",
  "hill climb": "hill_climb",
  gran_fondo: "gran_fondo",
  "gran fondo": "gran_fondo",
  sportive: "gran_fondo",
  cx: "cx",
  cyclocross: "cx",
  cyklokros: "cx",
  track: "track",
  draha: "track",
  bmx: "bmx",
  para: "para",
  "para-cycling": "para",
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

  if (/\bxce\b|eliminat/.test(t)) found.add("xce");
  if (/\bxcc\b/.test(t)) found.add("xcc");
  if (/\bxcm\b/.test(t)) found.add("xcm");
  else if (/\bmaraton|marathon/.test(t) && isMtbMarathon(t)) found.add("xcm");
  if (/\bxco\b/.test(t)) found.add("xco");
  if (/\bdh\b|downhill|sjezd/.test(t)) found.add("dh");
  if (/\benduro\b/.test(t)) found.add("enduro");
  if (/\bgravel\b/.test(t)) found.add("gravel");
  if (/\bgran[\s-]?fondo\b|\bsportive\b|\bcyclosport/.test(t)) found.add("gran_fondo");
  if (/\bhill[\s-]?climb\b|vrchař|vrchar|côte[\s-]?spéciale/.test(t)) found.add("hill_climb");
  if (/\bcriterium\b|\bcrit\b|kriterium/.test(t)) found.add("criterium");
  if (/\btt\b|time[\s-]?trial|časovka|casovka|contre[- ]la[- ]montre/.test(t)) found.add("tt");
  if (/\bcx\b|cyclocross|cyklokros|cyclo[- ]cross/.test(t)) found.add("cx");
  if (/\btrack\b|dráha|draha|velodrom/.test(t) && !/short\s*track/.test(t)) found.add("track");
  if (/\bbmx\b/.test(t)) found.add("bmx");
  if (/\bpara[\s-]?cycl|\bparacycling\b/.test(t)) found.add("para");
  if (/\broad[\s-]?race\b|silniční závod|silnicni zavod/.test(t)) found.add("road_race");
  if (
    /\bmtb\b|horské|horske|cross[\s-]?country|\bxc\b/.test(t) &&
    ![...found].some((d) => MTB_LEAVES.includes(d))
  ) {
    found.add("mtb");
  }
  if (/\broad\b|silnic/.test(t) && ![...found].some((d) => ROAD_LEAVES.includes(d))) {
    found.add("road");
  }

  const list = [...found].filter((d) => d !== "other");
  if (list.length) return canonicalEventDisciplines(list);
  if (fromExisting.includes("other")) return ["other"];
  return fromExisting;
}

function isMtbMarathon(t: string): boolean {
  if (/\bmtb\b|\bxco\b|\bxcc\b|\bxc\b|horské|horske|cross[\s-]?country/.test(t)) return true;
  if (/\bgravel\b/.test(t)) return false;
  if (
    /radmarathon|rad[\s-]?marathon|cycling[\s-]?marathon|rennrad|gran[\s-]?fondo|sportive|jedermann/.test(
      t,
    )
  ) {
    return false;
  }
  if (/\broad\b|silnic/.test(t)) return false;
  return true;
}

/** Stored on events.age_categories. U-bands are the precise kids/youth splits. */
export const AGE_CATEGORIES = [
  "u7",
  "u9",
  "u11",
  "u13",
  "u15",
  "u17",
  "kids",
  "youth",
  "junior",
  "u23",
  "elite",
  "amateur",
  "masters",
] as const;

export type AgeCategory = (typeof AGE_CATEGORIES)[number];

export const AGE_CATEGORY_LABELS: Record<AgeCategory, string> = {
  u7: "U7",
  u9: "U9",
  u11: "U11",
  u13: "U13",
  u15: "U15",
  u17: "U17",
  kids: "Kids",
  youth: "Youth",
  junior: "Junior",
  u23: "U23",
  elite: "Elite",
  amateur: "Amateur",
  masters: "Masters",
};

/** Filter chips — kids/youth expand to U-bands so mixed series still match. */
export const AGE_CATEGORY_FILTERS: {
  id: AgeCategory;
  label: string;
  expands: AgeCategory[];
}[] = [
  { id: "kids", label: "Kids", expands: ["kids", "u7", "u9", "u11", "u13"] },
  { id: "youth", label: "Youth", expands: ["youth", "u15", "u17"] },
  { id: "junior", label: "Junior", expands: ["junior"] },
  { id: "u23", label: "U23", expands: ["u23"] },
  { id: "elite", label: "Elite", expands: ["elite"] },
  { id: "amateur", label: "Amateur", expands: ["amateur"] },
  { id: "masters", label: "Masters", expands: ["masters"] },
];

export function expandAgeCategoryFilter(ids: string[]): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    const group = AGE_CATEGORY_FILTERS.find((g) => g.id === id);
    if (group) group.expands.forEach((x) => out.add(x));
    else out.add(id);
  }
  return [...out];
}

/** Match Category chips to stored age_categories — never treat unknown mixed as Kids. */
export function matchesAgeCategoryFilter(
  event: { audience?: string | null; ageCategories?: string[] | null },
  selected: string[],
): boolean {
  if (!selected.length) return true;
  const expanded = new Set(expandAgeCategoryFilter(selected));
  const ages = event.ageCategories ?? [];
  if (ages.some((c) => expanded.has(c))) return true;
  const audience = (event.audience || "").toLowerCase();
  if (!ages.length && selected.includes("kids") && audience === "kids") return true;
  if (!ages.length && selected.includes("youth") && audience === "youth") return true;
  return false;
}

/** Labels aligned with Category filter chips. Empty = we don't know — don't guess. */
export function formatEventCategoryLabel(
  event: { audience?: string | null; ageCategories?: string[] | null },
  audienceLabels: { kids: string; youth: string; adults: string },
): string {
  const ages = event.ageCategories ?? [];
  if (ages.length) {
    const chips: string[] = [];
    for (const f of AGE_CATEGORY_FILTERS) {
      if (f.expands.some((x) => ages.includes(x))) chips.push(f.label);
    }
    return chips.join(" · ");
  }
  const a = (event.audience || "").toLowerCase();
  if (a === "kids") return audienceLabels.kids;
  if (a === "youth") return audienceLabels.youth;
  if (a === "adults") return audienceLabels.adults;
  return "";
}

export function inferAgeCategories(
  text: string,
  categoryNames?: string[] | null,
): AgeCategory[] {
  const blob = `${text} ${(categoryNames ?? []).join(" ")}`.toLowerCase();
  const found = new Set<AgeCategory>();

  const addU = (n: AgeCategory) => {
    found.add(n);
    if (n === "u7" || n === "u9" || n === "u11" || n === "u13") found.add("kids");
    if (n === "u15" || n === "u17") found.add("youth");
  };

  if (/\bu\s*7\b|\bu7\b/.test(blob)) addU("u7");
  if (/\bu\s*9\b|\bu9\b/.test(blob)) addU("u9");
  if (/\bu\s*11\b|\bu11\b/.test(blob)) addU("u11");
  if (/\bu\s*13\b|\bu13\b/.test(blob)) addU("u13");
  if (/\bu\s*15\b|\bu15\b/.test(blob)) addU("u15");
  if (/\bu\s*17\b|\bu17\b/.test(blob)) addU("u17");

  if (
    /kids|děti|deti|žák|zak|benjam|naděj|nadej/.test(blob) ||
    found.has("u7") ||
    found.has("u9") ||
    found.has("u11") ||
    found.has("u13")
  ) {
    found.add("kids");
  }
  if (/youth|mládež|mladez|kadet/.test(blob) || found.has("u15") || found.has("u17")) {
    found.add("youth");
  }
  if (/\bjunior|\bjunioři|\bjuniori|\bjuniors?\b/.test(blob)) found.add("junior");
  if (/\bu\s*23\b|\bu23\b/.test(blob)) found.add("u23");
  if (/\belite\b|\belita\b/.test(blob)) found.add("elite");
  if (/\bamateur\b|\bhobby\b|\bopen\b|\bjedermann\b|\bgran[\s-]?fondo\b|\bsportive\b/.test(blob)) {
    found.add("amateur");
  }
  if (/\bmasters?\b|\bveteran|\bveterán/.test(blob)) found.add("masters");

  return AGE_CATEGORIES.filter((c) => found.has(c));
}

const FAMILY_OR_KIDS_SERIES =
  /\bvan\s*gillern\b|\bgillern\s*cup\b|\bkon[aá]rovick[yý]\s*ko[rř]en\b|\bk-koren\b|\bkolo\s*pro\s*(život|zivot)\b|\bkolopro\b|\btalent\s*cup\b|\bjunior\s*cup\b|\bprima\s*cup\b|\bkids[\s-]*cup\b|\bvpace\s*kids\b|\bcube\s*(kids\s*)?cup\b|\brookies\s*(dh\s*)?cup\b|\bfox\s*grom|\bgrom\s*enduro|\bd[eě]tsk[yý]\s*mtb\s*cup\b|\bpohár?\s*m[čc]\s*praha\s*4\b|\bvelk[yý]\s*h[áa]j\b|\bppkbike\b|\bpohár?\s*plzeňského\s*kraje\b|\balb-?gold|\brookies\s*cup\s*ostbayern\b|\bxco-?bikecup\b|\bjunior\s*bike\s*cup\b|\bon-off\s*mtb|\bdetská\s*tour|\bdetsk[eé]\s*mtb\b|\bpovažská\s*cykloliga\b|\bsaarlandliga\b|\bschwarzw(ae|ä|a)lder\b|\brhein-eifel\b|\boberschwaben\s*cup\b|\bpeklo\s*severu\b|\bústí\s*mtb\s*cup\b|\busti\s*mtb\s*cup\b|\bbayerwald\b|\bwerdenfels|\brhein-main\b|\beldorado\b|\bberg\s*&\s*bike|\bmpdv\b|\bdetská\s*vrl|\bjunior\s*challenge|\ballgäu|\bwiesbadener\s*stadtmeisterschaft|\bswiss\s*bike\s*cup\b|\bvittoria|\bkids\s*bike\s*trophy\b|\bvalais\b|\bvaliant\s*gp\b|\bbike\s*kingdom\b|\bbundicycling\b|\beiger\s*bike.*kids|\bxco-nrw\b|\bschüler[\s-]*cup|\brena\s*kids|\bsparkassen[\s-]*kids|\bstoakart|\bjarn[ií]\s*bahno|\bbike\s*revolution|\bbikeside|\bcopa\s*madrid|\bsloxcup\b|\bslovenia\s*downhill|\bmtb\s*kids\s*series|\bstreetrace|\bitalia\s*bike\s*cup\s*young|\bcoppa\s*italia\s*giovanile|\bcopa\s*catalunya/i;

const KIDS_PRIMARY_SERIES =
  /\btalent\s*cup\b|\bjunior\s*cup\b|\bprima\s*cup\b|\bkids[\s-]*cup\b|\bvpace\s*kids\b|\bcube\s*(kids\s*)?cup\b|\brookies\s*(dh\s*)?cup\b|\bd[eě]tsk[yý]\s*mtb\s*cup\b|\balb-?gold|\brookies\s*cup\s*ostbayern\b|\bjunior\s*bike\s*cup\b|\bdetská\s*tour|\bon-off\s*mtb|\bbayerwald\b|\bwerdenfels|\beldorado\b|\bdetská\s*vrl|\bjunior\s*challenge|\ballgäu|\brhein-main\b|\bkids\s*bike\s*trophy\b|\bkids\s*bike\s*cup\s*valais\b|\bvaliant\s*gp\b|\bbike\s*kingdom\b|\bbundicycling\b|\beiger\s*bike.*kids|\bxco-nrw\b|\brena\s*kids|\bsparkassen[\s-]*kids|\bstoakart|\bbike\s*revolution|\bbikeside|\bcopa\s*madrid|\bmtb\s*kids\s*series|\bitalia\s*bike\s*cup\s*young|\bcoppa\s*italia\s*giovanile|\bcopa\s*catalunya\s*btt/i;

export function isFamilyOrKidsSeries(text: string | null | undefined): boolean {
  return Boolean(text && FAMILY_OR_KIDS_SERIES.test(text));
}

export function isKidsPrimarySeries(text: string | null | undefined): boolean {
  return Boolean(text && KIDS_PRIMARY_SERIES.test(text));
}

/** Czech/Slovak national MTB XC cups run U13 through Elite. */
const NATIONAL_MTB_ALL_AGES =
  /česk[ýy]\s*poh[áa]r(\s*mtb|\s*xc|\s*xco)?|cesky\s*pohar(\s*mtb|\s*xc|\s*xco)?|slovensk[ýy]\s*poh[áa]r(\s*mtb|\s*xc|\s*xco)?|poh[áa]r\s*mtb\s*xc|\bčp\s*xco\b|\bcp\s*xco\b|\bčp\s*mtb\b/i;

/** UCI World Cup / World Series / Superprestige — junior–elite, not kids. */
const UCI_JUNIOR_TO_ELITE =
  /world[\s-]?cup|world[\s-]?series|superprestige|world[\s-]?tour|uci\s+mtb\s+world/i;

/** UCI class races (C1–C3, HC, 1.x / 2.x) — typically junior–elite. */
const UCI_CLASS_RACE =
  /\buci\s*c[123]\b|\bc[123]\s*uci\b|\buci\s*hc\b|\bhc\s*uci\b|\b[12]\.[12uw]\b|\buci\s+(wt|proseries|pro\s*series)\b/i;

const NATIONAL_CHAMPIONSHIP =
  /\bnational\s+championship|\bnational\s+champ\b|mistrovstv[ií]\s+(republiky|čr|cr|sr|slovenska)|mistrovstv[ií]\s+česka|\bmčr\b|\bm[cč]sr\b/i;

const PRO_ROAD_ELITE =
  /\b(vuelta|giro\s+d['’]?italia|tour\s+de\s+france|il\s+lombardia|amstel\s+gold|paris[\s-]?roubaix|milano[\s-]?san[\s-]?remo|li[eè]ge|fl[eè]che\s+wallonne|strade\s+bianche|tour\s+of\s+britain|renewi\s+tour|worldtour|bretagne\s+classic|classic\s+lorient)\b/i;

const MASS_PARTICIPATION =
  /gran[\s-]?fondo|jedermann|cyklosport|sportive|radmarathon|rad[\s-]?marathon|cycling[\s-]?marathon|bike\s*marathon|kolo\s*pro\s*(život|zivot)|kolopro|race\s+around|race\s+across|ultramaraton|ultra[\s-]?(race|distance)/i;

function addAgeDefaults(
  found: Set<AgeCategory>,
  opts: {
    text: string;
    familySeries: boolean;
    kidsPrimary: boolean;
    existingAudience?: string | null;
    level?: string | null;
    disciplines?: string[] | null;
  },
) {
  const t = opts.text;
  const discs = opts.disciplines ?? [];
  const hasGravel = discs.includes("gravel") || /\bgravel\b/.test(t);
  const hasRoadFamily =
    discs.some((d) =>
      ["road", "road_race", "tt", "criterium", "hill_climb", "gran_fondo"].includes(d),
    ) || /\broad\b|silnic|gran[\s-]?fondo/.test(t);

  if (opts.kidsPrimary) {
    found.add("kids");
    found.add("youth");
    return;
  }
  if (opts.familySeries) {
    found.add("kids");
    found.add("youth");
    found.add("amateur");
    found.add("masters");
    return;
  }
  // Keep explicit age tokens from the name; only fill when still empty.
  if (found.size) return;
  if (
    opts.level === "world_cup" ||
    opts.level === "world_championship" ||
    UCI_JUNIOR_TO_ELITE.test(t)
  ) {
    found.add("junior");
    found.add("u23");
    found.add("elite");
    return;
  }
  if (opts.level === "european_championship") {
    found.add("youth");
    found.add("junior");
    found.add("u23");
    found.add("elite");
    return;
  }
  if (UCI_CLASS_RACE.test(t) || PRO_ROAD_ELITE.test(t)) {
    found.add("junior");
    found.add("u23");
    found.add("elite");
    return;
  }
  if (NATIONAL_MTB_ALL_AGES.test(t)) {
    found.add("kids");
    found.add("youth");
    found.add("junior");
    found.add("u23");
    found.add("elite");
    return;
  }
  if (NATIONAL_CHAMPIONSHIP.test(t) && !isKidsPrimarySeries(t) && !/\bkids|děti|deti|giovanile\b/.test(t)) {
    found.add("junior");
    found.add("u23");
    found.add("elite");
    return;
  }
  if (MASS_PARTICIPATION.test(t)) {
    found.add("amateur");
    found.add("masters");
    return;
  }
  // Open gravel / road mass starts — not kids races unless named as such
  if (hasGravel && !/\buci\b/.test(t)) {
    found.add("amateur");
    found.add("masters");
    return;
  }
  if (hasRoadFamily && /\b(marathon|fondo|jedermann|sportive|hobby|open)\b/.test(t)) {
    found.add("amateur");
    found.add("masters");
    return;
  }
  if (opts.existingAudience === "kids") found.add("kids");
  if (opts.existingAudience === "youth") {
    found.add("youth");
    found.add("junior");
  }
  if (opts.existingAudience === "adults") {
    found.add("amateur");
    found.add("masters");
  }
}

export function audienceFromAgeCategories(cats: AgeCategory[]): Audience {
  if (!cats.length) return "mixed";
  const hasKids = cats.includes("kids") || cats.some((c) => c.startsWith("u") && Number(c.slice(1)) <= 13);
  const hasYouth =
    cats.includes("youth") ||
    cats.includes("junior") ||
    cats.includes("u15") ||
    cats.includes("u17");
  const hasAdults =
    cats.includes("u23") ||
    cats.includes("elite") ||
    cats.includes("masters") ||
    cats.includes("amateur");
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
  "continental",
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
  continental: "Continental",
  international: "International",
  world_cup: "World Cup",
  european_championship: "European Championship",
  world_championship: "World Championship",
};

export const UCI_CLASSES = [
  "worldtour",
  "proseries",
  "hc",
  "c1",
  "c2",
  "c3",
  "1.1",
  "1.2",
  "2.1",
  "2.2",
] as const;
export type UciClass = (typeof UCI_CLASSES)[number];

export const UCI_CLASS_LABELS: Record<UciClass, string> = {
  worldtour: "WorldTour",
  proseries: "ProSeries",
  hc: "HC",
  c1: "C1",
  c2: "C2",
  c3: "C3",
  "1.1": "1.1",
  "1.2": "1.2",
  "2.1": "2.1",
  "2.2": "2.2",
};

export const EVENT_TYPES = [
  "race",
  "cup",
  "series",
  "championship",
  "festival",
  "gran_fondo",
  "tour",
  "challenge",
  "ride",
  "training",
  "other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  race: "Race",
  cup: "Cup",
  series: "Series",
  championship: "Championship",
  festival: "Festival",
  gran_fondo: "Gran Fondo",
  tour: "Tour",
  challenge: "Challenge",
  ride: "Ride",
  training: "Training",
  other: "Other",
};

export const COMPETITION_TYPES = [
  "uci",
  "national_federation",
  "regional",
  "amateur",
  "commercial",
  "community",
  "other",
] as const;
export type CompetitionType = (typeof COMPETITION_TYPES)[number];

export const COMPETITION_TYPE_LABELS: Record<CompetitionType, string> = {
  uci: "UCI",
  national_federation: "National federation",
  regional: "Regional",
  amateur: "Amateur",
  commercial: "Commercial",
  community: "Community",
  other: "Other",
};

/** Recurring cups / circuits — not individual races. Level covers national vs international. */
export const SERIES_TYPES = [
  "cup",
  "league",
  "championship",
  "tour",
  "kids_series",
  "junior_series",
  "enduro_series",
  "marathon_series",
  "gran_fondo_series",
  "other",
] as const;
export type SeriesType = (typeof SERIES_TYPES)[number];

export const SERIES_TYPE_LABELS: Record<SeriesType, string> = {
  cup: "Cup",
  league: "League",
  championship: "Championship",
  tour: "Tour",
  kids_series: "Kids series",
  junior_series: "Junior series",
  enduro_series: "Enduro series",
  marathon_series: "Marathon series",
  gran_fondo_series: "Gran fondo series",
  other: "Series",
};

export const SERIES_STATUSES = ["draft", "active", "completed", "cancelled", "archived"] as const;
export type SeriesStatus = (typeof SERIES_STATUSES)[number];

export function inferSeriesType(opts: {
  name: string;
  slug?: string | null;
  disciplines?: string[];
  ageCategories?: string[];
}): SeriesType {
  const t = `${opts.name} ${opts.slug ?? ""}`.toLowerCase();
  // Name wins over event disciplines (CUBE Cup is a cup that also has XCM races).
  if (
    /d[eě]tsk|kids[\s-]*cup|vpace\s*kids|talent\s*cup|fox\s*grom|grom\s*enduro|on-off\s*mtb|bayerwald|werdenfels|eldorado|junior challenge|kids bike trophy|valiant gp|bike kingdom|bundicycling|eiger bike|xco-nrw|rena kids|stoakart|bike revolution|bikeside|copa madrid/.test(t)
  ) {
    return "kids_series";
  }
  if (/\bjunior|\brookies\b/.test(t)) return "junior_series";
  if (/mistrovství|mistrovstvi|\bchampionship\b|\bmčr\b|\bmcr\b/.test(t)) return "championship";
  if (/liga|league/.test(t)) return "league";
  if (/\benduro\b/.test(t)) return "enduro_series";
  if (/maraton|marathon|kolo\s*pro\s*(život|zivot)|kolopro/.test(t)) return "marathon_series";
  if (/gran[\s-]?fondo|sportive/.test(t)) return "gran_fondo_series";
  if (/\btour\b/.test(t)) return "tour";
  if (/cup|pohár|pohar/.test(t)) return "cup";
  if (/čp|český pohár|cesky pohar/.test(t)) return "cup";
  return "other";
}

export const SERIES_SOURCE_KINDS = [
  "official",
  "uci",
  "national_federation",
  "aggregator",
  "other",
] as const;
export type SeriesSourceKind = (typeof SERIES_SOURCE_KINDS)[number];

export function inferSeriesSourceKind(opts: {
  name: string;
  slug?: string | null;
  url?: string | null;
}): SeriesSourceKind {
  const t = `${opts.name} ${opts.slug ?? ""} ${opts.url ?? ""}`.toLowerCase();
  if (/\buci\b|ucimtbworldseries|uci\.org/.test(t)) return "uci";
  if (
    /cycling\.cz|czechcycling|cyklistikaszc|poharmtb\.cz|\bszc\b|swiss-cycling/.test(t) ||
    /\bčp\b|\bcp\b|český pohár|cesky pohar|mčr|slovenský pohár|slovensky pohar/.test(t)
  ) {
    return "national_federation";
  }
  if (/sumator|eventiv|ceskysportovnicalendar|radsport-termine/.test(t)) return "aggregator";
  if (opts.url) return "official";
  return "other";
}

export const EVENT_VISIBILITIES = ["public", "hidden"] as const;
export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

export const EVENT_STATUSES = [
  "draft",
  "scheduled",
  "tbc",
  "registration_open",
  "registration_closed",
  "cancelled",
  "postponed",
  "completed",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

const LEGACY_LEVEL: Record<string, RaceLevel> = {
  local: "local",
  district: "regional",
  regional: "regional",
  national: "national",
  continental: "continental",
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

export function inferEventType(opts: {
  name: string;
  seriesName?: string | null;
  level?: RaceLevel;
  disciplines?: Discipline[];
  isNonRace?: boolean;
}): EventType {
  if (opts.isNonRace) return "training";
  const t = `${opts.name} ${opts.seriesName ?? ""}`.toLowerCase();
  if (opts.level === "world_championship" || opts.level === "european_championship") {
    return "championship";
  }
  if (/mistrovství|mistrovstvi|\bchampionship\b|\bmčr\b|\bmcr\b/.test(t)) return "championship";
  if (/\bfestival\b/.test(t)) return "festival";
  if (/\btour\b|\betap/.test(t) && !/detská tour|detska tour/.test(t)) return "tour";
  if (/\bgran[\s-]?fondo\b|\bsportive\b/.test(t) || opts.disciplines?.includes("gran_fondo")) {
    return "gran_fondo";
  }
  if (/\bchallenge\b/.test(t)) return "challenge";
  if (/\bride\b|jízda|jizda/.test(t) && !/race|závod|zavod/.test(t)) return "ride";
  if (/\bcup\b|\bpohár\b|\bpohar\b/.test(t)) return "cup";
  if (opts.seriesName) return "series";
  return "race";
}

export function inferCompetitionType(opts: {
  name: string;
  seriesName?: string | null;
  level?: RaceLevel;
  uciClass?: UciClass | null;
}): CompetitionType {
  const t = `${opts.name} ${opts.seriesName ?? ""}`.toLowerCase();
  if (opts.uciClass || /\buci\b/.test(t)) return "uci";
  if (/\bkolo\s*pro|cube\s*cup|prima\s*cup|nazavody/.test(t)) return "commercial";
  if (
    opts.level === "national" ||
    opts.level === "world_championship" ||
    opts.level === "european_championship" ||
    /\bmčr\b|\bčp\b|\bcp\b|national\s*federation|cesky pohar|český pohár/.test(t)
  ) {
    return "national_federation";
  }
  if (opts.level === "regional" || /krajsk|regionál|okres/.test(t)) return "regional";
  if (/\bamateur\b|\bhobby\b|amatér/.test(t)) return "amateur";
  if (opts.level === "local") return "community";
  return "other";
}

/**
 * Calendar season label.
 * Cyclocross: Oct–Feb belongs to the season that started in the autumn
 * (`2026/27`). Everything else is the calendar year.
 */
export function seasonForEvent(startDate: string, disciplines: string[] = []): string {
  const y = Number(startDate.slice(0, 4));
  const m = Number(startDate.slice(5, 7));
  if (!y || !m) return startDate.slice(0, 4);
  const isCx = disciplines.includes("cx") || disciplines.includes("cyclocross");
  if (isCx) {
    if (m >= 10) return `${y}/${String(y + 1).slice(2)}`;
    if (m <= 2) return `${y - 1}/${String(y).slice(2)}`;
  }
  return String(y);
}

/** Skip far-future parse errors (keep next calendar year for CX / published calendars). */
export function isIngestibleDate(startDate: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return false;
  const y = Number(startDate.slice(0, 4));
  const maxY = now.getFullYear() + 1;
  const minY = now.getFullYear() - 1;
  return y >= minY && y <= maxY;
}

export type InferredClassification = {
  disciplines: Discipline[];
  formats: Format[];
  ageCategories: AgeCategory[];
  audience: Audience;
  level: RaceLevel;
  uciClass: UciClass | null;
  classLabel: string;
  eventType: EventType;
  competitionType: CompetitionType;
  season: string;
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
  startDate?: string | null;
  isNonRace?: boolean;
}): InferredClassification {
  const seriesBlob = `${opts.seriesName ?? ""} ${opts.seriesSlug ?? ""}`;
  const text = `${opts.name} ${opts.placeText ?? ""} ${seriesBlob} ${(opts.categoryNames ?? []).join(" ")} ${opts.existingClassLabel ?? ""}`;
  const t = text.toLowerCase();

  const disciplines = inferDisciplines(text, opts.disciplines);
  const formats = formatsFromDisciplines(disciplines);
  const ageCategories = new Set(inferAgeCategories(text, opts.categoryNames));
  if (opts.existingAudience === "kids") ageCategories.add("kids");
  if (opts.existingAudience === "youth") ageCategories.add("youth");

  const familySeries = isFamilyOrKidsSeries(`${opts.name} ${seriesBlob}`);
  const kidsPrimary = isKidsPrimarySeries(`${opts.name} ${seriesBlob}`);

  let uciClass: UciClass | null = null;
  if (/world[\s-]?tour/.test(t)) uciClass = "worldtour";
  else if (/pro[\s-]?series/.test(t)) uciClass = "proseries";
  else if (/\bhc\b|hors[\s-]?categorie|hors catégorie/.test(t)) uciClass = "hc";
  else if (/\b1\.1\b/.test(t)) uciClass = "1.1";
  else if (/\b1\.2\b/.test(t)) uciClass = "1.2";
  else if (/\b2\.1\b/.test(t)) uciClass = "2.1";
  else if (/\b2\.2\b/.test(t)) uciClass = "2.2";
  else if (/\bc1\b|čp\s*\/\s*c1|cp\s*\/\s*c1/.test(t)) uciClass = "c1";
  else if (/\bc2\b/.test(t)) uciClass = "c2";
  else if (/\bc3\b/.test(t)) uciClass = "c3";
  else if (opts.existingLevel === "c1" || opts.existingLevel === "c2" || opts.existingLevel === "c3") {
    uciClass = opts.existingLevel;
  } else if (opts.existingClassLabel) {
    const cl = opts.existingClassLabel.trim().toLowerCase();
    if ((UCI_CLASSES as readonly string[]).includes(cl)) uciClass = cl as UciClass;
  }

  let level: RaceLevel = "local";
  if (/world\s*championship|mistrovství světa|mistrovstvi sveta|\bmw\b|\bwch\b|\bms\b/.test(t)) {
    level = "world_championship";
  } else if (
    /european\s*championship|mistrovství evropy|mistrovstvi evropy|\bech\b|\bme\b/.test(t)
  ) {
    level = "european_championship";
  } else if (/world\s*cup|světový pohár|svetovy pohar|\bwc\b|\bsp\b|world[\s-]?series/.test(t)) {
    level = "world_cup";
  } else if (/continental[\s-]?cup|evropský pohár|evropsky pohar/.test(t)) {
    level = "continental";
  } else if (/international|mezinárodní|mezinarodni|\buci\b/.test(t) || uciClass) {
    level = uciClass ? "national" : "international";
    if (/\buci\b/.test(t) && !uciClass) level = "international";
    if (uciClass && /international|mezinárodní|mezinarodni|\buci\b/.test(t)) level = "international";
  } else if (
    /\bmčr\b|mistrovství|cesky pohar|český pohár|\bčp\b|čp\b|\bcp\b|national|slovenský pohár|slovensky pohar|bundesliga|kolo\s*pro\s*(život|zivot)|prima\s*cup|cube\s*cup|czech\s+enduro|swiss bike cup|vittoria/.test(
      t,
    )
  ) {
    level = "national";
  } else if (
    /krajsk|regionál|regional|přebor kraje|prebor kraje|okres|district|schwarzw(ae|ä|a)lder|rhein-eifel|oberschwaben|saarlandliga|úst[ií]\s*mtb|usti\s*mtb\s*cup|šumavsk|sumavsk|bayerwald|werdenfels|rhein-main|eldorado|berg\s*&\s*bike|mpdv|detská\s*vrl|allgäu|valais|bundicycling|bike kingdom|valiant gp|xco-nrw|jarn[ií]\s*bahno|copa madrid/.test(
      t,
    )
  ) {
    level = "regional";
  } else if (opts.existingLevel && LEGACY_LEVEL[opts.existingLevel]) {
    level = LEGACY_LEVEL[opts.existingLevel];
  }

  if (uciClass && level === "local") level = "national";

  addAgeDefaults(ageCategories, {
    text: t,
    familySeries,
    kidsPrimary,
    existingAudience: opts.existingAudience,
    level,
    disciplines,
  });

  const ageList = AGE_CATEGORIES.filter((c) => ageCategories.has(c));
  let audience = ageList.length
    ? audienceFromAgeCategories(ageList)
    : ((opts.existingAudience as Audience) || "mixed");
  if (kidsPrimary) audience = "kids";
  else if (familySeries) audience = "mixed";

  const classLabel = uciClass ? UCI_CLASS_LABELS[uciClass] : RACE_LEVEL_LABELS[level];

  const eventType = inferEventType({
    name: opts.name,
    seriesName: opts.seriesName,
    level,
    disciplines,
    isNonRace: opts.isNonRace,
  });
  const competitionType = inferCompetitionType({
    name: opts.name,
    seriesName: opts.seriesName,
    level,
    uciClass,
  });
  const season = seasonForEvent(opts.startDate || "", disciplines);

  return {
    disciplines,
    formats,
    ageCategories: ageList,
    audience: ageList.length
      ? audience
      : opts.existingAudience === "adults"
        ? "adults"
        : audience,
    level,
    uciClass,
    classLabel,
    eventType,
    competitionType,
    season,
  };
}
