import { load } from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import type { PracticalDetails } from "@/lib/practical-details";

export type RadgateListRow = {
  title: string;
  url: string;
  date: string;
  place: string;
  disciplineLabel: string;
  confirmed: boolean;
};

export type RadgateScheduleEntry = {
  time: string | null;
  category: string;
  distanceText: string;
  distanceKm: number | null;
  rawLine: string;
};

export type RadgateDetail = {
  url: string;
  slug: string;
  name: string;
  startDate: string;
  endDate: string | null;
  discipline: Discipline;
  place: string;
  postalCode: string | null;
  region: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
  organizer: string | null;
  officialUrl: string | null;
  distanceKm: number | null;
  elevationM: number | null;
  entries: RadgateScheduleEntry[];
};

const SPORT_MAP: [RegExp, Discipline][] = [
  [/cyclocross|radcross|cross\b|veldrijden/i, "cx"],
  [/pumptrack|bmx/i, "bmx"],
  [/bahn|\btrack\b|piste/i, "track"],
  [/gravel/i, "gravel"],
  [/enduro/i, "enduro"],
  [/downhill|dh\b/i, "dh"],
  [/cross[- ]?country|xco/i, "xco"],
  [/mtb[- ]?marathon|xcm/i, "xcm"],
  [/mtb|mountainbike/i, "mtb"],
  [/straß|strass|road|kriterium|zeitfahren|rundstrecken|rennsport/i, "road"],
];

export function mapRadgateDiscipline(sport: string, title = ""): Discipline {
  const hay = `${sport} ${title}`;
  for (const [re, disc] of SPORT_MAP) if (re.test(hay)) return disc;
  return "road";
}

/** Parses `/radrennen/jahr/<year>` list rows with dates so past races can be skipped before fetching details. */
export function parseRadgateYearList(html: string, year: number): RadgateListRow[] {
  const $ = load(html);
  const rows: RadgateListRow[] = [];
  const seen = new Set<string>();
  $("li.season-row").each((_, li) => {
    const a = $(li).find(".season-main > a[href^='/ausschreibung/']").first();
    const href = a.attr("href");
    if (!href) return;
    const url = `https://radgate.de${href}`;
    if (seen.has(url)) return;
    const dateRaw = $(li).find(".season-date").text().replace(/\s+/g, " ").trim();
    const dm = dateRaw.match(/(\d{1,2})\.(\d{1,2})\./);
    if (!dm) return;
    const date = `${year}-${dm[2]!.padStart(2, "0")}-${dm[1]!.padStart(2, "0")}`;
    const title = a.text().replace(/^[^\p{L}\p{N}]+/u, "").replace(/\s+/g, " ").trim();
    const status = $(li).find(".season-status").text().trim();
    const metaSpans = $(li).find(".season-meta > span").not(".season-status").map((__, el) => $(el).text().trim()).get();
    const place = metaSpans[0] ?? "";
    const disciplineLabel = metaSpans[1] ?? "";
    if (!title) return;
    seen.add(url);
    rows.push({
      title,
      url,
      date,
      place,
      disciplineLabel,
      confirmed: !/vorl[aä]ufig|abgesagt|cancelled/i.test(status),
    });
  });
  return rows;
}

/** Parses a radgate.de/ausschreibung/<slug> detail page (JSON-LD SportsEvent + schedule HTML). */
export function parseRadgateDetail(html: string, url: string): RadgateDetail | null {
  const $ = load(html);
  let sportsLd: Record<string, unknown> | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      if (parsed?.["@type"] === "SportsEvent") sportsLd = parsed;
    } catch { /* ignore */ }
  });
  if (!sportsLd) return null;
  const ld = sportsLd as {
    name?: string;
    sport?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
    location?: {
      name?: string;
      address?: { addressLocality?: string; postalCode?: string; addressRegion?: string; addressCountry?: string };
      geo?: { latitude?: number; longitude?: number };
    };
    organizer?: { name?: string };
  };
  const startDate = ld.startDate?.slice(0, 10);
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
  const endDateRaw = ld.endDate?.slice(0, 10);
  const endDate = endDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(endDateRaw) && endDateRaw !== startDate ? endDateRaw : null;
  const name = (ld.name ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
  const place = (ld.location?.address?.addressLocality || ld.location?.name || "").trim();
  if (!name || !place) return null;

  const countryRaw = ld.location?.address?.addressCountry?.trim().toUpperCase();
  const countryCode = countryRaw && /^[A-Z]{2}$/.test(countryRaw) ? countryRaw : null;

  const entries: RadgateScheduleEntry[] = [];
  $(".public-schedule-block").each((_, block) => {
    const heading = $(block).find("h3").first().text().replace(/\s+/g, " ").trim();
    const time = heading.match(/(\d{1,2}:\d{2})/)?.[1]?.padStart(5, "0") ?? null;
    $(block).find("ul.public-categories li").each((__, li) => {
      const category = $(li).find("strong").first().text().replace(/\s+/g, " ").trim();
      const distanceText = $(li).find("span").first().text().replace(/\s+/g, " ").trim();
      if (!category) return;
      const kmMatch = distanceText.match(/(\d+(?:[.,]\d+)?)\s*km/i);
      entries.push({
        time,
        category,
        distanceText,
        distanceKm: kmMatch ? Number(kmMatch[1]!.replace(",", ".")) : null,
        rawLine: `${heading} ${category} ${distanceText}`.replace(/\s+/g, " ").trim(),
      });
    });
  });

  // Official external source link ("Offizielle Quelle ansehen")
  let officialUrl: string | null = null;
  $("a[href^='http']").each((_, a) => {
    const text = $(a).text().trim();
    const href = $(a).attr("href")?.trim() ?? "";
    if (!href || /radgate\.de|instagram\.com|pirsch\.io/i.test(href)) return;
    if (/offizielle quelle|ausschreibung|veranstalter|anmeldung/i.test(text) && !officialUrl) officialUrl = href;
  });

  const slug = url.replace(/\/+$/, "").split("/").pop() ?? "race";
  const lat = typeof ld.location?.geo?.latitude === "number" ? ld.location.geo.latitude : null;
  const lng = typeof ld.location?.geo?.longitude === "number" ? ld.location.geo.longitude : null;

  return {
    url,
    slug,
    name,
    startDate,
    endDate,
    discipline: mapRadgateDiscipline(ld.sport ?? "", name),
    place,
    postalCode: ld.location?.address?.postalCode?.trim() || null,
    region: ld.location?.address?.addressRegion?.trim() || null,
    countryCode,
    lat,
    lng,
    organizer: ld.organizer?.name?.trim() || null,
    officialUrl,
    distanceKm: null,
    elevationM: null,
    entries,
  };
}

export function radgatePracticalDetails(detail: RadgateDetail, now = new Date().toISOString()): PracticalDetails {
  const year = Number(detail.startDate.slice(0, 4));
  const out: PracticalDetails = {};
  if (detail.organizer && !/noch nicht hinterlegt/i.test(detail.organizer)) {
    out.organizer = {
      value: { name: detail.organizer },
      sourceUrl: detail.url,
      quote: `Veranstalter ${detail.organizer}`.slice(0, 300),
      checkedAt: now,
      editionYear: year,
      status: "current",
    };
  }
  const schedule = detail.entries
    .filter(e => e.time)
    .map(e => ({
      label: e.category,
      date: detail.startDate,
      time: e.time!,
      sourceUrl: detail.url,
      sourceQuote: e.rawLine.slice(0, 300),
      checkedAt: now,
    }));
  if (schedule.length) {
    out.schedule = {
      value: schedule,
      sourceUrl: detail.url,
      quote: schedule.slice(0, 4).map(s => s.sourceQuote).join("\n").slice(0, 600),
      checkedAt: now,
      editionYear: year,
      status: "current",
    };
  }
  const categories = detail.entries.map(e => ({
    label: e.category,
    sourceUrl: detail.url,
    sourceQuote: e.rawLine.slice(0, 300),
    checkedAt: now,
  }));
  if (categories.length) {
    out.categories = {
      value: categories,
      sourceUrl: detail.url,
      quote: categories.slice(0, 5).map(c => c.sourceQuote).join("\n").slice(0, 600),
      checkedAt: now,
      editionYear: year,
      status: "current",
    };
  }
  return out;
}

export function radgateParsedEvent(detail: RadgateDetail, textQuote: string): ParsedEvent {
  const uuid = detail.slug.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)?.[0] ?? detail.slug.slice(-36);
  const officialWebsite = detail.officialUrl && !/rad-net\.de/i.test(detail.officialUrl) ? detail.officialUrl : undefined;
  return {
    externalId: `radgate:${uuid}`,
    name: detail.name,
    startDate: detail.startDate,
    ...(detail.endDate ? { endDate: detail.endDate } : {}),
    placeText: detail.postalCode ? `${detail.postalCode} ${detail.place}` : detail.place,
    ...(detail.countryCode ? { countryHint: detail.countryCode } : {}),
    discipline: [detail.discipline],
    sourceUrl: detail.url,
    ...(officialWebsite ? { websiteUrl: officialWebsite } : {}),
    ...(detail.officialUrl ? { regulationsUrl: detail.officialUrl } : {}),
    confidence: 0.85,
    evidence: {
      quote: textQuote.slice(0, 280),
      sourceUrl: detail.url,
      method: "radgate_ausschreibung",
      version: "radgate-v1",
    },
  };
}
