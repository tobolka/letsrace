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
    const mapped = bandsFor(c.name, ageMin, ageMax);
    // A bounded cohort such as ages 7–10 admits both U9 and U11. Recording
    // only its oldest band would falsely exclude younger eligible children.
    if (ageMin != null && ageMax != null && ageMin >= 0 && ageMin <= 18) {
      for (let age = ageMin; age <= Math.min(ageMax, 18); age++) {
        const band = bandForAge(age);
        if (band && !mapped.includes(band)) mapped.push(band);
      }
    }
    // "2018 a mladší" / "do 8 let" admits the younger band too. An absent
    // lower bound must not hide this race when a parent filters for U7.
    if (ageMin == null && ageMax != null && ageMax >= 3 && ageMax <= 18) {
      for (let age = 3; age <= ageMax; age++) {
        const band = bandForAge(age);
        if (band && !mapped.includes(band)) mapped.push(band);
      }
    }
    for (const band of mapped) {
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
  const range = name.match(/(?<![\d.])(\d{1,2})\s*(?:let\s*)?(?:[-–]|bis)\s*(\d{1,2})\s*(?:let|lat|rokov|years|jahren?)\b/);
  if (range) return { ageMin: Number(range[1]), ageMax: Number(range[2]) };
  const plus = name.match(/(?<![\d.])(\d{1,2})\s*(?:\+|a\s*vice|let\s*a\s*vice|and\s*over|und\s*alter)/);
  if (plus) return { ageMin: Number(plus[1]) };
  const upper = name.match(/\b(?:do|up to|bis)\s*(\d{1,2})\s*(?:let|lat|rokov|years|jahre)\b/);
  if (upper) return { ageMax: Number(upper[1]) };
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
  const range = name.match(/\b(19[3-9]\d|20[0-3]\d)\s*[-–]\s*(19[3-9]\d|20[0-3]\d)\b/);
  const years = (range ? [Number(range[1]), Number(range[2])] : [...name.matchAll(/(?<![\d.\/-])(19[3-9]\d|20[0-3]\d)(?![\d]|[.\/-]\d)/g)].map((m) => Number(m[1])))
    .filter((y) => y <= refYear - 3);
  if (!years.length) return {};
  const oldest = refYear - Math.min(...years);
  const youngest = refYear - Math.max(...years);
  if (years.length === 1) {
    if (/\bbis\s*(?:jg\.?\s*)?(?:19|20)\d\d\b/.test(name)) return { ageMin: youngest };
    if (/\bab\s*(?:jg\.?\s*)?(?:19|20)\d\d\b/.test(name)) return { ageMin: /erwachsene/.test(name) ? 18 : undefined, ageMax: youngest };
    if (/a\s*mladsi|a\s*vys\b|and\s*younger|und\s*junger|i\s*mlodsi/.test(name)) return { ageMax: youngest };
    if (/a\s*starsi|a\s*nize\b|and\s*older|und\s*alter|i\s*starsi/.test(name)) return { ageMin: oldest };
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
  // "ł" has no decomposition of its own.
  const name = rawName.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/ł/g, "l");

  // Named classes that ages alone would put in the wrong place: U23 and the
  // elite are adults, masters are adults of a given age.
  if (/\bu\s*23\b|under\s*23/.test(name)) return ["u23"];
  // "Hobby Frauen" is a hobby class, not the women's open race.
  if (/hobby|jedermann|amat[ae]ur|amater|cicloturist|\bfun\b|funklasse/.test(name)) return ["amateur"];
  if (/\belit[ea]?\b/.test(name)) return ["elite"];
  if (/\bmasters?\b|\bveteran|\bsenior/.test(name)) return ["masters"];

  // Stated ages decide. The oldest band is added here; the caller expands
  // every younger band that the published admission interval includes.
  if (ageMax != null && ageMax <= 18) {
    const band = bandForAge(ageMax);
    return band ? [band] : [];
  }
  if (ageMin != null && ageMin >= 19) {
    return ageMin >= 35 ? ["masters"] : ["amateur"];
  }
  if (ageMin != null && ageMin >= 17 && ageMax == null) return ["junior", "amateur"];
  if (ageMin != null && ageMin >= 3 && ageMin < 17 && ageMax == null) {
    const bands = new Set<AgeCategory>(["amateur"]);
    for (let age = ageMin; age <= 18; age++) {
      const band = bandForAge(age);
      if (band) bands.add(band);
    }
    return [...bands];
  }
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
  // Other federations' youth classes.
  if (/laufrad/.test(name)) return ["kids"];
  if (/giovanissim|poussin|pupil/.test(name)) return ["u7", "u9", "u11"];
  if (/\bzak\b|\bzacy\b/.test(name)) return ["u13"];
  if (/mlodzik|minime/.test(name)) return ["u15"];
  if (/esordient|benjamin|aspirant|schuler/.test(name)) return ["u13", "u15"];
  if (/alliev[ie]|nieuwelingen|cadet|jugend\b|junior mlodszy|mlodsi junior/.test(name)) return ["u17"];
  if (/juniores|junioren|juniorinnen|juniori\b|juniorky|junior/.test(name)) return ["junior"];
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
