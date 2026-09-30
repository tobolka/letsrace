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
): AgeCategory[] {
  const found = new Set<AgeCategory>();
  for (const c of categories) {
    for (const band of bandsFor(c.name, c.ageMin ?? undefined, c.ageMax ?? undefined)) {
      found.add(band);
    }
  }
  // The umbrella chips, the same way `inferAgeCategories` adds them, so a
  // stated U11 still answers a "Kids" filter.
  if (["u7", "u9", "u11", "u13"].some((b) => found.has(b as AgeCategory))) found.add("kids");
  if (found.has("u15") || found.has("u17")) found.add("youth");
  return AGE_CATEGORIES.filter((c) => found.has(c));
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

  // U-numbers: "U11", "U 13", "U-15".
  const u = name.match(/\bu\s*-?\s*(\d{1,2})\b/);
  if (u) {
    const band = bandForAge(Number(u[1]) - 1);
    if (band) return [band];
  }

  // Czech and Slovak federation classes.
  if (/nejmladsi|odrazed|\bsnec|mini\s*za|benjam/.test(name)) return ["u7", "u9"];
  if (/predza|pripravk/.test(name)) return ["u11"];
  if (/\bza(ci|kyne|k)\b.*mlad|mlad.*\bza(ci|kyne|k)\b/.test(name)) return ["u13"];
  if (/\bza(ci|kyne|k)\b.*star|star.*\bza(ci|kyne|k)\b/.test(name)) return ["u15"];
  if (/\bza(ci|kyne|k)\b/.test(name)) return ["u13", "u15"];
  if (/kadet/.test(name)) return ["u17"];
  if (/junior/.test(name)) return ["junior"];

  // BMX and kids' cups list ages bare: "Boys 9-10", "Chlapci 7 a mladší",
  // "Girls 13". Numbers that could only be ages.
  const nums = [...name.matchAll(/(?<![\d.,])(\d{1,2})(?![\d.,]|\s*(km|m\b|min|kc|czk|€|eur))/g)]
    .map((m) => Number(m[1]))
    .filter((n) => n >= 3 && n <= 18);
  if (nums.length && /boys|girls|chlap|kluci|divk|holk|\bdet|kids|\blet\b|years?|jahre/.test(name)) {
    const band = bandForAge(Math.max(...nums));
    return band ? [band] : [];
  }
  if (/cruiser/.test(name)) return ["amateur"];

  // Adult open classes.
  if (/\bmuzi\b|\bzeny\b|\bmen\b|\bwomen\b/.test(name)) return ["elite"];
  if (/hobby|amater|prichozi|\bopen\b|ostatni/.test(name)) return ["amateur"];
  return [];
}
