import * as cheerio from "cheerio";
import type { ParsedEvent } from "@/lib/domain";
import { canonicalizeDiscipline, type Discipline, type UciClass } from "@/lib/taxonomy";
import { countryFromLabel } from "@/lib/geo/country-label";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function day(n: string, month: string, year: string) {
  const index = MONTHS.indexOf(month);
  if (index < 0) return null;
  const value = `${year}-${String(index + 1).padStart(2, "0")}-${n.padStart(2, "0")}`;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}
export function uciDateSpan(text: string, edition: string) {
  const range = text.match(/^(\d{1,2})\s+([A-Z][a-z]{2})\s*-\s*(\d{1,2})\s+([A-Z][a-z]{2})\s+(20\d{2})$/);
  const single = text.match(/^(\d{1,2})\s+([A-Z][a-z]{2})\s+(20\d{2})$/);
  const start = range ? day(range[1], range[2], range[5]) : single ? day(single[1], single[2], single[3]) : null;
  const end = range ? day(range[3], range[4], range[5]) : start;
  return start && end && end >= start && start.startsWith(edition) && end.startsWith(edition) ? { start, end } : null;
}

/** UCI embeds its rendered competition and race table as a real data-props attribute. */
export function parseUciCompetition(url: string, html: string): ParsedEvent[] {
  const path = new URL(url).pathname.match(/^\/competition-details\/(20\d{2})\/MTB\/(\d+)\/?$/i);
  if (!path) return [];
  const $ = cheerio.load(html);
  for (const el of $("[data-props]").toArray()) {
    try {
      const props = JSON.parse($(el).attr("data-props") ?? "{}");
      const detail = props.competitionDetails;
      if (!detail || typeof detail.name !== "string" || typeof detail.dates !== "string" || typeof detail.venue !== "string") continue;
      const dates = uciDateSpan(detail.dates, path[1]);
      const country = countryFromLabel(detail.country);
      if (!dates || !country || !detail.venue.trim()) continue;
      const races = (props.schedule?.items ?? []).flatMap((item: { races?: { raceType?: string; category?: string }[] }) => item.races ?? []);
      const disciplines = [...new Set<Discipline>(races.map((r: { raceType?: string }) => canonicalizeDiscipline(r.raceType)).filter((d: Discipline | null): d is Discipline => d != null && d !== "other"))];
      if (!disciplines.length) continue;
      const classes = String(detail.competitionClass ?? "").match(/\b([123])\s*-\s*Class\s*\1\b/);
      const uciClass = classes ? `c${classes[1]}` as UciClass : undefined;
      const names = [...new Set<string>(races.map((r: { category?: string }) => r.category).filter((name: unknown): name is string => typeof name === "string" && name.length > 0))];
      return [{ externalId: `uci-MTB-${path[2]}-${path[1]}`, name: detail.name, startDate: dates.start, endDate: dates.end,
        placeText: detail.venue, countryHint: country, discipline: disciplines, uciClass,
        categories: names.map(name => ({ name })), sourceUrl: url,
        websiteUrl: typeof detail.website?.url === "string" && /^https?:\/\//.test(detail.website.url) ? detail.website.url : undefined,
        ...(detail.name.startsWith("4X Pro Tour") ? { seriesName: "4X Pro Tour", seriesSlug: "4x-pro-tour" } : {}),
        confidence: 0.98,
        evidence: { quote: JSON.stringify({ competitionDetails: detail, schedule: props.schedule }), sourceUrl: url, method: "uci_competition", version: "uci-competition-v1" },
      }];
    } catch { /* Invalid or unrelated component data is not a race. */ }
  }
  return [];
}
