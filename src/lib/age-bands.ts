import { AGE_CATEGORIES, type AgeCategory } from "@/lib/taxonomy";

/**
 * Turn a race's own list of categories into our age bands.
 *
 * `inferAgeCategories` reads loose text — a race title, a blurb — and only
 * knows the words that say "kids" in a dozen languages. A category list is a
 * better witness: registration systems and federation pages state each class
 * with a name, and often with the ages or birth years it admits. Read with the
 * ages, "KI – kadeti, 15–16 let" is U17 and nothing else; read as text it was
 * "youth", and "A – muži, 19–29 let" was nothing at all.
 *
 * Each category counts once, by its ages when it states them, else by a name
 * this knows. What it cannot place adds nothing: a list of trail names says
 * who may start no more than a title does.
 */
export function ageCategoriesFromList(
  categories: { name: string; ageMin?: number | null; ageMax?: number | null }[],
  /** The season, to read birth years ("2011–2012", "1966 a starší") as ages. */
  opts?: { refYear?: number },
): AgeCategory[] {
  const found = new Set<AgeCategory>();
  for (const c of categories) {
    let ageMin = c.ageMin ?? undefined;
    let ageMax = c.ageMax ?? undefined;
    if (ageMin == null && ageMax == null) ({ ageMin, ageMax } = agesInText(c.name));
    if (ageMin == null && ageMax == null && opts?.refYear) {
      ({ ageMin, ageMax } = agesFromBirthYears(c.name, opts.refYear));
    }
    for (const band of bandsFor(c.name, ageMin, ageMax)) {
      found.add(band);
    }
  }
  // The umbrella chips, the same way `inferAgeCategories` adds them, so a
  // stated U11 still answers a "Kids" filter.
  if (["u7", "u9", "u11"].some((b) => found.has(b as AgeCategory))) found.add("kids");
  if (["u13", "u15", "u17"].some((b) => found.has(b as AgeCategory))) found.add("youth");
  return AGE_CATEGORIES.filter((c) => found.has(c));
}

/** Ages written out: "15-35 let", "36 let - 60 let", "40 a více let". */
function agesInText(rawName: string): { ageMin?: number; ageMax?: number } {
  const name = rawName.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const range = name.match(/(?<![\d.])(\d{1,2})\s*(?:let\s*)?[-–]\s*(\d{1,2})\s*(?:let|lat|rokov|years|jahre)\b/);
  if (range) return { ageMin: Number(range[1]), ageMax: Number(range[2]) };
  const plus = name.match(/(?<![\d.])(\d{1,2})\s*(?:\+|a\s*vice|let\s*a\s*vice|and\s*over|und\s*alter)/);
  if (plus) return { ageMin: Number(plus[1]) };
  return {};
}

/**
 * Birth years as ages in the given season: "2011–2012" is 14–15, "2013 a
 * mladší" is at most 13, "1966 a starší" at least 60.
 */
function agesFromBirthYears(rawName: string, refYear: number): { ageMin?: number; ageMax?: number } {
  const name = rawName.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  // Not the year of a date ("3.10.2026", "2026-10-03"), and old enough to
  // be someone's birth year in this season.
  const years = [...name.matchAll(/(?<![\d.\/-])(19[3-9]\d|20[0-3]\d)(?![\d]|[.\/-]\d)/g)]
    .map((m) => Number(m[1]))
    .filter((y) => y <= refYear - 3);
  if (!years.length) return {};
  const oldest = refYear - Math.min(...years);
  const youngest = refYear - Math.max(...years);
  if (years.length === 1) {
    if (/a\s*mladsi|and\s*younger|und\s*junger|i\s*mlodsi/.test(name)) return { ageMax: youngest };
    if (/a\s*starsi|and\s*older|und\s*alter|i\s*starsi/.test(name)) return { ageMin: oldest };
    return { ageMin: youngest, ageMax: youngest };
  }
  return { ageMin: youngest, ageMax: oldest };
}

/** The youngest band an age falls in: 10 is U11, 16 is U17, 18 is junior. */
function bandForAge(age: number): AgeCategory | null {
  if (age <= 6) return "u7";
  if (age <= 8) return "u9";
  if (age <= 10) return "u11";
  if (age <= 12) return "u13";
  if (age <= 14) return "u15";
  if (age <= 16) return "u17";
  if (age <= 18) return "junior";
  return null;
}

function bandsFor(rawName: string, ageMin?: number, ageMax?: number): AgeCategory[] {
  // Without diacritics: JavaScript's \b does not see "ž" or "ě" as letters,
  // so "\bženy\b" never matched, and "zaci" is how half the forms spell it.
  const name = rawName.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

  // Named classes that ages alone would put in the wrong place: U23 and the
  // elite are adults, masters are adults of a given age.
  if (/\bu\s*23\b/.test(name)) return ["u23"];
  if (/\belit[ea]?\b/.test(name)) return ["elite"];
  if (/\bmasters?\b|\bveteran|\bsenior/.test(name)) return ["masters"];

  // Stated ages decide. The top of the range is the band: "0–14 let (2012 a
  // mladší)" is the older pupils' class, not an open door for toddlers.
  if (ageMax != null && ageMax <= 18) {
    const band = bandForAge(ageMax);
    return band ? [band] : [];
  }
  if (ageMin != null && ageMin >= 19) {
    return ageMin >= 35 ? ["masters"] : ["amateur"];
  }
  if (ageMin != null && ageMin >= 17 && ageMax == null) return ["junior", "amateur"];
  if (ageMin != null && ageMax != null && ageMax > 18) return ageMin >= 35 ? ["masters"] : ["amateur"];

  // U-numbers: "U11", "U 13", "U-15".
  const u = name.match(/\bu\s*-?\s*(\d{1,2})\b/);
  if (u) {
    const band = bandForAge(Number(u[1]) - 1);
    if (band) return [band];
  }

  // Czech and Slovak federation classes, with the forms' abbreviations:
  // "ml. žáci", "st. žákyně".
  const pupils = /\bza(ci|kyne|k|cky|kyn)\b/;
  if (/odrazed|\bsnec|mini\s*za|benjam/.test(name)) return ["u7", "u9"];
  if (/predza|pripravk/.test(name)) return ["u11"];
  if (pupils.test(name) && /mlad|\bml\b\.?/.test(name)) return ["u13"];
  if (pupils.test(name) && /star|\bst\b\.?/.test(name)) return ["u15"];
  if (pupils.test(name)) return ["u13", "u15"];
  if (/kadet/.test(name)) return ["u17"];
  if (/junior/.test(name)) return ["junior"];

  // BMX and kids' cups list ages bare: "Boys 9-10", "Chlapci 7 a mladší",
  // "Girls 13". Numbers that could only be ages.
  // Not glued to a letter: "M3" and "RZ4" are codes, not ages.
  const all = [...name.matchAll(/(?<![a-z\d.,])(\d{1,2})(?![\d.,]|\s*(km|m\b|min|kc|czk|€|eur))/g)].map((m) =>
    Number(m[1]),
  );
  const nums = all.filter((n) => n >= 3 && n <= 18);
  // "od 6 let" is the youngest who may start, not a class; "60 let" is an
  // adult's.
  if (nums.length && !all.some((n) => n > 18) && !/\bod\s*\d/.test(name) && /boys|girls|chlap|kluci|divk|holk|\bdet|kids|\blet\b|years?|jahre/.test(name)) {
    const band = bandForAge(Math.max(...nums));
    return band ? [band] : [];
  }
  if (/cruiser/.test(name)) return ["amateur"];

  // Adult open classes.
  if (/\bmuzi\b|\bzeny\b|\bmen\b|\bwomen\b|\bherren\b|\bdamen\b|\bmanner\b|\bfrauen\b|\bhommes\b|\bfemmes\b|\buomini\b|\bdonne\b|\bmezczyzni\b|\bkobiety\b/.test(name)) return ["elite"];
  if (/hobby|amater|prichozi|\bopen\b/.test(name)) return ["amateur"];
  return [];
}
