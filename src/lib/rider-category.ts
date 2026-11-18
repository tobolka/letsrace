import { CATEGORY_AGES, referenceYear } from "@/lib/birth-years";

/**
 * Which of a race's categories a rider born in a given year belongs to, and
 * what it costs: "Ela → holky 7-8 · 200 Kč". The organiser's own list from the
 * regulations first; the race's general age groups only when the regulations
 * give no ages at all.
 *
 * Nothing is guessed. A category whose ages cannot be read is left out, a
 * rider who fits none gets no line, and a fee is shown only when the fee list
 * names the category itself.
 */

/** Born from `from` to `to`, inclusive; null for an open end. */
export type BirthYearBounds = { from: number | null; to: number | null };

export type RiderCategoryRow = { label: string; birthYears?: string };
export type RiderFeeRow = { label: string; amount: number; currency: string; validUntil?: string };

export type RiderCategoryMatch = {
  label: string;
  /** What the organiser wrote for the ages, when the label does not already say it. */
  birthYears?: string;
  /** One price, or the cheapest and dearest when the list gives several for this category (early and late entry). */
  fee?: { amount: number; maxAmount?: number; currency: string };
  /** The race's general age group, not the organiser's own category. */
  taxonomyId?: string;
  /** The age groups are last year's, not yet confirmed for this edition. */
  asLastYear?: boolean;
};

const YEAR = /\b(19\d{2}|20\d{2})\b/g;
const OLDER = /(starš|\bst\.|star(si|szi)|older|earlier|älter|aelter|precedent|<=|≤|=<|\bbis\b)/i;
const YOUNGER = /(mladš|\bml\.|młods|mlods|younger|later|jünger|juenger|successiv|>=|≥|=>|\bab\b)/i;
const AGE_UNIT = /\b(let|lat|roků|rokov|jahre?|j\.|anni|years?|yrs)\b|\d\s*(let|lat|j\.?)\b/i;

/**
 * The birth years a category's ages text stands for: "2019-2020", "2013/2014",
 * "2017 t/m 2019", "<= 2008", "2008 a starší", "ročníky 1998 a ml.", a single
 * year, or ages ("40-49 Jahre", "do 15 lat", "60 a více let", "U13") counted
 * from `refYear`. Null when it cannot be read with confidence.
 */
export function parseBirthYears(text: string, refYear: number, opts: { label?: boolean } = {}): BirthYearBounds | null {
  const s = text.normalize("NFKC").trim();
  if (!s) return null;
  const years = [...s.matchAll(YEAR)].map((m) => Number(m[1]));
  if (years.length > 2) return null;
  if (years.length === 2) {
    const [a, b] = years as [number, number];
    return { from: Math.min(a, b), to: Math.max(a, b) };
  }
  if (years.length === 1) {
    const year = years[0]!;
    const older = OLDER.test(s), younger = YOUNGER.test(s);
    if (older && younger) return null;
    if (older) return { from: null, to: year };
    if (younger) return { from: year, to: null };
    // In a category's name a lone year may be the edition ("Cup 2027"), not a birth year.
    if (opts.label) return null;
    return { from: year, to: year };
  }
  return parseAges(s, refYear, opts);
}

function parseAges(s: string, refYear: number, opts: { label?: boolean }): BirthYearBounds | null {
  const ages = (min: number | null, max: number | null): BirthYearBounds | null => {
    if (min == null && max == null) return null;
    if ((min != null && (min < 1 || min > 99)) || (max != null && (max < 1 || max > 99))) return null;
    if (min != null && max != null && min > max) return null;
    return { from: max == null ? null : refYear - max, to: min == null ? null : refYear - min };
  };
  // "U13", "WU15": the UCI's two-year groups, racing age below the number.
  const UNDER = /\b[WM]?U-?(\d{1,2})\b/gi;
  const under = new Set([...s.matchAll(UNDER)].map((m) => Number(m[1])));
  if (under.size === 1 && !/\d/.test(s.replace(UNDER, ""))) {
    const n = [...under][0]!;
    return ages(n - 2, n - 1);
  }
  if (under.size) return null;
  // A name's numbers are ages only when it says so ("holky 7-8" is read from
  // the birth years beside it, "muži 40" is not a range).
  const unit = AGE_UNIT.test(s);
  if (opts.label && !unit) return null;
  const nums = [...s.matchAll(/\d+/g)].map((m) => Number(m[0]));
  const andUp = s.match(/(\d{1,2})\s*(?:let|lat|roků|rokov|jahre|j\.|anni|years)?\s*(?:a více|a vice|a starší|a starsi|i więcej|i starsi|e più|e oltre|and over|and older|und älter|\+)/i);
  if (andUp) return ages(Number(andUp[1]), null);
  if (nums.length === 2) {
    const range = s.match(/(?<![\p{L}\d])(\d{1,2})\s*(?:-|–|—|\/|do|bis|to|t\/m)\s*(\d{1,2})(?!\d)/iu);
    return range ? ages(Number(range[1]), Number(range[2])) : null;
  }
  if (nums.length !== 1 || !unit) return null;
  const n = nums[0]!;
  if (/(?:powyżej|powyzej|\bnad|über|\bover|oltre)\s+\d/i.test(s)) return ages(n + 1, null);
  if (/(?:\bab|\bod|\bfrom|\bdai|\bda)\s+\d/i.test(s)) return ages(n, null);
  if (/(?:\bdo|\bbis|\bunder|\bunter|fino a)\s+\d/i.test(s)) return ages(null, n);
  return null;
}

/** Labels compared as a reader would: case, spacing and stray punctuation aside. */
function norm(label: string): string {
  return label.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").replace(/^[\s.:;,–-]+|[\s.:;,–-]+$/g, "").trim();
}

function containsWords(haystack: string, needle: string): boolean {
  const i = haystack.indexOf(needle);
  if (i < 0) return false;
  const before = haystack[i - 1], after = haystack[i + needle.length];
  const boundary = (ch: string | undefined) => ch == null || !/[\p{L}\p{N}]/u.test(ch);
  return boundary(before) && boundary(after);
}

/**
 * The fee for one category, read by its name alone: the fee row named exactly
 * like it, else the rows whose name contains it and no other category's name.
 * Expired early-entry prices are dropped; when several prices remain they are
 * shown as a span, never one picked.
 */
export function feeForCategory(
  label: string,
  fees: RiderFeeRow[],
  allLabels: string[],
  today: string,
): RiderCategoryMatch["fee"] | undefined {
  const own = norm(label);
  if (!own) return undefined;
  const current = fees.filter((f) => !f.validUntil || f.validUntil >= today);
  let rows = current.filter((f) => norm(f.label) === own);
  if (!rows.length) {
    const others = allLabels.map(norm).filter((l) => l && l !== own);
    rows = current.filter((f) => {
      const name = norm(f.label);
      if (!containsWords(name, own)) return false;
      // "muži 40" contains "muži", but it is the fee of "muži 40".
      return !others.some((other) => containsWords(name, other) && !containsWords(own, other));
    });
  }
  if (!rows.length) return undefined;
  const currency = rows[0]!.currency;
  if (rows.some((r) => r.currency !== currency)) return undefined;
  const amounts = rows.map((r) => r.amount);
  const min = Math.min(...amounts), max = Math.max(...amounts);
  return max === min ? { amount: min, currency } : { amount: min, maxAmount: max, currency };
}

export type RiderRaceFacts = {
  startDate: string;
  disciplines: string[];
  categories?: RiderCategoryRow[];
  fees?: RiderFeeRow[];
  ageCategories?: string[];
  ageConfidence?: "explicit" | "previous" | "default" | null;
  /** Categories with ages from a calendar or sign-up list, for a race whose regulations have not been read. */
  listedCategories?: { name: string; ageMin: number | null; ageMax: number | null }[];
};

const within = (year: number, b: BirthYearBounds) => (b.from == null || year >= b.from) && (b.to == null || year <= b.to);

export type RiderGender = "female" | "male";

/** A stored gender as the matcher takes it; anything else is "not given". */
export function asRiderGender(value: unknown): RiderGender | null {
  return value === "female" || value === "male" ? value : null;
}

const FEMALE = new Set([
  "holky", "holka", "dívky", "divky", "dívka", "ženy", "zeny", "žena", "žákyně", "zakyne", "kadetky", "juniorky", "veteránky", "dorostenky", "mladší žákyně",
  "girls", "girl", "women", "woman", "ladies", "female", "wu", "f",
  "damen", "frauen", "mädchen", "juniorinnen", "schülerinnen", "weiblich", "weibl",
  "kobiety", "kobiet", "dziewczęta", "dziewczynki", "juniorki", "młodziczki", "kadetki", "żaczki",
  "donne", "femminile", "ragazze", "esordienti donne", "allieve",
  "dievčatá", "žiačky", "kadetky", "ž",
]);
const MALE = new Set([
  "kluci", "kluk", "chlapci", "chlapec", "muži", "muzi", "muž", "žáci", "zaci", "kadeti", "junioři", "juniori", "veteráni", "dorostenci",
  "boys", "boy", "men", "man", "male", "m", "mu",
  "herren", "männer", "buben", "jungen", "junioren", "schüler", "männlich", "maennlich", "männl",
  "mężczyźni", "mężczyzn", "chłopcy", "juniorzy", "młodzicy", "kadeci", "żacy",
  "uomini", "maschile", "ragazzi", "allievi",
  "žiaci",
]);
const MIXED = /\b(mixed?|mix|smíšen|smisen|mieszan|misto|gemischt|open)\b/i;

/**
 * Whose category a name describes: "holky 7-8" female, "kluci 7-8" male,
 * "kadeti, kadetky" or "Masters Men / Women" mixed, "Děti" neither (null).
 */
export function categoryGender(label: string): RiderGender | "mixed" | null {
  if (MIXED.test(label)) return "mixed";
  const tokens = label.normalize("NFKC").toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  const female = tokens.some((t) => FEMALE.has(t)), male = tokens.some((t) => MALE.has(t));
  return female && male ? "mixed" : female ? "female" : male ? "male" : null;
}

/**
 * Every category a rider born in `birthYear` fits, in the organiser's order; [] when none.
 * With the rider's gender known, the other gender's categories are left out;
 * mixed and unnamed ones stay.
 */
export function matchRiderCategories(
  birthYear: number,
  race: RiderRaceFacts,
  { today = new Date().toISOString().slice(0, 10), gender = null }: { today?: string; gender?: RiderGender | null } = {},
): RiderCategoryMatch[] {
  const ref = referenceYear(race.startDate, race.disciplines);
  const fitsGender = (label: string) => {
    if (!gender) return true;
    const of = categoryGender(label);
    return of == null || of === "mixed" || of === gender;
  };
  const rows = race.categories ?? [];
  const read = rows.map((row) => ({
    row,
    bounds: row.birthYears ? parseBirthYears(row.birthYears, ref) : parseBirthYears(row.label, ref, { label: true }),
  }));
  if (read.some((r) => r.bounds)) {
    const labels = rows.map((r) => r.label);
    return read
      .filter((r) => r.bounds && within(birthYear, r.bounds))
      .filter(({ row }) => fitsGender(row.label))
      .map(({ row }) => {
        const fee = race.fees?.length ? feeForCategory(row.label, race.fees, labels, today) : undefined;
        return { label: row.label, ...(row.birthYears ? { birthYears: row.birthYears } : {}), ...(fee ? { fee } : {}) };
      });
  }
  // No ages in the regulations: the categories a calendar or sign-up list gives with ages.
  const listed = (race.listedCategories ?? []).filter((c) => c.ageMin != null || c.ageMax != null);
  if (listed.length) {
    const seen = new Set<string>();
    return listed
      .filter((c) => within(birthYear, { from: c.ageMax == null ? null : ref - c.ageMax, to: c.ageMin == null ? null : ref - c.ageMin }))
      .filter((c) => fitsGender(c.name))
      .filter((c) => !seen.has(c.name.trim().toLowerCase()) && Boolean(seen.add(c.name.trim().toLowerCase())))
      .map((c) => ({ label: c.name.trim() }));
  }
  // Nothing with ages from the race itself: its age groups, only when a source named them.
  if (race.ageConfidence !== "explicit" && race.ageConfidence !== "previous") return [];
  const out: RiderCategoryMatch[] = [];
  for (const id of race.ageCategories ?? []) {
    const ages = CATEGORY_AGES[id];
    if (!ages || (ages[0] == null && ages[1] == null)) continue;
    const bounds = { from: ages[1] == null ? null : ref - ages[1], to: ages[0] == null ? null : ref - ages[0] };
    if (within(birthYear, bounds)) out.push({ label: id, taxonomyId: id, ...(race.ageConfidence === "previous" ? { asLastYear: true } : {}) });
  }
  return out;
}

/**
 * The categories and fees of a race's stored regulations, without the full
 * schema (which the plan's download does not need): only this edition's lists.
 */
export function riderFactsFromStored(raw: unknown, startDate: string): Pick<RiderRaceFacts, "categories" | "fees"> {
  if (!raw || typeof raw !== "object") return {};
  const year = Number(startDate.slice(0, 4));
  const list = (field: unknown) => {
    if (!field || typeof field !== "object") return undefined;
    const f = field as { editionYear?: unknown; value?: unknown };
    return f.editionYear === year && Array.isArray(f.value) ? (f.value as unknown[]) : undefined;
  };
  const d = raw as Record<string, unknown>;
  const categories = list(d.categories)
    ?.filter((c): c is { label: string; birthYears?: unknown } => Boolean(c) && typeof (c as { label?: unknown }).label === "string")
    .map((c) => ({ label: c.label, ...(typeof c.birthYears === "string" ? { birthYears: c.birthYears } : {}) }));
  const fees = list(d.fees)
    ?.filter((f): f is RiderFeeRow => {
      const x = f as Partial<RiderFeeRow> | null;
      return Boolean(x) && typeof x!.label === "string" && typeof x!.amount === "number" && typeof x!.currency === "string";
    })
    .map((f) => ({ label: f.label, amount: f.amount, currency: f.currency, ...(typeof f.validUntil === "string" ? { validUntil: f.validUntil } : {}) }));
  return { ...(categories?.length ? { categories } : {}), ...(fees?.length ? { fees } : {}) };
}
