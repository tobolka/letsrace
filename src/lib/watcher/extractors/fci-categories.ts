import type { AgeCategory } from "@/lib/taxonomy";

/**
 * Read who may start off an Italian federation race page.
 *
 * The FCI publishes a "Categorie ammesse" line on every race — "ELITE-UNDER
 * 23-JUNIOR M/F - MASTER TUTTI M/F", "ESORDIENTI M/F - ALLIEVI M/F - JUNIORES
 * M/F", "APERTA A TUTTE LE CATEGORIE AGONISTICHE FEDERALI + CATEGORIE
 * AGONISTICHE GIOVANILI" — and it is one of the few places in the catalogue
 * where a source states, in its own words, who is allowed to start.
 *
 * The Italian age ladder maps onto ours: giovanissimi are the under-13 kids,
 * esordienti and allievi are the 13–16 youth, juniores are juniors, under-23 is
 * under-23, elite is elite, master is masters, amatori is amateur.
 *
 * "Tutte le categorie agonistiche" means every racing category, which is not a
 * list — it says adults ride, and it says nothing about children unless
 * "giovanili" appears beside it.
 *
 * The line is often left blank, and when it is the class says it instead: a
 * "PEDALATA NON COMPETITIVA" is a ride anyone may join, a "(1.12) Elite e
 * Under 23" names its two categories outright. Reading both is why 41 races
 * that had been fetched and given up on could be filled.
 */

const RULES: { re: RegExp; ages: AgeCategory[] }[] = [
  { re: /\bgiovanissim/i, ages: ["kids"] },
  { re: /\besordient/i, ages: ["youth"] },
  { re: /\ballievi?\b/i, ages: ["youth"] },
  { re: /\bgiovanil/i, ages: ["youth"] },
  { re: /\bjunior(?:es|s)?\b/i, ages: ["junior"] },
  { re: /\bunder\s*-?\s*23\b|\bu23\b/i, ages: ["u23"] },
  { re: /\belite\b/i, ages: ["elite"] },
  { re: /\bmaster\b|\bmasters\b/i, ages: ["masters"] },
  // "amatori", and the compound the MTB calendar writes it as.
  { re: /\bamator|\bciclo-?amator/i, ages: ["amateur"] },
  { re: /\bdonne\b|\bfemminil/i, ages: [] },
];

/** "Under M/F" on its own is the Italian shorthand for under-23. */
const BARE_UNDER = /\bunder\s+m\s*\/\s*f\b/i;

/**
 * Every racing category: adults, and juniors, but no promise about children.
 *
 * "Tesserati FCI" is the same statement in the language of licences, and
 * "TUTTE + ALTRI ENTI" / "tutte FCI" is the same statement abbreviated.
 */
const ALL_RACING =
  /tutte\s+le\s+categorie|aperta\s+a\s+tutte|\btutte\s+fci\b|\btesserat\w*\s+fci\b|\btutte\s*\+/i;

/**
 * A ride rather than a race: the page says so in the class, or says the start
 * is open to anyone who turns up.
 */
const OPEN_TO_ANYONE =
  /pedalata\s+non\s+competitiva|cicloturistica|non\s+competitiv\w*|sono\s+aperte\s+a\s*:?\s*tutti|aperta\s+a\s+tutti\b|tutti\s+i\s+cittadini/i;

/**
 * The MTB calendar writes the youth ladder as initials — "CAT. ES-ALL-JU".
 * Only read them when they come as a run of at least two, because "ALL" and
 * "JU" on their own are half the words on an Italian page.
 */
const ABBREVIATED_LADDER = /\b(?:es|all|ju)(?:\s*[-/]\s*(?:es|all|ju))+\b/i;
const ABBREVIATION_AGE: Record<string, AgeCategory> = {
  es: "youth",
  all: "youth",
  ju: "junior",
};

export function parseFciCategories(raw: string | null | undefined): AgeCategory[] {
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return [];

  const found = new Set<AgeCategory>();
  for (const rule of RULES) {
    if (rule.re.test(text)) for (const a of rule.ages) found.add(a);
  }
  if (BARE_UNDER.test(text)) found.add("u23");

  const ladder = text.match(ABBREVIATED_LADDER);
  if (ladder) {
    for (const token of ladder[0].split(/[-/\s]+/)) {
      const age = ABBREVIATION_AGE[token.toLowerCase()];
      if (age) found.add(age);
    }
  }

  if (ALL_RACING.test(text)) {
    found.add("junior");
    found.add("u23");
    found.add("elite");
    found.add("masters");
  }

  if (OPEN_TO_ANYONE.test(text)) found.add("amateur");

  return [...found];
}

/**
 * The labelled fields of an FCI race page.
 *
 * The value of one field runs until the next label, so this splits on the
 * labels rather than taking everything after the one it wants — reading past
 * "Organizzatore" put club names and route descriptions through the category
 * rules, where "MASTER" in a team name is a category nobody stated.
 */
const LABELS = [
  "Data",
  "ID Gara",
  "Regione",
  "Luogo",
  "Classe",
  "Categoria",
  "Tipo",
  "Categorie ammesse",
  "Organizzatore",
  "Telefono",
  "Email",
  "Iscrizioni",
] as const;

export function fciFields(html: string): Record<string, string> {
  const flat = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "|")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("  ");
  const pattern = new RegExp(`(${LABELS.join("|")}):`, "gi");
  const hits = [...flat.matchAll(pattern)];
  const out: Record<string, string> = {};
  for (let i = 0; i < hits.length; i++) {
    const label = hits[i]![1]!.toLowerCase();
    const start = hits[i]!.index! + hits[i]![0].length;
    const end = i + 1 < hits.length ? hits[i + 1]!.index! : flat.length;
    const value = flat.slice(start, end).trim();
    if (!(label in out)) out[label] = value;
  }
  return out;
}

/** Pull the "Categorie ammesse" value out of a fetched FCI race page. */
export function fciCategoryLine(html: string): string | null {
  return fciFields(html)["categorie ammesse"] || null;
}

/** The class, which says who may start when the categories line is blank. */
export function fciClassLine(html: string): string | null {
  return fciFields(html)["classe"] || null;
}

/** Everything on the page that states who may start, read together. */
export function fciAdmittedText(html: string): string {
  const fields = fciFields(html);
  return [fields["categorie ammesse"], fields["classe"]].filter(Boolean).join(" — ");
}
