import type { AgeCategory } from "@/lib/taxonomy";

/**
 * Read the admitted categories off an Italian federation race page.
 *
 * The FCI publishes a "Categorie ammesse" line on every race — "ELITE-UNDER
 * 23-JUNIOR M/F - MASTER TUTTI M/F", "ESORDIENTI M/F - ALLIEVI M/F - JUNIORES
 * M/F", "APERTA A TUTTE LE CATEGORIE AGONISTICHE FEDERALI + CATEGORIE
 * AGONISTICHE GIOVANILI" — and it is the only place in the catalogue where a
 * source states, in its own words, who is allowed to start.
 *
 * The Italian age ladder maps onto ours: giovanissimi are the under-13 kids,
 * esordienti and allievi are the 13–16 youth, juniores are juniors, under-23 is
 * under-23, elite is elite, master is masters, amatori is amateur.
 *
 * "Tutte le categorie agonistiche" means every racing category, which is not a
 * list — it says adults ride, and it says nothing about children unless
 * "giovanili" appears beside it.
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
  { re: /\bamator/i, ages: ["amateur"] },
  { re: /\bdonne\b|\bfemminil/i, ages: [] },
];

/** "Under M/F" on its own is the Italian shorthand for under-23. */
const BARE_UNDER = /\bunder\s+m\s*\/\s*f\b/i;

/** Every racing category: adults, and juniors, but no promise about children. */
const ALL_RACING = /tutte\s+le\s+categorie|aperta\s+a\s+tutte/i;

export function parseFciCategories(raw: string | null | undefined): AgeCategory[] {
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return [];

  const found = new Set<AgeCategory>();
  for (const rule of RULES) {
    if (rule.re.test(text)) for (const a of rule.ages) found.add(a);
  }
  if (BARE_UNDER.test(text)) found.add("u23");

  if (ALL_RACING.test(text)) {
    found.add("junior");
    found.add("u23");
    found.add("elite");
    found.add("masters");
  }

  return [...found];
}

/** Pull the "Categorie ammesse" value out of a fetched FCI race page. */
export function fciCategoryLine(html: string): string | null {
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "|");
  const flat = text
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("  ");
  const match = flat.match(/Categorie ammesse:\s*?\s*([^]+)/i);
  const value = match?.[1]?.trim();
  if (!value) return null;
  // The next label on the page, when the field itself was empty.
  if (/^Organizzatore\b/i.test(value)) return null;
  return value;
}
