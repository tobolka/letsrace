import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";

const EN_MON: Record<string, string> = {
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

const ISO3: Record<string, string> = {
  BEL: "BE",
  NED: "NL",
  GER: "DE",
  FRA: "FR",
  ITA: "IT",
  ESP: "ES",
  SUI: "CH",
  AUT: "AT",
  CZE: "CZ",
  SVK: "SK",
  POL: "PL",
  GBR: "GB",
  TUR: "TR",
  ROU: "RO",
  BUL: "BG",
  NOR: "NO",
  SLO: "SI",
  CRO: "HR",
  DEN: "DK",
  POR: "PT",
  LUX: "LU",
  HUN: "HU",
};

const FLAG_CC: Record<string, string> = {
  belgie: "BE",
  belgium: "BE",
  nederland: "NL",
  netherlands: "NL",
  france: "FR",
  frankrijk: "FR",
  "czech republic": "CZ",
  czechia: "CZ",
  "united kingdom": "GB",
  scotland: "GB",
  spain: "ES",
  spanje: "ES",
  germany: "DE",
  duitsland: "DE",
};

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function dmy(day: string, month: string, year: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function push(events: ParsedEvent[], seen: Set<string>, ev: ParsedEvent): void {
  if (seen.has(ev.externalId)) return;
  seen.add(ev.externalId);
  events.push(ev);
}

function parseDdMmYy(raw: string): string | null {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!m) return null;
  return dmy(m[1]!, m[2]!, `20${m[3]}`);
}

function flagCountry(alt: string): string {
  const t = fold(alt);
  for (const [k, cc] of Object.entries(FLAG_CC)) {
    if (t.includes(k)) return cc;
  }
  return "BE";
}

function parseFlandersCards(
  url: string,
  html: string,
  opts: {
    seriesName: string;
    seriesSlug: string;
    idPrefix: string;
  },
): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const sourceUrl = url.split("?")[0]!;
  $(".competition-block").each((_, card) => {
    const loc = $(card).find(".competition-block-location");
    const place = (loc.find("h2").first().text() || loc.find("p").first().text())
      .replace(/\s+/g, " ")
      .trim();
    const dateRaw = $(card).find(".competition-block-date").first().text().trim();
    if (!place || !dateRaw) return;
    const startDate = parseDdMmYy(dateRaw);
    if (!startDate) return;
    const alt = loc.find("img.flag").attr("alt") || loc.find("img[alt]").attr("alt") || "";
    const href = $(card).find("a.dark-link[href]").attr("href");
    let website: string | undefined;
    if (href) {
      try {
        website = new URL(href, url).toString();
      } catch {
        /* keep */
      }
    }
    const id = `${opts.idPrefix}-${startDate}-${normalizeName(place)}`;
    push(events, seen, {
      externalId: id,
      name: `${opts.seriesName} — ${place}`,
      startDate,
      placeText: place,
      countryHint: flagCountry(alt),
      discipline: ["cx"],
      audience: "mixed",
      seriesName: opts.seriesName,
      seriesSlug: opts.seriesSlug,
      seriesWebsite: sourceUrl,
      sourceUrl,
      websiteUrl: website,
      confidence: 0.9,
    });
  });
  return events;
}

export function parseSuperprestige(url: string, html: string): ParsedEvent[] {
  return parseFlandersCards(url, html, {
    seriesName: "Telenet Superprestige",
    seriesSlug: "telenet-superprestige",
    idPrefix: "superprestige",
  });
}

export function parseUciCxWorldCup(url: string, html: string): ParsedEvent[] {
  return parseFlandersCards(url, html, {
    seriesName: "UCI Cyclo-cross World Cup",
    seriesSlug: "uci-cx-world-cup",
    idPrefix: "uci-cx-wc",
  });
}

const UEC_SKIP = /indoor|cycle-ball|cycle ball|trials/i;

function uecDiscipline(cat: string, title: string): Discipline[] {
  const t = fold(`${cat} ${title}`);
  if (/cyclo-?cross|\bcx\b/.test(t)) return ["cx"];
  if (/gravel/.test(t)) return ["gravel"];
  if (/gran\s*fondo/.test(t)) return ["gran_fondo"];
  if (/para/.test(t)) return ["para", "road"];
  if (/downhill/.test(t)) return ["dh"];
  if (/marathon/.test(t)) return ["xcm"];
  if (/eliminator/.test(t)) return ["xce"];
  if (/\bmtb\b|mountain bike/.test(t)) return ["xco"];
  if (/\bbmx\b/.test(t)) return ["bmx"];
  if (/track/.test(t)) return ["track"];
  return ["road"];
}

function uecDates(jours: string, mois: string, year = "2026"): { start: string; end?: string } | null {
  const months = mois.split(/\s*-\s*/).map((m) => EN_MON[fold(m.trim())]);
  if (!months[0]) return null;
  const nums = jours.match(/\d{1,2}/g) || [];
  if (!nums.length) return null;
  const start = dmy(nums[0]!, months[0], year);
  if (nums.length < 2) return { start };
  const endMonth = months[1] || months[0]!;
  const end = dmy(nums[1]!, endMonth, year);
  return end === start ? { start } : { start, end };
}

export function parseUecCalendar(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const sourceUrl = url.split("?")[0]!;
  $(".event-card").each((_, card) => {
    const title = $(card).find(".title").first().text().replace(/\s+/g, " ").trim();
    const cat = $(card).find(".category").first().text().replace(/\s+/g, " ").trim();
    if (!title || UEC_SKIP.test(`${title} ${cat}`)) return;
    const jours = $(card).find(".jours").first().text().trim();
    const mois = $(card).find(".mois").first().text().trim();
    const span = uecDates(jours, mois);
    if (!span) return;
    const desc = $(card).find(".description").first().clone();
    desc.find(".title").remove();
    const where = desc.text().replace(/\s+/g, " ").trim();
    const iso = where.match(/\b([A-Z]{3})\b/);
    const place = where.replace(/\s*-\s*[A-Z]{3}\s*\([^)]+\)\s*$/, "").trim();
    if (place.length < 3) return;
    const id = `uec-${span.start}-${normalizeName(title)}`;
    const href = $(card).find("a[href*='/en/event/']").attr("href");
    let website: string | undefined;
    if (href) {
      try {
        website = new URL(href, url).toString();
      } catch {
        /* keep */
      }
    }
    push(events, seen, {
      externalId: id,
      name: title,
      startDate: span.start,
      endDate: span.end,
      placeText: place.replace(/\s*&\s*.*$/, "").trim() || place,
      countryHint: iso ? ISO3[iso[1]!] || undefined : undefined,
      discipline: uecDiscipline(cat, title),
      audience: /youth|junior/i.test(title) ? "youth" : "mixed",
      seriesName: "UEC European Championships",
      seriesSlug: "uec-european-championships",
      seriesWebsite: "https://uec.ch/en/calendar",
      sourceUrl,
      websiteUrl: website,
      confidence: 0.88,
    });
  });
  const page = Number(new URL(url, "https://uec.ch").searchParams.get("page") || "1");
  if (page === 1 && events[0]) {
    events[0] = {
      ...events[0],
      childUrls: [`${sourceUrl}?page=2`, `${sourceUrl}?page=3`],
    };
  }
  return events;
}

export function parseTourDeFrance(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const m = text.match(/(\d{2})\/(\d{2})\s*>\s*(\d{2})\/(\d{2})\/(20\d{2})/);
  if (!m) return [];
  const startDate = dmy(m[1]!, m[2]!, m[5]!);
  const endDate = dmy(m[3]!, m[4]!, m[5]!);
  return [
    {
      externalId: `tdf-${startDate}`,
      name: "Tour de France",
      startDate,
      endDate,
      placeText: "Barcelona",
      countryHint: "ES",
      discipline: ["road"],
      audience: "mixed",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: "https://www.letour.fr/en",
      confidence: 0.92,
    },
  ];
}

export function parseParisRoubaix(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const hit =
    text.match(/(\d{2})\/(\d{2})\/(2026)\s*[–-]\s*Paris-Roubaix/i) ||
    text.match(/Paris-Roubaix[^\d]{0,48}(\d{2})\/(\d{2})\/(2026)/i);
  if (!hit) return [];
  const startDate = dmy(hit[1]!, hit[2]!, hit[3]!);
  return [
    {
      externalId: `paris-roubaix-${startDate}`,
      name: "Paris-Roubaix",
      startDate,
      placeText: "Compiègne",
      countryHint: "FR",
      discipline: ["road"],
      audience: "mixed",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: "https://www.paris-roubaix.fr/en",
      confidence: 0.9,
    },
  ];
}

export function parseTourOfAustria(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const m = text.match(/(\d{1,2})\.\s*[–-]\s*(\d{1,2})\.\s*Juli\s+(20\d{2})/i);
  if (!m) return [];
  const startDate = dmy(m[1]!, "07", m[3]!);
  const endDate = dmy(m[2]!, "07", m[3]!);
  return [
    {
      externalId: `tour-of-austria-${startDate}`,
      name: "Lidl Tour of Austria",
      startDate,
      endDate,
      placeText: "Graz",
      countryHint: "AT",
      discipline: ["road"],
      audience: "mixed",
      categories: [{ name: "UCI 2.1" }],
      sourceUrl: url.split("?")[0]!,
      websiteUrl: "https://tourofaustria.com/",
      confidence: 0.9,
    },
  ];
}

export function parseTourDeSuisse(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const dates = [...text.matchAll(/(\d{2})\.(\d{2})\.(20\d{2})/g)].map((m) =>
    dmy(m[1]!, m[2]!, m[3]!),
  );
  const inJune = dates.filter((d) => d.startsWith("2026-06"));
  if (inJune.length < 2) return [];
  const startDate = inJune[0]!;
  const endDate = inJune[inJune.length - 1]!;
  return [
    {
      externalId: `tour-de-suisse-${startDate}`,
      name: "Tour de Suisse",
      startDate,
      endDate: endDate !== startDate ? endDate : undefined,
      placeText: "Sondrio",
      countryHint: "IT",
      discipline: ["road"],
      audience: "mixed",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: "https://www.tourdesuisse.ch/en/",
      confidence: 0.86,
    },
  ];
}

export function parseGravelChallengeDk(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const m = text.match(/(\d{1,2})\.\s*oktober\s+(20\d{2})/i);
  if (!m) return [];
  const startDate = dmy(m[1]!, "10", m[2]!);
  return [
    {
      externalId: `gravel-challenge-dk-${startDate}`,
      name: "Gravel Challenge",
      startDate,
      placeText: "Allerød",
      countryHint: "DK",
      discipline: ["gravel"],
      audience: "mixed",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: "https://www.gravelchallenge.dk/",
      confidence: 0.88,
    },
  ];
}

const ES_MON: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

function oneOff(
  url: string,
  html: string,
  opts: {
    id: string;
    name: string;
    place: string;
    cc: string;
    disc: Discipline[];
    site: string;
    pick: (text: string) => string | null;
  },
): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const startDate = opts.pick(text);
  if (!startDate) return [];
  return [
    {
      externalId: `${opts.id}-${startDate}`,
      name: opts.name,
      startDate,
      placeText: opts.place,
      countryHint: opts.cc,
      discipline: opts.disc,
      audience: "mixed",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: opts.site,
      confidence: 0.88,
    },
  ];
}

function namedDay(text: string, mon: Record<string, string>, re: RegExp): string | null {
  const m = text.match(re);
  if (!m) return null;
  const month = mon[fold(m[2]!)] || mon[m[2]!.toLowerCase()];
  if (!month) return null;
  return dmy(m[1]!, month, m[3]!);
}

export function parseQuebrantahuesos(url: string, html: string): ParsedEvent[] {
  return oneOff(url, html, {
    id: "quebrantahuesos",
    name: "Quebrantahuesos",
    place: "Sabiñánigo",
    cc: "ES",
    disc: ["gran_fondo"],
    site: "https://www.quebrantahuesos.com/",
    pick: (text) => namedDay(text, ES_MON, /(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de\s+)?(2026)/i)
      || namedDay(text, ES_MON, /(\d{1,2})\s+([A-ZÁÉÍÓÚa-záéíóú]+)\s+(2026)/),
  });
}

export function parsePuritoAndorra(url: string, html: string): ParsedEvent[] {
  return oneOff(url, html, {
    id: "purito-andorra",
    name: "La Purito Andorra",
    place: "Andorra la Vella",
    cc: "AD",
    disc: ["gran_fondo"],
    site: "https://www.lapuritoandorra.com/",
    pick: (text) =>
      namedDay(text, ES_MON, /(\d{1,2})\s+DE\s+([A-ZÁÉÍÓÚ]+)\s+DE\s+(2026)/i),
  });
}

export function parseKingOfTheLake(url: string, html: string): ParsedEvent[] {
  return oneOff(url, html, {
    id: "king-of-the-lake",
    name: "King of the Lake",
    place: "Pertisau",
    cc: "AT",
    disc: ["tt"],
    site: "https://www.kotl.at/",
    pick: (text) => {
      const m = text.match(/(\d{1,2})\.\s*September\s+(2026)/i);
      return m ? dmy(m[1]!, "09", m[2]!) : null;
    },
  });
}

export function parseFaustoCoppi(url: string, html: string): ParsedEvent[] {
  return oneOff(url, html, {
    id: "fausto-coppi",
    name: "Granfondo La Fausto Coppi",
    place: "Cuneo",
    cc: "IT",
    disc: ["gran_fondo"],
    site: "https://www.faustocoppi.net/",
    pick: (text) => {
      const m = text.match(/(\d{1,2})\s+GIUGNO\s+(2026)\s+La\s+37/i);
      return m ? dmy(m[1]!, "06", m[2]!) : null;
    },
  });
}

export function parseHaervejsloebet(url: string, html: string): ParsedEvent[] {
  return oneOff(url, html, {
    id: "haervejsloebet",
    name: "DGI Hærvejsløbet",
    place: "Vejen",
    cc: "DK",
    disc: ["gran_fondo"],
    site: "https://haervejsloebet.dk/",
    pick: (text) => {
      const m = text.match(/(\d{1,2})\.\s*juni\s+(2026)/i);
      return m ? dmy(m[1]!, "06", m[2]!) : null;
    },
  });
}

export function parseCzechTour(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const m = text.match(/(\d{1,2})\.\s*[–-]\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/);
  if (!m) return [];
  const startDate = dmy(m[1]!, m[3]!, m[4]!);
  const endDate = dmy(m[2]!, m[3]!, m[4]!);
  return [
    {
      externalId: `czech-tour-${startDate}`,
      name: "Czech Tour",
      startDate,
      endDate,
      placeText: "Karlovy Vary",
      countryHint: "CZ",
      discipline: ["road"],
      audience: "mixed",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: "https://www.czechtour.com/",
      confidence: 0.9,
    },
  ];
}

export function parseLetapeCzech(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const events: ParsedEvent[] = [];
  const hilly = text.match(/Kopcovitá etapa Praha[^\d]{0,40}(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/i);
  const flat = text.match(/Rovinatá etapa[^\d]{0,40}(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/i);
  if (hilly) {
    const startDate = dmy(hilly[1]!, hilly[2]!, hilly[3]!);
    events.push({
      externalId: `letape-cz-praha-${startDate}`,
      name: "L'Etape Czech Republic — Praha",
      startDate,
      placeText: "Praha",
      countryHint: "CZ",
      discipline: ["gran_fondo"],
      audience: "mixed",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: "https://www.letapeczech.cz/",
      confidence: 0.88,
    });
  }
  if (flat) {
    const startDate = dmy(flat[1]!, flat[2]!, flat[3]!);
    events.push({
      externalId: `letape-cz-pardubice-${startDate}`,
      name: "L'Etape Czech Republic — Pardubice",
      startDate,
      placeText: "Pardubice",
      countryHint: "CZ",
      discipline: ["gran_fondo"],
      audience: "mixed",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: "https://www.letapeczech.cz/",
      confidence: 0.88,
    });
  }
  return events;
}

export function parseHouffaGravel(url: string, html: string): ParsedEvent[] {
  return oneOff(url, html, {
    id: "houffa-gravel",
    name: "Houffa Gravel",
    place: "Houffalize",
    cc: "BE",
    disc: ["gravel"],
    site: "https://houffagravel.be/en/",
    pick: (text) => {
      const m =
        text.match(/zaterdag\s+(\d{1,2})\s+augustus/i) ||
        text.match(/(\d{1,2})\s+augustus\s+is het tijd voor Houffa/i) ||
        text.match(/(\d{1,2})\s+August\s+2026/i);
      return m ? dmy(m[1]!, "08", "2026") : null;
    },
  });
}

export function parseAlsovkaWh(url: string, html: string): ParsedEvent[] {
  return oneOff(url, html, {
    id: "alsovka-wh",
    name: "Wembloudovy Hrby",
    place: "Alšovka",
    cc: "CZ",
    disc: ["xco"],
    site: "https://alsovka.cz/wh/",
    pick: (text) => {
      const m = text.match(/(\d{1,2})\.(\d{1,2})\.(2026)/);
      return m ? dmy(m[1]!, m[2]!, m[3]!) : null;
    },
  });
}

export function parseKlatovyXco(url: string, html: string): ParsedEvent[] {
  return oneOff(url, html, {
    id: "klatovy-xco",
    name: "Velká cena Klatov XCO",
    place: "Klatovy",
    cc: "CZ",
    disc: ["xco"],
    site: "https://velkacenaklatov.cz/",
    pick: (text) => {
      const named = text.match(/(\d{1,2})\.\s*dubna\s+(2026)/i);
      if (named) return dmy(named[1]!, "04", named[2]!);
      const m = text.match(/(\d{1,2})\.\s*4\.\s*(2026)/);
      return m ? dmy(m[1]!, "04", m[2]!) : null;
    },
  });
}
