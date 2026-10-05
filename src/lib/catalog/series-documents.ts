import { ageCategoriesFromList } from "@/lib/age-bands";
import { type AgeCategory } from "@/lib/taxonomy";
import { classesInQuote } from "@/lib/catalog/llm-enrich";

export type SeriesDocumentVerdict = {
  applies_all_rounds?: boolean;
  complete_categories?: boolean;
  exceptions?: string[];
  series_quote?: string;
  season?: string;
  season_quote?: string;
  season_quotes?: string[];
  category_lines?: number[];
  rules_document?: boolean;
};
export type SeriesDocumentEvidence = { ages: AgeCategory[]; seasonStart: number; seasonEnd: number; quote: string; rules: boolean };
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** A model points to an entire, season-scoped series list; code checks every quote. */
export function verifySeriesDocument(name: string, text: string, verdict: SeriesDocumentVerdict | null): SeriesDocumentEvidence | null {
  if (!verdict || verdict.applies_all_rounds !== true || !Array.isArray(verdict.exceptions) || verdict.exceptions.length) return null;
  if (verdict.complete_categories !== true && verdict.rules_document !== true) return null;
  const hay = fold(text);
  const seasonQuotes = verdict.season_quotes?.length ? verdict.season_quotes : [verdict.season_quote ?? ""];
  if (!verdict.series_quote || !hay.includes(fold(verdict.series_quote)) || seasonQuotes.some((q) => !q || !hay.includes(fold(q)))) return null;
  const words = fold(name).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !/^(bike|cross|cyclocross|tour|series|serie|202\d)$/.test(w));
  if (!words.length || !words.every((w) => fold(verdict.series_quote!).includes(w))) return null;
  const season = verdict.season?.match(/^(20\d\d)(?:[/-](20\d\d|\d\d))?$/);
  if (!season) return null;
  const start = Number(season[1]);
  const end = season[2] ? Number(season[2].length === 2 ? `20${season[2]}` : season[2]) : start;
  if (end < start || end > start + 1) return null;
  const seasonPattern = end === start ? new RegExp(`\\b${start}\\b`) : new RegExp(`\\b(?:${start}|${String(start).slice(2)})\\s*[/-]\\s*(?:${end}|${String(end).slice(2)})\\b`);
  const datedSeason = end !== start && seasonQuotes.length === 2
    && new RegExp(`\\b\\d{1,2}\\.\\d{1,2}\\.${start}\\b`).test(seasonQuotes[0]!)
    && new RegExp(`\\b\\d{1,2}\\.\\d{1,2}\\.${end}\\b`).test(seasonQuotes[1]!);
  // Office documents often keep the season heading in an image. A dated
  // race calendar inside verified common rules proves the same season.
  const calendar = text.split(/\n+/).map((line) => line.trim()).filter((line) => /\b\d{1,2}\.\d{1,2}\.20\d\d\b/.test(line));
  const calendarSeason = verdict.rules_document === true && calendar.length >= 3 && end !== start
    && calendar.some((line) => new RegExp(`\\b\\d{1,2}\\.\\d{1,2}\\.${start}\\b`).test(line))
    && calendar.some((line) => new RegExp(`\\b\\d{1,2}\\.\\d{1,2}\\.${end}\\b`).test(line));
  if (!seasonQuotes.some((q) => seasonPattern.test(q)) && !datedSeason && !calendarSeason) return null;
  const scopeQuote = [verdict.series_quote, ...seasonQuotes, ...(calendarSeason ? calendar : [])].join(" | ");
  // Common propositions can be useful even when no complete class list is
  // published. Such evidence must never set category confidence to explicit.
  if (verdict.complete_categories !== true) return { ages: [], seasonStart: start, seasonEnd: end, quote: scopeQuote, rules: true };
  const lines = text.split(/\n+/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const selected = [...new Set(verdict.category_lines ?? [])];
  if (selected.length < 2 || selected.some((n) => !Number.isInteger(n) || n < 1 || n > lines.length)) return null;
  const quotes = selected.map((n) => lines[n - 1]!);
  // Cup standings may omit eligible riders (e.g. hobby or younger children).
  // They prove the propositions URL, never an exhaustive admission list.
  const standings = selected.some((n) => lines.slice(Math.max(0, n - 4), n).some((line) => /cup[- ]?endwertung|punktewertung|preisgeld|points standings|prize categories/i.test(line)));
  if (standings) return verdict.rules_document === true ? { ages: [], seasonStart: start, seasonEnd: end, quote: scopeQuote, rules: true } : null;
  // Birth-year classes in a cross-year season require explicit age reference;
  // use named U/classes instead of silently shifting bands by one year.
  if (end !== start && quotes.some((q) => /\b(?:19|20)\d\d\s*[-–]\s*(?:19|20)\d\d\b/.test(q)) && !quotes.every((q) => /\bU\s*\d|kids|junior|master|elit|hobby/i.test(q))) return null;
  const classes = quotes.flatMap((quote) => classesInQuote(quote
    .replace(/\b(U\s*\d{1,2})\/(\d{1,2})\b/gi, "$1/U$2")
    .replace(/\b(U\s*\d{1,2})([mw])\b/gi, "$1 $2")));
  const ages = ageCategoriesFromList(classes.map((name) => ({ name })), { refYear: start });
  if (!ages.length) return null;
  // A line with several U-classes must not silently map only its first class.
  const statedU = [...quotes.join(" ").matchAll(/\b(?:[MW])?U\s*-?\s*(\d{1,2})\b/gi)].map((m) => `U${m[1]}`);
  const expectedU = ageCategoriesFromList(statedU.map((name) => ({ name })), { refYear: start });
  if (expectedU.some((age) => !ages.includes(age))) return verdict.rules_document === true ? { ages: [], seasonStart: start, seasonEnd: end, quote: scopeQuote, rules: true } : null;
  // Even a correct full source list is unsafe if our mapper drops children.
  if (quotes.some((q) => /\bkids?\b|\bkinder\b|\bmini kids\b/i.test(q)) && !ages.includes("kids")) return null;
  return { ages, seasonStart: start, seasonEnd: end, quote: [scopeQuote, ...quotes].join(" | "), rules: verdict.rules_document === true };
}

export function roundWithinSeriesSeason(date: string, evidence: Pick<SeriesDocumentEvidence, "seasonStart" | "seasonEnd">): boolean {
  // Winter seasons do not justify a later summer or autumn edition.
  const first = `${evidence.seasonStart}-${evidence.seasonEnd === evidence.seasonStart ? "01" : "07"}-01`;
  const last = `${evidence.seasonEnd}-${evidence.seasonEnd === evidence.seasonStart ? "12" : "06"}-${evidence.seasonEnd === evidence.seasonStart ? "31" : "30"}`;
  return date >= first && date <= last;
}
