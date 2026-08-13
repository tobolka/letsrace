import * as cheerio from "cheerio";
import type { ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { inferRaceLevel } from "@/lib/race-level";

/**
 * ČSC public calendar sources.
 * portal.czechcyclingfederation.com is Blazor (no stable public list API) —
 * we watch it for discovery and parse data.ceskysvazcyklistiky.cz when available.
 */
export function parseCscCalendar(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];

  // Table rows / cards with dates
  $("tr, .race-item, .calendar-item, article, li").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length < 10 || text.length > 400) return;

    const iso = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
    const cs = text.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/);
    let startDate = "";
    if (iso) startDate = `${iso[1]}-${iso[2]}-${iso[3]}`;
    else if (cs) {
      startDate = `${cs[3]}-${cs[2].padStart(2, "0")}-${cs[1].padStart(2, "0")}`;
    }
    if (!startDate) return;

    const link = $(el).find("a[href]").first().attr("href");
    const name =
      $(el).find("a, strong, .name, .title").first().text().replace(/\s+/g, " ").trim() ||
      text.replace(iso?.[0] || cs?.[0] || "", "").trim().slice(0, 120);
    if (name.length < 4) return;

    const level = inferRaceLevel(text + " " + name);
    const categories: ParsedEvent["categories"] = [];
    if (/mlž|mladší žák/i.test(text)) categories.push({ name: "MLŽ", ageMin: 8, ageMax: 10 });
    if (/stž|starší žák/i.test(text)) categories.push({ name: "STŽ", ageMin: 11, ageMax: 12 });
    if (/\bkadeti\b|\bk\b/i.test(text)) categories.push({ name: "Kadeti", ageMin: 13, ageMax: 14 });
    if (/junior/i.test(text)) categories.push({ name: "Junior", ageMin: 15, ageMax: 16 });

    events.push({
      externalId: `csc-${normalizeName(name)}-${startDate}`,
      name,
      startDate,
      placeText: guessPlace(text) || "Czechia",
      countryHint: "CZ",
      discipline: guessDisc(text),
      audience: /žák|junior|kadet|děti|mládež/i.test(text) ? "kids" : "mixed",
      categories: categories.length ? categories : undefined,
      sourceUrl: link
        ? link.startsWith("http")
          ? link
          : new URL(link, url).toString()
        : url,
      confidence: 0.65,
      // stash level in name path via confidence metadata — callers read inferRaceLevel again
    });
  });

  return dedupe(events).slice(0, 80);
}

function guessPlace(text: string): string | null {
  const m = text.match(
    /\b(Praha|Brno|Ostrava|Plzeň|Liberec|Olomouc|Pardubice|Hradec Králové|České Budějovice|Karlovy Vary|Jihlava|Zlín|Ústí nad Labem)\b/,
  );
  return m?.[1] ?? null;
}

function guessDisc(text: string): ParsedEvent["discipline"] {
  const out: NonNullable<ParsedEvent["discipline"]> = [];
  if (/silnic|road/i.test(text)) out.push("road");
  if (/\bxcm\b|maraton/i.test(text)) out.push("xcm");
  if (/\bxcc\b/i.test(text)) out.push("xcc");
  if (/\bxco\b|\bxc\b|horské/i.test(text)) out.push("xco");
  if (/cyklokros|\bcx\b/i.test(text)) out.push("cx");
  if (/gravel/i.test(text)) out.push("gravel");
  if (/dráha|track/i.test(text)) out.push("track");
  if (/\bbmx\b/i.test(text)) out.push("bmx");
  return out.length ? out : undefined;
}

function dedupe(events: ParsedEvent[]): ParsedEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const k = `${e.startDate}:${normalizeName(e.name)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
