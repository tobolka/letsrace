import { load } from "cheerio";
import type { ParsedEvent } from "@/lib/domain";

/** The club heading and archive dates must not replace the actual next-race announcement. */
export function parseChotebuz(url: string, html: string): ParsedEvent[] {
  const $ = load(html);
  if (!/Chotěbuzský kopec/i.test($("title").text())) return [];
  $("script,style,nav,header,footer,aside").remove();
  $("p,td,th,h1,h2,h3,li,div").append(" ");
  const text = $("body").text().replace(/\s+/g, " ");
  const months = ["ledna", "února", "března", "dubna", "května", "června", "července", "srpna", "září", "října", "listopadu", "prosince"];
  const matches = [...text.matchAll(/Datum konání příštího závodu je (\d{1,2})\.\s*([a-zá-ž]+)\s+(20\d{2})\b/gi)];
  if (matches.length !== 1) return [];
  const match = matches[0], month = months.indexOf(match[2].toLowerCase()) + 1;
  if (!month) return [];
  const startDate = `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  const day = new Date(`${startDate}T12:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== startDate) return [];
  return [{ externalId: `chotebuzsky-kopec-${match[3]}`, name: "Chotěbuzský kopec", startDate,
    placeText: "Chotěbuz", countryHint: "CZ", sourceUrl: url, websiteUrl: url,
    confidence: 0.95, evidence: { quote: match[0], sourceUrl: url, method: "official-next-race-announcement", version: "1" } }];
}
