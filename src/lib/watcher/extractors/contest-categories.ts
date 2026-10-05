import { AGE_CATEGORIES, type AgeCategory } from "@/lib/taxonomy";
import { ageCategoriesFromList } from "@/lib/age-bands";

/**
 * Read who may start from the names of a race's contests.
 *
 * Timing platforms publish the list of contests an event runs — "56 km -
 * hlavní závod", "1 km - děti nejmladší II.", "Schülerrennen U13",
 * "Jedermannrennen" — and those names are the organiser saying, in their own
 * words, which categories exist. It is the same information the Italian
 * federation puts on a "Categorie ammesse" line, in a different shape.
 *
 * The vocabulary is Czech, German and English because that is what the sources
 * in this catalogue are written in. It is deliberately cautious: a main race
 * for everyone is `amateur`, not `elite`, because "open to all" is a mass start
 * and not a category of licensed riders. Nothing is inferred from a distance
 * alone — a 3 km contest is a children's race on one page and a prologue on
 * another.
 */

const RULES: { re: RegExp; age: AgeCategory }[] = [
  // Children
  { re: /\bd[ěe]t(?:i|sk\w*|em)\b|\bdetsk\w*|odr[áa][žz]edl|\bp[řr][íi]pravk|\bbambin|\bkinder|\bmini[- ]?bik|\bkids?\b/i, age: "kids" },
  // School-age and youth
  { re: /\b[žz][áa](?:ci|kyn|ctv)\w*|\bsch[üu]ler|\bjugend|\bml[áa]de[žz]|\byouth\b|\bu1[357]\b/i, age: "youth" },
  // Juniors and cadets
  { re: /\bjunior\w*|\bu19\b/i, age: "junior" },
  { re: /\bu-?23\b|\bunder\s*23\b/i, age: "u23" },
  { re: /\belit\w*|\bprofi\b|\bmistrovsk\w*/i, age: "elite" },
  { re: /\bdamen\b|\bherren\b|\bfrauen\b|\bm[äa]nner\b/i, age: "elite" },
  { re: /\bmaster\w*|\bveter[áa]n\w*|\bsenior\w*/i, age: "masters" },
  // An open race for whoever turns up
  { re: /\bhlavn[íi]\s+z[áa]vod|\bhauptrennen\b|\bjedermann\w*|\bhobby\b|\bamat[ée]r\w*|\bamateur\w*|\bfun\b|\berwachsene\b|\bopen\b/i, age: "amateur" },
];

export function parseContestCategories(names: (string | null | undefined)[], opts?: { refYear: number }): AgeCategory[] {
  const found = new Set<AgeCategory>();
  for (const raw of names) {
    const name = (raw ?? "").trim();
    if (!name) continue;
    const u = name.match(/\bU\s*-?\s*(\d{1,2})\b/i);
    for (const rule of RULES) {
      if (u && ((rule.age === "youth" && Number(u[1]) <= 11) || (rule.age === "junior" && Number(u[1]) < 19))) continue;
      if (rule.re.test(name)) found.add(rule.age);
    }
    if (u) for (const band of ageCategoriesFromList([{ name: `U${u[1]}` }])) found.add(band);
    const birthRange = opts && name.match(/\b((?:19|20)\d\d)\s*[-–]\s*((?:19|20)\d\d)\b/);
    if (birthRange) {
      const lo = opts!.refYear - Math.max(Number(birthRange[1]), Number(birthRange[2]));
      const hi = opts!.refYear - Math.min(Number(birthRange[1]), Number(birthRange[2]));
      if (lo >= 3 && hi <= 18) for (let age = lo; age <= hi; age++)
        for (const band of ageCategoriesFromList([{ name, ageMin: age, ageMax: age }])) found.add(band);
    }
  }
  return AGE_CATEGORIES.filter((age) => found.has(age));
}

/** The contest names a RaceResult event publishes, or an empty list. */
export function raceResultEventId(url: string | null | undefined): string | null {
  const m = (url ?? "").match(/my\.raceresult\.com\/(\d+)/i);
  return m?.[1] ?? null;
}

export async function fetchRaceResultContests(eventId: string): Promise<string[]> {
  const res = await fetch(
    `https://my.raceresult.com/${eventId}/RRPublish/data/config?page=lists&noVisitor=1`,
    { headers: { "user-agent": "letsrace-catalog/1.0 (+https://letsrace.cz)" } },
  );
  if (!res.ok) return [];
  const body = (await res.json()) as { contests?: Record<string, string> };
  return Object.values(body.contests ?? {}).filter((v): v is string => typeof v === "string");
}
