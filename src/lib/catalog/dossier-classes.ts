import { ageCategoriesFromList } from "@/lib/age-bands";
import { AGE_CATEGORIES, type AgeCategory } from "@/lib/taxonomy";
import { askJson, HAIKU, type LlmUsage } from "@/lib/llm/anthropic";
import { classLineCount, type DossierDoc } from "@/lib/catalog/dossier";
import { classesInQuote } from "@/lib/catalog/llm-enrich";

const CLASS_LINE =
  /\bU\s?-?\d{1,2}\b|\bjg\.?\s*\d|\b(19|20)\d\d\s*[-–/]\s*(19|20)?\d\d\b|kategori|categor|klasse|klasy|ro[čc]n[ií]k|rocznik|junior|master|elit[ea]\b|kadet|[žz][aá]c|[žz][aá]k|senior|hobby|amat|open|giovanissimi|esordienti|allievi|nieuwelingen|aspiranten|benjamin|minime|cadet|herren|damen|mu[žz]i|[žz]eny|men\b|women|kobiety|m[eę][żz]czy|uomini|donne|years|let\b|lat\b|jahre|anni/i;

/**
 * The documents that belong to this edition: those that name its day, and the
 * pages a dated site links to that name no other year.
 */
export function editionDocs(docs: DossierDoc[], startDate: string, names: string[] = []): DossierDoc[] {
  const y = startDate.slice(0, 4);
  const words = names.flatMap((n) => fold(n).split(/[^a-z0-9]+/)).filter((w) => w.length >= 4 && !GENERIC.test(w));
  const kidsRace = names.some((n) => KIDS_RACE.test(n));
  const own = (d: DossierDoc) => !words.length || words.some((w) => fold(d.text).includes(w));
  const datedHosts = new Set(docs.filter((d) => d.thisEdition && d.kind !== "listing").map((d) => host(d.url)));
  return docs.filter((d) => {
    // Results, a platform's front page, a calendar of many races: not this race's classes.
    if (RESULTS.test(d.url) || platformRoot(d.url) || distinctDates(d.text) > 25) return false;
    // A binary Word file read as text, or another broken extract.
    if (garbled(d.text)) return false;
    // The kids' page of a race that is not a kids' race.
    if (!kidsRace && /kinder|kids|nachwuchs|jugend|d[ěe]ti|mladez|giovan|bambin|dzieci|enfants/i.test(d.url)) return false;
    // A document about this race names it or its town.
    if (!own(d)) return false;
    if (d.thisEdition) return true;
    if (d.kind === "listing") return false;
    const years = new Set(d.text.match(/(?<!\d)20\d\d(?!\d)/g) ?? []);
    const otherYearOnly = years.size > 0 && !years.has(y) && ![...years].some((x) => Number(x) === Number(y) + 1);
    return datedHosts.has(host(d.url)) && !otherYearOnly;
  });
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const GENERIC = /^(race|rennen|zavod|zavody|cup|pohar|kolo|serie|series|gran|fondo|memorial|trofeo|premio|grand|prix|cross|cyklokros|mtb|gravel|road|bike|tour|2026|2027|edition|ronde|giro)$/;
export const KIDS_RACE = /kids|kinder|d[ěe]ti|d[ěe]tsk|ml[aá]de|youth|jugend|nachwuchs|giovan|[žz][aá]k|dzieci|mini|pupil|jeunes|petits|junior/i;
function garbled(text: string): boolean {
  const sample = text.slice(0, 4000);
  const bad = (sample.match(/[\uFFFD\u0000-\u0008]|[^\p{L}\p{N}\s.,;:!?()\-–/&'"%€+°*#@_=\[\]|<>]/gu) ?? []).length;
  return sample.length > 200 && bad / sample.length > 0.04;
}
const RESULTS = /result|ergebnis|wyniki|v[yý]sledk|risultati|classifica|uitslag/i;

function platformRoot(u: string): boolean {
  try {
    const x = new URL(u);
    return x.pathname.replace(/\/+$/, "") === "" && /raceresult|datasport|sportsoft|racetime|dostartu|endu|atleta|eventbrite|sportstiming/i.test(x.hostname);
  } catch {
    return false;
  }
}

/** How many different day-month dates a text names: a calendar names dozens. */
function distinctDates(text: string): number {
  return new Set(text.match(/(?<![\d.])\d{1,2}\.\s?\d{1,2}\.(?!\d)/g) ?? []).size;
}

function host(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

/** Numbered candidate lines a model can point at. */
export function candidateLines(docs: DossierDoc[], max = 150): { n: number; line: string; url: string }[] {
  const out: { n: number; line: string; url: string }[] = [];
  const seen = new Set<string>();
  const ranked = [...docs].sort((a, b) => b.classLines - a.classLines);
  for (const d of ranked) {
    if (classLineCount(d.text) < 2) continue;
    for (const raw of d.text.split(/\n+/)) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (line.length < 2 || line.length > 220 || !CLASS_LINE.test(line)) continue;
      const k = line.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ n: out.length + 1, line, url: d.url });
      if (out.length >= max) return out;
    }
  }
  return out;
}

const SYSTEM =
  "You get numbered lines taken from one cycling race's own documents (its site, entry page, regulations). " +
  "Return the numbers of the lines that name a class (category) a rider can enter in THIS race: age groups, U-classes, birth-year classes, elite/hobby/masters, men/women classes. " +
  "Leave out prize lists, results, start times that do not name a class, other events' classes, and general federation tables not tied to this race. " +
  'Also say whether THIS race is only for children or youth (a kids\' cup, a youth series), as the lines show it. ' +
  'Answer JSON only: {"lines":[numbers],"youth_only":true|false}. If none, {"lines":[],"youth_only":false}.';

/**
 * The classes a race states, found by pointing: the model only says which of
 * the candidate lines are the class list; the bands come from those lines,
 * by code.
 */
export async function classesFromDossier(
  race: { name: string; startDate: string; place?: string | null },
  docs: DossierDoc[],
): Promise<{ ages: AgeCategory[]; lines: { line: string; url: string }[]; youthOnly?: boolean; usage: LlmUsage | null }> {
  const lines = candidateLines(editionDocs(docs, race.startDate, [race.name, race.place ?? ""]));
  if (lines.length < 2) return { ages: [], lines: [], usage: null };
  const { json, usage } = await askJson<{ lines?: number[]; youth_only?: boolean }>({
    system: SYSTEM,
    user: `Race: ${race.name}, ${race.startDate}\n\n${lines.map((l) => `${l.n}. ${l.line}`).join("\n")}`,
    model: HAIKU,
    maxTokens: 400,
  });
  const picked = lines.filter((l) => (json?.lines ?? []).includes(l.n)).filter((l) => listLike(l.line, l.url));
  return { ...bandsFromLines(picked, race.startDate), lines: picked.map(({ line, url }) => ({ line, url })), youthOnly: json?.youth_only === true, usage };
}

/**
 * A line from a class list, not a sentence of prose that happens to say
 * "Elite": short, or an Italian federation record's own field.
 */
export function listLike(line: string, url: string): boolean {
  if (/federciclismo\.it\/race\/detail/.test(url) && /classe:|categorie ammesse/i.test(line)) return true;
  if (line.length <= 140) return true;
  // A long line that enumerates classes ("Master 1 (30-34 J.) - Master 2 …"),
  // not a paragraph that mentions one.
  const tokens = line.match(new RegExp(CLASS_LINE.source, "gi")) ?? [];
  return tokens.length >= 4;
}

/** Bands named by class-list lines, each line read part by part. */
export function bandsFromLines(lines: { line: string }[], startDate: string): { ages: AgeCategory[] } {
  const names = lines.flatMap((l) => [
    l.line,
    ...classesInQuote(l.line),
    ...l.line.split(/\s[-–]\s|\.\s|\s(?:e|a|und|and|et|i|y|oraz|en)\s|(?<=[A-Za-zÀ-ž])-(?=[A-Za-zÀ-ž])/i),
  ]);
  const ages = ageCategoriesFromList(names.map((name) => ({ name })), { refYear: Number(startDate.slice(0, 4)) });
  return { ages: AGE_CATEGORIES.filter((a) => ages.includes(a)) };
}

/**
 * Whether a found list is safe to state. Two classes at least — or the one
 * class an Italian federation race record names ("Classe: (1.23) Donne
 * Juniores"); an adult band unless the race is a children's race. A partial
 * list stated as the whole would hide the race from everyone left out.
 */
export function statable(race: { name: string }, found: { ages: AgeCategory[]; lines: { line: string; url: string }[]; youthOnly?: boolean }): boolean {
  const specific = found.ages.filter((a) => a !== "kids" && a !== "youth");
  const adults = found.ages.some((a) => ["junior", "u23", "elite", "amateur", "masters"].includes(a));
  const fciRecord = found.lines.some((l) => /federciclismo\.it\/race\/detail/.test(l.url) && /classe:|categorie ammesse/i.test(l.line));
  if (fciRecord && specific.length >= 1) return true;
  // Children's classes alone only for a children's race: by its name, or by
  // its own documents (a kids' series the name does not reveal).
  return found.lines.length >= 2 && specific.length >= 2 && (adults || KIDS_RACE.test(race.name) || found.youthOnly === true);
}
