import { load } from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";

export type PolishPortalRow = {
  externalId: string;
  title: string;
  startDate: string;
  endDate: string | null;
  place: string;
  venue: string | null;
  discipline: Discipline;
  sourceUrl: string;
  websiteUrl: string | null;
  registrationUrl: string | null;
  rawQuote: string;
};

const CYCLING_TITLE = /\b(?:rower\w*|mtb|kolar\w*|bike\w*|gravel\w*|szos\w*|velo\w*|cyklo\w*|prze[lł]aj\w*|xco|xcm|enduro|bmx|duatlon\s+rower)\b/i;
const NOT_CYCLING = /\b(?:bieg\w*|p[oó][lł]maraton|maraton\s+pieszy|triathlon|duathlon|nordic|marsz|trail\s*run|ultra\s*run|ch[oó]d)\b/i;

export function inferPolishDiscipline(title: string): Discipline {
  if (/gravel|szutr/i.test(title)) return "gravel";
  if (/prze[lł]aj|cyclocross|cyklokros|cx\b/i.test(title)) return "cx";
  if (/enduro/i.test(title)) return "enduro";
  if (/downhill|zjazd|dh\b/i.test(title)) return "dh";
  if (/xco|cross\s*country/i.test(title)) return "xco";
  if (/mtb|maraton\s+mtb|xcm|bike\s*maraton/i.test(title)) return "xcm";
  if (/bmx/i.test(title)) return "bmx";
  if (/szos|klasyk|kryterium|czas[oó]wk|tour|wy[sś]cig\s+kolarski/i.test(title)) return "road";
  return "mtb";
}

/** Parses https://competit.pl/zawody-rowerowe/ (pure Polish cycling races). */
export function parseCompetitCycling(html: string, sourceUrl = "https://competit.pl/zawody-rowerowe/"): PolishPortalRow[] {
  const $ = load(html);
  const rows: PolishPortalRow[] = [];
  const seen = new Set<string>();
  $(".reviews.card").each((_, card) => {
    const detailHref = $(card).find("a[href*='/w/']").first().attr("href") ?? "";
    const id = detailHref.match(/\/w\/(\d+)/)?.[1];
    const title = $(card).find("h4").first().text().replace(/\s+/g, " ").trim();
    if (!id || !title || seen.has(id)) return;
    if (NOT_CYCLING.test(title)) return;

    const dateText = $(card).find("i.bi-calendar-week").parent().text().replace(/\s+/g, " ").trim();
    const dates = [...dateText.matchAll(/(20\d{2}-\d{2}-\d{2})/g)].map(m => m[1]!);
    const startDate = dates[0];
    if (!startDate) return;
    const endDate = dates.length > 1 && dates[1] !== startDate ? dates[1]! : null;

    const geoP = $(card).find("i.bi-geo-alt").parent();
    const venueSpan = geoP.find("span").first().text().replace(/\s+/g, " ").trim() || null;
    const place = geoP.clone().find("span, i").remove().end().text().replace(/\s+/g, " ").trim() || venueSpan || "";
    if (!place) return;

    const wwwHref = $(card).find("a[title='WWW']").first().attr("href")?.trim() || null;
    const websiteUrl = wwwHref && /^https?:\/\//i.test(wwwHref) && !/facebook\.com|instagram\.com/i.test(wwwHref) ? wwwHref : null;
    const regHref = $(card).find("a[href*='/zgloszenie/']").first().attr("href")?.trim();
    const registrationUrl = regHref ? new URL(regHref, "https://competit.pl").toString() : `https://competit.pl/w/${id}`;

    seen.add(id);
    rows.push({
      externalId: `competit:${id}`,
      title,
      startDate,
      endDate,
      place,
      venue: venueSpan,
      discipline: inferPolishDiscipline(title),
      sourceUrl,
      websiteUrl,
      registrationUrl,
      rawQuote: `${title} ${dateText} ${place}`.replace(/\s+/g, " ").trim().slice(0, 280),
    });
  });
  return rows;
}

/** Parses https://liveds.datasport.pl/lista.html (decoded from ISO-8859-2) and keeps only cycling races. */
export function parseDatasportPlCycling(html: string, sourceUrl = "https://liveds.datasport.pl/lista.html"): PolishPortalRow[] {
  const $ = load(html);
  const rows: PolishPortalRow[] = [];
  const seen = new Set<string>();
  $(".event-list-box").each((_, box) => {
    const title = ($(box).attr("data-name") || $(box).find("h5 a").first().text()).replace(/\s+/g, " ").trim();
    const city = ($(box).attr("data-city") || "").replace(/\s+/g, " ").trim();
    const date = ($(box).attr("data-date") || "").trim();
    const href = $(box).find("a[href*='zawody']").first().attr("href")?.trim() || "";
    const id = href.match(/zawody(\d+)/)?.[1];
    if (!id || !title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || seen.has(id)) return;
    if (!CYCLING_TITLE.test(title) || NOT_CYCLING.test(title)) return;
    seen.add(id);
    rows.push({
      externalId: `datasport-pl:${id}`,
      title,
      startDate: date,
      endDate: null,
      place: city || "Polska",
      venue: null,
      discipline: inferPolishDiscipline(title),
      sourceUrl,
      websiteUrl: null,
      registrationUrl: href.startsWith("http") ? href : `https://liveds.datasport.pl/${href.replace(/^\/+/, "")}`,
      rawQuote: `${title} ${city} ${date}`.replace(/\s+/g, " ").trim().slice(0, 280),
    });
  });
  return rows;
}

export function polishPortalParsedEvent(row: PolishPortalRow, method: "competit_pl" | "datasport_pl"): ParsedEvent {
  return {
    externalId: row.externalId,
    name: row.title,
    startDate: row.startDate,
    ...(row.endDate ? { endDate: row.endDate } : {}),
    placeText: row.place,
    countryHint: "PL",
    discipline: [row.discipline],
    sourceUrl: row.sourceUrl,
    ...(row.websiteUrl ? { websiteUrl: row.websiteUrl } : {}),
    ...(row.registrationUrl ? { registrationUrl: row.registrationUrl } : {}),
    confidence: 0.85,
    evidence: {
      quote: row.rawQuote,
      sourceUrl: row.sourceUrl,
      method,
      version: `${method}-v1`,
    },
  };
}
