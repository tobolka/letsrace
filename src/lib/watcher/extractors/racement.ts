import * as cheerio from "cheerio";
import type { Audience, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";

/** IOC/UCI-style country tags used on racement calendars → ISO hints. */
const COUNTRY_TAG: Record<string, string> = {
  GER: "DE",
  CZE: "CZ",
  AUT: "AT",
  SUI: "CH",
  ITA: "IT",
  FRA: "FR",
  BEL: "BE",
  NED: "NL",
  POL: "PL",
  SVK: "SK",
  SLO: "SI",
  ESP: "ES",
  GBR: "GB",
  DEN: "DK",
  LUX: "LU",
  POR: "PT",
  AND: "AD",
};

const EN_MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

const DE_MONTHS: Record<string, string> = {
  januar: "01",
  februar: "02",
  marz: "03",
  märz: "03",
  april: "04",
  mai: "05",
  juni: "06",
  juli: "07",
  august: "08",
  september: "09",
  oktober: "10",
  november: "11",
  dezember: "12",
};

type SeriesCfg = {
  seriesName: string;
  seriesSlug: string;
  seriesWebsite: string;
  audience: Audience;
  idPrefix: string;
  acceptSlug: (slug: string) => boolean;
};

function monthNum(raw: string): string | null {
  const key = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return EN_MONTHS[key] || DE_MONTHS[key] || DE_MONTHS[raw.toLowerCase()] || null;
}

function parseCalendarDates(dateText: string): { start: string; end?: string } | null {
  const compact = dateText.replace(/\s+/g, " ").trim();
  const re = /(\d{1,2})\s+([A-Za-zäöüÄÖÜ]+)\s+(\d{4})/g;
  const hits: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(compact))) {
    const mon = monthNum(m[2]!);
    if (!mon) continue;
    hits.push(`${m[3]}-${mon}-${m[1]!.padStart(2, "0")}`);
  }
  if (!hits.length) return null;
  const start = hits[0]!;
  const end = hits[1] && hits[1] !== start ? hits[1] : undefined;
  return { start, end };
}

function placeAndCountry(title: string): { place: string; country?: string } {
  const tagged = title.match(/^(.*?)\s*-\s*(.+?)\s*\(([A-Z]{3})\)\s*$/);
  if (tagged) {
    const tag = tagged[3]!;
    return {
      place: tagged[2]!.trim(),
      country: COUNTRY_TAG[tag] ?? tag.slice(0, 2),
    };
  }
  const dash = title.match(/-\s*(.+)$/);
  return { place: (dash?.[1] ?? title).trim() };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function configFor(url: string): SeriesCfg | null {
  const host = hostOf(url);
  if (host.includes("kidscup.bike")) {
    return {
      seriesName: "VPACE Kids Cup",
      seriesSlug: "vpace-kids-cup",
      seriesWebsite: "https://www.kidscup.bike/en/",
      audience: "kids",
      idPrefix: "kidscup",
      acceptSlug: () => true,
    };
  }
  if (host.includes("rookiescup.bike")) {
    return {
      seriesName: "Rookies DH Cup",
      seriesSlug: "rookies-dh-cup",
      seriesWebsite: "https://www.rookiescup.bike/en/",
      audience: "youth",
      idPrefix: "rookies",
      // Official RDC rounds only — the page also lists iXS EDC/DHC.
      acceptSlug: (slug) => /(?:^|-)rdc-\d+/i.test(slug),
    };
  }
  if (host.includes("ixsdownhillcup.com")) {
    return {
      seriesName: "iXS Downhill Cup",
      seriesSlug: "ixs-downhill-cup",
      seriesWebsite: "https://www.ixsdownhillcup.com/en/",
      audience: "mixed",
      idPrefix: "ixs",
      acceptSlug: (slug) => /ixs-(dhc|edc|irc)-/i.test(slug),
    };
  }
  return null;
}

function seriesFromSlug(cfg: SeriesCfg, slug: string, subtitle: string): {
  seriesName: string;
  seriesSlug: string;
} {
  if (cfg.idPrefix !== "ixs") {
    return { seriesName: cfg.seriesName, seriesSlug: cfg.seriesSlug };
  }
  if (/ixs-edc-/i.test(slug) || /european downhill/i.test(subtitle)) {
    return { seriesName: "iXS European Downhill Cup", seriesSlug: "ixs-edc" };
  }
  if (/ixs-irc-/i.test(slug) || /international rookies/i.test(subtitle)) {
    return { seriesName: "iXS International Rookies Cup", seriesSlug: "ixs-irc" };
  }
  return { seriesName: "iXS Downhill Cup", seriesSlug: "ixs-dhc" };
}

/**
 * Racement / Craft CMS calendars (Kids Cup, Rookies, iXS).
 * Cards: `.event-box.race-calendar-element` with title link + date block.
 */
export function parseRacement(url: string, html: string): ParsedEvent[] {
  const cfg = configFor(url);
  if (!cfg) return [];

  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $(".event-box.race-calendar-element").each((_, el) => {
    const $el = $(el);
    const link = $el.find(".title a").first();
    const href = link.attr("href");
    const name = link.text().replace(/\s+/g, " ").trim();
    if (!href || !name) return;
    if (!/\/(en\/)?race\/|\/rennen\//i.test(href)) return;
    if (/camp|training|clinic/i.test(name)) return;

    const dates = parseCalendarDates($el.find(".date").text());
    if (!dates) return;

    let abs: string;
    try {
      abs = new URL(href, url).toString();
    } catch {
      return;
    }

    const slug = abs.replace(/\/$/, "").split("/").pop() || normalizeName(name);
    if (!cfg.acceptSlug(slug)) return;

    const externalId = `${cfg.idPrefix}-${slug}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const { place, country } = placeAndCountry(name);
    const subtitle = $el.find(".title").clone().children().remove().end().text().replace(/\s+/g, " ").trim();
    const series = seriesFromSlug(cfg, slug, subtitle);

    events.push({
      externalId,
      name,
      startDate: dates.start,
      endDate: dates.end,
      placeText: place,
      countryHint: country,
      discipline: ["dh"],
      audience: /irc|rookies/i.test(slug) ? "youth" : cfg.audience,
      seriesName: series.seriesName,
      seriesSlug: series.seriesSlug,
      seriesWebsite: cfg.seriesWebsite,
      sourceUrl: url,
      websiteUrl: abs,
      confidence: 0.92,
    });
  });

  return events;
}

export function parseKidsCup(url: string, html: string): ParsedEvent[] {
  return parseRacement(url, html);
}

export function isRacementHost(host: string): boolean {
  const h = host.replace(/^www\./i, "").toLowerCase();
  return (
    h.includes("kidscup.bike") ||
    h.includes("rookiescup.bike") ||
    h.includes("ixsdownhillcup.com")
  );
}
