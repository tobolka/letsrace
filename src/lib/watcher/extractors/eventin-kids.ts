import * as cheerio from "cheerio";
import type { ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { ageCategoriesFromList } from "@/lib/age-bands";

const months = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
const clean = (text: string) => text.replace(/\s+/g, " ").trim();

/** Eventin puts the children's race inside the ride's page, outside JSON-LD.
 * Read only its own heading block and the page's labelled venue/date, never
 * related-event cards or other sections' age groups. No image/model required.
 */
export function parseEventinKids(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  $("script,style,nav,footer,.etn-related-event").remove();
  const metadata = $("li").filter((_, n) => /^Datum\s*:/i.test(clean($(n).text())));
  if (metadata.length !== 1) return [];
  const date = clean(metadata.text()).match(/Datum\s*:\s*(\d{1,2})\.\s*([\p{L}]+)\s*(20\d{2})/iu);
  const month = date ? months.indexOf(date[2]!.toLowerCase()) + 1 : 0;
  if (!date || !month) return [];
  const startDate = `${date[3]}-${String(month).padStart(2, "0")}-${date[1]!.padStart(2, "0")}`;
  const parsed = new Date(`${startDate}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== startDate) return [];
  const placeText = clean(metadata.parent().find("li").filter((_, n) => /^Ort\s*:/i.test(clean($(n).text()))).text()).replace(/^Ort\s*:\s*/i, "");
  if (!placeText) return [];
  const events: ParsedEvent[] = [];
  $("h2,h3").each((_, node) => {
    const heading = $(node), title = clean(heading.text());
    if (!/kinder|kids|jüngsten\s+radhelden|fette\s+reifen/i.test(title)) return;
    // Elementor's container groups the heading, admission paragraph and poster.
    const block = heading.closest(".e-con,section");
    if (!block.length || block.find("h2,h3").length !== 1) return;
    const text = clean(block.text());
    if (text.length > 2500 || !/laufrad|fahrrad|radrennen/i.test(text)) return;
    // A child section on another day needs its own reader, not a copied date.
    const localDates = [...text.matchAll(/\b(\d{1,2})\.\s*(\d{1,2}|[\p{L}]+)\.?\s*(20\d{2})\b/gu)];
    if (localDates.some((m) => Number(m[1]) !== Number(date[1]) || m[3] !== date[3] || (Number(m[2]) || months.indexOf(m[2]!.toLowerCase()) + 1) !== month)) return;
    const categories = [...text.matchAll(/(?:Kinder\s+)?(?:von\s+)?(\d{1,2})\s*(?:bis|[-–])\s*(\d{1,2})\s*Jahren?\b/gi)]
      .map((m) => ({ name: m[0], ageMin: Number(m[1]), ageMax: Number(m[2]) }))
      .filter((c) => c.ageMin >= 0 && c.ageMin <= c.ageMax && c.ageMax <= 17);
    if (!categories.length) return;
    const ageCategories = ageCategoriesFromList(categories, { refYear: Number(date[3]) });
    const name = title.replace(/\s*[–—]\s*für\s+unsere.*$/i, "").trim();
    const id = block.attr("id") || block.parents("[id]").first().attr("id");
    const source = new URL(url); source.hash = id || "";
    events.push({ externalId: `eventin-kids-${normalizeName(name)}-${startDate}`, name, startDate,
      placeText, countryHint: "DE", discipline: ["road"], audience: "kids", ageCategories, categories,
      eventType: "race", sourceUrl: source.toString(), websiteUrl: source.toString(), confidence: 0.9 });
  });
  return events;
}
