import * as cheerio from "cheerio";
import type { ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { DISCIPLINES, type Discipline } from "@/lib/taxonomy";
import { ageCategoriesFromList } from "@/lib/age-bands";
import { askJson, addUsage, NO_USAGE, type LlmUsage } from "@/lib/llm/anthropic";

const CHUNK = 36_000;
const MAX_CHUNKS = 5;

/**
 * A page as text a model can read, links kept inline as [text](url) so a race
 * can be tied to its own page, table cells kept apart with " | ".
 */
export function pageAsText(html: string, base: string): { text: string; links: Set<string> } {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, nav, header, footer, form, [aria-hidden=true]").remove();
  const links = new Set<string>();
  $("a[href]").each((_, a) => {
    const raw = ($(a).attr("href") || "").trim();
    const label = $(a).text().replace(/\s+/g, " ").trim();
    if (!raw || /^(mailto:|tel:|javascript:|#)/i.test(raw)) return;
    let url: string;
    try {
      url = new URL(raw, base).toString();
    } catch {
      return;
    }
    links.add(url);
    $(a).replaceWith(label ? `[${label}](${url})` : `(${url})`);
  });
  $("br").replaceWith(" ");
  // A table row on one line, cells apart: a race is its row.
  $("tr").each((_, tr) => {
    const cells = $(tr)
      .children("td, th")
      .map((_, c) => $(c).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean);
    $(tr).replaceWith(`${cells.join(" | ")}\n`);
  });
  $("p, div, li, tr, h1, h2, h3, h4, h5, h6, section, article, table, dt, dd").each((_, el) => {
    $(el).append("\n");
  });
  const text = $("body")
    .text()
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, links };
}

/** Cut on line breaks, so no row is split between two requests. */
export function chunks(text: string, size = CHUNK, max = MAX_CHUNKS): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length && out.length < max) {
    if (rest.length <= size) {
      out.push(rest);
      break;
    }
    let cut = rest.lastIndexOf("\n", size);
    if (cut < size * 0.5) cut = size;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  return out;
}

type RawRace = {
  name?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  place?: unknown;
  country?: unknown;
  disciplines?: unknown;
  url?: unknown;
  categories?: unknown;
  cancelled?: unknown;
  quote?: unknown;
};

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
/** What a quote and the page are compared on: no link targets, no table bars or brackets, single spaces. */
export const skeleton = (s: string) =>
  fold(s)
    .replace(/\]\([^)]*\)/g, " ")
    .replace(/[|[\]()*_#>"“”„'«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Keep a race only if the page shows it: its row quoted word for word, the
 * name inside that row, the day of the month inside it too, and a link that
 * was really on the page.
 */
export function verifyRaces(raw: RawRace[], text: string, links: Set<string>, sourceUrl: string, today: string): ParsedEvent[] {
  const hay = skeleton(text);
  const out: ParsedEvent[] = [];
  const host = (() => {
    try {
      return new URL(sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      return "page";
    }
  })();
  for (const r of raw) {
    if (typeof r.name !== "string" || typeof r.start_date !== "string" || typeof r.quote !== "string") continue;
    const name = r.name.replace(/\s+/g, " ").trim();
    const start = r.start_date.trim();
    if (name.length < 3 || !ISO.test(start)) continue;
    const quote = skeleton(r.quote);
    if (quote.length < 6 || !hay.includes(quote)) continue;
    // The name must come from the row, not from the model.
    const words = fold(name).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
    if (!words.length || words.filter((w) => quote.includes(w) || hay.includes(w)).length < Math.ceil(words.length * 0.7)) continue;
    // The day must be in the row (or a nearby heading the quote includes).
    const day = String(Number(start.slice(8, 10)));
    if (!new RegExp(`(^|\\D)0?${day}(\\D|$)`).test(quote)) continue;
    const end = typeof r.end_date === "string" && ISO.test(r.end_date) && r.end_date >= start ? r.end_date : undefined;
    if ((end ?? start) < today) continue;
    const disciplines = Array.isArray(r.disciplines)
      ? (r.disciplines.filter((d) => typeof d === "string" && (DISCIPLINES as readonly string[]).includes(d) && d !== "other") as Discipline[])
      : [];
    const url = typeof r.url === "string" && links.has(r.url) ? r.url : undefined;
    const categories = Array.isArray(r.categories) ? r.categories.filter((c): c is string => typeof c === "string" && hay.includes(skeleton(c))) : [];
    const ages = categories.length >= 2 ? ageCategoriesFromList(categories.map((c) => ({ name: c })), { refYear: Number(start.slice(0, 4)) }) : [];
    const place = typeof r.place === "string" ? r.place.trim() : "";
    const country = typeof r.country === "string" && /^[A-Z]{2}$/.test(r.country) ? r.country : undefined;
    out.push({
      externalId: `llm-${host}-${normalizeName(name).slice(0, 60)}-${start}`,
      name,
      startDate: start,
      endDate: end,
      placeText: place,
      countryHint: country,
      discipline: disciplines.length ? disciplines : undefined,
      ageCategories: ages.length >= 2 ? ages : undefined,
      sourceUrl: url ?? sourceUrl,
      websiteUrl: url && !url.startsWith(new URL(sourceUrl).origin) ? url : undefined,
      confidence: 0.7,
    });
  }
  // One row per race and day.
  return [...new Map(out.map((e) => [e.externalId, e])).values()];
}

const SYSTEM =
  "You read a web page that may list cycling events (a calendar, a series page, a club page, a federation list) and return every cycling race or organised ride it lists. " +
  'Answer with JSON only: {"races":[{"name":"","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD or null","place":"town as written","country":"ISO-3166 alpha-2 or null","disciplines":["<id>"],"url":"<link of this race from the text, or null>","categories":["<class as written>"],"cancelled":false,"quote":"<verbatim>"}]}. ' +
  "quote: copy, character for character, the shortest stretch of the page (at most 200 characters) that contains this race's name and its date — usually its row or line. " +
  "name: the race's own name as the row gives it; where the row names only a series or a round (\"JANEV Cup\", \"3. závod\"), write it as \"<that> — <place>\". " +
  "Dates: use the year the page gives; where a row has no year, take the season the page is about. " +
  "Discipline ids: xco, xcc, xce, xcm (MTB marathon), mtb (other MTB), dh, enduro, gravel, road, road_race, tt, criterium, hill_climb, gran_fondo, cx (cyclocross), track, bmx. Leave empty if the page does not say. " +
  "url: only a link that appears in the text as (url) for this race. categories: only classes the row names. " +
  "Skip anything that is not a cycling event (running, triathlon unless it is a duathlon with a bike leg, meetings, news). " +
  'If the page lists no events, answer {"races":[]}. Never invent; leave a field null rather than guess.';

/** Spent by this process on calendar pages; a run stops asking past its budget. */
let spentUsd = 0;
export function calendarBudgetLeft(): boolean {
  return spentUsd < Number(process.env.LLM_CALENDAR_BUDGET_USD ?? 0.25);
}

/**
 * Any calendar, read by a language model: the fallback for a page no adapter
 * knows. One request per ~36k characters of page text; each race it returns
 * must be quoted from the page (see {@link verifyRaces}).
 */
export async function extractWithLlm(
  url: string,
  html: string,
  opts?: { today?: string; maxChunks?: number },
): Promise<{ events: ParsedEvent[]; usage: LlmUsage; truncated: boolean }> {
  const today = opts?.today ?? new Date().toISOString().slice(0, 10);
  const { text, links } = pageAsText(html, url);
  if (text.length < 200) return { events: [], usage: NO_USAGE, truncated: false };
  const parts = chunks(text, CHUNK, opts?.maxChunks ?? MAX_CHUNKS);
  let usage = NO_USAGE;
  let truncated = parts.join("").length < text.length;
  const events: ParsedEvent[] = [];
  for (const part of parts) {
    const { json, usage: u, stopReason } = await askJson<{ races?: RawRace[] }>({
      system: SYSTEM,
      user: `Today is ${today}. Page: ${url}\n\n${part}`,
      maxTokens: 16_000,
      timeoutMs: 180_000,
    });
    usage = addUsage(usage, u);
    spentUsd += u.costUsd;
    if (stopReason === "max_tokens") truncated = true;
    events.push(...verifyRaces(json?.races ?? [], part, links, url, today));
  }
  return { events: [...new Map(events.map((e) => [e.externalId, e])).values()], usage, truncated };
}
