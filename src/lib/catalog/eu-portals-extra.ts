import { load } from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { inferPolishDiscipline } from "./competit-datasport";

// ── 1. CzasNaRower.pl (Poland) ──────────────────────────────────────────────
export type CzasNaRowerRow = {
  id: string;
  title: string;
  date: string;
  place: string;
  discipline: Discipline;
  url: string;
  rawQuote: string;
};

export function parseCzasNaRower(html: string): CzasNaRowerRow[] {
  const $ = load(html);
  const rows: CzasNaRowerRow[] = [];
  const seen = new Set<string>();
  $(".cnr-race-sub-row").each((_, el) => {
    const id = $(el).attr("data-id")?.trim() ?? "";
    const tags = $(el).attr("data-tags") ?? "";
    const date = tags.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
    const a = $(el).find("h3.cnr-race-row-title a").first();
    const title = a.text().replace(/\s+/g, " ").trim();
    const href = a.attr("href")?.trim() ?? "";
    const place = $(el).find(".cnr-race-row-geo").first().text().replace(/\s+/g, " ").trim();
    if (!id || !date || !title || !place || seen.has(id)) return;
    seen.add(id);
    const disc: Discipline = /szos/i.test(tags)
      ? "road"
      : /gravel/i.test(tags)
        ? "gravel"
        : /downhill/i.test(tags)
          ? "dh"
          : /cross_country|xco/i.test(tags)
            ? "xco"
            : /maratony_mtb/i.test(tags)
              ? "xcm"
              : inferPolishDiscipline(title);
    rows.push({
      id,
      title,
      date,
      place,
      discipline: disc,
      url: href.startsWith("http") ? href : `https://www.czasnarower.pl/wyscig/${id}`,
      rawQuote: `${title} ${place} ${date}`.replace(/\s+/g, " ").trim().slice(0, 280),
    });
  });
  return rows;
}

export function czasNaRowerParsedEvent(row: CzasNaRowerRow, sourceUrl: string): ParsedEvent {
  return {
    externalId: `czasnarower:${row.id}`,
    name: row.title,
    startDate: row.date,
    placeText: row.place,
    countryHint: "PL",
    discipline: [row.discipline],
    sourceUrl,
    confidence: 0.85,
    evidence: {
      quote: row.rawQuote,
      sourceUrl,
      method: "czasnarower_pl",
      version: "czasnarower-v1",
    },
  };
}

// ── 2. Computerauswertung.at (Austria) ──────────────────────────────────────
const DE_MONTHS: Record<string, string> = {
  "jänner": "01", "jaenner": "01", "januar": "01",
  "februar": "02", "märz": "03", "maerz": "03",
  "april": "04", "mai": "05", "juni": "06",
  "juli": "07", "august": "08", "september": "09",
  "oktober": "10", "november": "11", "dezember": "12",
};

const CA_CYCLING = /\b(?:rad\w*|mtb|bike\w*|gravel|cyclocross|querfeldein|velo\w*|zeitfahren|kriterium|bergrennen)\b/i;
const CA_NOT_CYCLING = /\b(?:lauf\w*|run\w*|triathlon|duathlon|marathonlauf|stundenlauf|trailrun|swim|schwimm|ski)\b/i;

export type ComputerauswertungRow = {
  id: string;
  title: string;
  startDate: string;
  endDate: string | null;
  detailUrl: string;
  discipline: Discipline;
};

export function parseDeMonthDate(raw: string): { startDate: string; endDate: string | null } | null {
  const clean = raw.replace(/\s+/g, " ").trim().toLowerCase();
  const range = clean.match(/(\d{1,2})\.\s*[-–]\s*(\d{1,2})\.?\s*([a-zäöüß]+)\s*(20\d{2})/);
  if (range) {
    const mon = DE_MONTHS[range[3]!];
    if (!mon) return null;
    const s = `${range[4]}-${mon}-${range[1]!.padStart(2, "0")}`;
    const e = `${range[4]}-${mon}-${range[2]!.padStart(2, "0")}`;
    return { startDate: s, endDate: e !== s ? e : null };
  }
  const single = clean.match(/(\d{1,2})\.\s*([a-zäöüß]+)\s*(20\d{2})/);
  if (single) {
    const mon = DE_MONTHS[single[2]!];
    if (!mon) return null;
    return { startDate: `${single[3]}-${mon}-${single[1]!.padStart(2, "0")}`, endDate: null };
  }
  return null;
}

export function parseComputerauswertung(html: string): ComputerauswertungRow[] {
  const $ = load(html);
  const rows: ComputerauswertungRow[] = [];
  const seen = new Set<string>();
  $("table.kl tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 3) return;
    const dateRaw = $(tds[0]).text().replace(/\s+/g, " ").trim();
    const a = $(tds[2]).find("a[href*='veranstaltung.php']").first();
    const title = a.text().replace(/\s+/g, " ").trim();
    const href = a.attr("href")?.trim() ?? "";
    const id = href.match(/V_ID=(\d+)/i)?.[1];
    if (!id || !title || seen.has(id)) return;
    if (!CA_CYCLING.test(title) || CA_NOT_CYCLING.test(title)) return;
    const dates = parseDeMonthDate(dateRaw);
    if (!dates) return;
    seen.add(id);
    const disc: Discipline = /gravel/i.test(title) ? "gravel" : /cyclocross|querfeldein/i.test(title) ? "cx" : /mtb|mountainbike/i.test(title) ? "xcm" : "road";
    rows.push({
      id,
      title,
      startDate: dates.startDate,
      endDate: dates.endDate,
      detailUrl: new URL(href, "https://www.computerauswertung.at/").toString(),
      discipline: disc,
    });
  });
  return rows;
}

export function extractComputerauswertungLinks(html: string): { websiteUrl: string | null; registrationUrl: string | null } {
  const $ = load(html);
  let websiteUrl: string | null = null;
  let registrationUrl: string | null = null;
  $("a[href^='http']").each((_, a) => {
    const href = $(a).attr("href")?.trim() ?? "";
    const text = $(a).text().replace(/\s+/g, " ").trim();
    if (!href || /computerauswertung\.at|facebook\.com|instagram\.com/i.test(href)) return;
    if (/homepage|veranstalter|info/i.test(text) && !websiteUrl) websiteUrl = href;
    if (/anmeldung/i.test(text) && !registrationUrl) registrationUrl = href;
  });
  return { websiteUrl, registrationUrl };
}

// ── 3. VysledkovyServis.sk (Slovakia) ───────────────────────────────────────
const SK_MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", maj: "05", "máj": "05",
  jun: "06", "jún": "06", jul: "07", "júl": "07", aug: "08", sep: "09",
  okt: "10", nov: "11", dec: "12",
};

const VS_CYCLING = /\b(?:cyklo\w*|mtb|bike\w*|bicyk\w*|gravel|xco|xcm|enduro)\b/i;
const VS_NOT_CYCLING = /\b(?:beh\b|bežeck|run\b|triatlon|duatlon|polmarat[oó]n|nordic)\b/i;

export type VysledkovyServisRow = {
  title: string;
  date: string;
  url: string;
  discipline: Discipline;
};

export function parseVysledkovyServis(html: string, refDate = new Date().toISOString().slice(0, 10)): VysledkovyServisRow[] {
  const $ = load(html);
  const rows: VysledkovyServisRow[] = [];
  const seen = new Set<string>();
  const refYear = Number(refDate.slice(0, 4));
  const refMonth = Number(refDate.slice(5, 7));

  $(".up-event-item").each((_, el) => {
    const monRaw = $(el).find(".ebm-event-month").text().trim().toLowerCase();
    const dayRaw = $(el).find(".ebm-event-day").text().trim();
    const a = $(el).find("a.ebm-event-link").first();
    const title = a.text().replace(/\s+/g, " ").trim();
    const href = a.attr("href")?.trim() ?? "";
    const mon = SK_MONTHS[monRaw];
    const day = Number(dayRaw);
    if (!mon || !day || !title || !href) return;
    if (!VS_CYCLING.test(title) || VS_NOT_CYCLING.test(title)) return;
    const url = new URL(href, "https://vysledkovyservis.sk/").toString();
    if (seen.has(url)) return;
    seen.add(url);
    const year = Number(mon) < refMonth - 1 ? refYear + 1 : refYear;
    const date = `${year}-${mon}-${String(day).padStart(2, "0")}`;
    const disc: Discipline = /gravel/i.test(title) ? "gravel" : /cyklokros|cross/i.test(title) ? "cx" : /mtb|marat[oó]n/i.test(title) ? "xcm" : "road";
    rows.push({ title, date, url, discipline: disc });
  });
  return rows;
}

// ── 4. ENDU.net (Italy / EU) ────────────────────────────────────────────────
const ISO3_TO_ISO2: Record<string, string> = {
  ITA: "IT", FRA: "FR", ESP: "ES", CHE: "CH", AUT: "AT", DEU: "DE",
  POL: "PL", CZE: "CZ", SVK: "SK", SVN: "SI", HRV: "HR", BEL: "BE",
  NLD: "NL", LUX: "LU", GBR: "GB", DNK: "DK", SWE: "SE", NOR: "NO",
  PRT: "PT", HUN: "HU", ROU: "RO", GRC: "GR",
};

const ENDU_SLUG_CYCLING = /(?:gran[-_]?fondo|mtb|bike|gravel|ciclo|cycling|bici|cyclo[-_]?cross|ciclocross|cross[-_]?country|enduro|downhill|strade[-_]?bianche|pedalata|velothon|criterium|crono|xco|xcm)/i;
const ENDU_NOT_CYCLING = /(?:triathlon|duathlon|aquathlon|swim|trail[-_ ]?run|maratona\s+di|mezza\s+maratona|half[-_ ]?marathon|10k|5k|run\b|running|corsa|podistica|staffetta|athletics|skiri|skating|tecnica\s+libera|ski\b|sci\s+di\s+fondo|dobbiaco.*cortina|campaccio)/i;

export function isEnduCyclingSlug(url: string): boolean {
  const slug = url.split("/").pop() ?? "";
  return ENDU_SLUG_CYCLING.test(slug) && !ENDU_NOT_CYCLING.test(slug);
}

export function parseEnduEvent(html: string, url: string): ParsedEvent | null {
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
    startDate?: string;
    endDate?: string;
    description?: string;
    location?: { name?: string; address?: { addressLocality?: string; addressCountry?: string } };
  };
  const name = (ld.name ?? "").replace(/\s+/g, " ").trim();
  const startDate = ld.startDate?.slice(0, 10);
  if (!name || !startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
  if (ENDU_NOT_CYCLING.test(`${name} ${ld.description ?? ""}`)) return null;
  const endRaw = ld.endDate?.slice(0, 10);
  const endDate = endRaw && /^\d{4}-\d{2}-\d{2}$/.test(endRaw) && endRaw !== startDate ? endRaw : undefined;
  const place = (ld.location?.address?.addressLocality || ld.location?.name || "").trim();
  if (!place) return null;
  const rawCountry = (ld.location?.address?.addressCountry ?? "").trim().toUpperCase();
  const countryCode = rawCountry.length === 2 ? rawCountry : ISO3_TO_ISO2[rawCountry] ?? undefined;
  const hay = `${name} ${url} ${ld.description ?? ""}`;
  const disc: Discipline = /cyclo[- ]?cross|ciclocross/i.test(hay)
    ? "cx"
    : /gravel/i.test(hay)
      ? "gravel"
      : /enduro/i.test(hay)
        ? "enduro"
        : /downhill/i.test(hay)
          ? "dh"
          : /cross[- ]?country|xco/i.test(hay)
            ? "xco"
            : /mtb|mountain\s*bike|bike\s*marathon|xcm/i.test(hay)
              ? "xcm"
              : "road";
  const slug = url.replace(/\/+$/, "").split("/").pop() ?? "event";
  return {
    externalId: `endu:${slug}`,
    name,
    startDate,
    ...(endDate ? { endDate } : {}),
    placeText: place,
    ...(countryCode ? { countryHint: countryCode } : {}),
    discipline: [disc],
    sourceUrl: url,
    registrationUrl: url,
    confidence: 0.85,
    evidence: {
      quote: `${name} ${startDate}${endDate ? ` - ${endDate}` : ""} ${place}`.slice(0, 280),
      sourceUrl: url,
      method: "endu_net",
      version: "endu-v1",
    },
  };
}
