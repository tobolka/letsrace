import * as cheerio from "cheerio";
import type { ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { fetchText } from "@/lib/watcher/http";
import { attachDeAtHub, deAtPageLinks } from "@/lib/watcher/extractors/kids-mtb-cups";

const EN_MON: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

const DE_MON: Record<string, string> = {
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

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function push(events: ParsedEvent[], seen: Set<string>, ev: ParsedEvent): void {
  if (seen.has(ev.externalId)) return;
  seen.add(ev.externalId);
  if (ev.endDate && ev.endDate === ev.startDate) delete ev.endDate;
  events.push(ev);
}

function deMonthDay(day: string, monthRaw: string, year: number): string | null {
  const mo = DE_MON[monthRaw.toLowerCase()] || DE_MON[fold(monthRaw)];
  if (!mo) return null;
  return `${year}-${mo}-${day.padStart(2, "0")}`;
}

/** XCO-NRW Cup / MTB Schüler-Cup — skip athletics + cancelled boxes. */
export function parseXcoNrw(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const year = Number(html.match(/Veranstaltungen\s+(20\d{2})/i)?.[1] ?? 2026);
  $(".event-box").each((_, el) => {
    const $el = $(el);
    if ($el.find(".event-cancelled").length) return;
    const tags = $el.find(".event-tags").text();
    const place = $el.find(".event-info h3").first().text().replace(/\s+/g, " ").trim();
    if (!place || /athletik/i.test(place)) return;
    if (!/schüler|schueler|xco nrw/i.test(tags + place)) return;
    const dayRaw = $el.find(".event-date .day").text().replace(/\s+/g, "");
    const monRaw = $el.find(".event-date .month").text().trim().slice(0, 3).toLowerCase();
    const mo = EN_MON[monRaw];
    const days = dayRaw.match(/(\d{1,2})(?:\+(\d{1,2}))?/);
    if (!mo || !days) return;
    const startDate = `${year}-${mo}-${days[1]!.padStart(2, "0")}`;
    const endDate = days[2] ? `${year}-${mo}-${days[2].padStart(2, "0")}` : undefined;
    const href = $el.find("a[href]").first().attr("href");
    const shortPlace = place.replace(/\s*\(.*\)\s*$/, "").trim();
    let websiteUrl = url.split("?")[0]!;
    if (href) {
      try {
        websiteUrl = new URL(href, url).toString();
      } catch {
        /* keep */
      }
    }
    push(events, seen, {
      externalId: `xco-nrw-${startDate}-${normalizeName(shortPlace)}`,
      name: `XCO-NRW / Schüler-Cup — ${shortPlace}`,
      startDate,
      endDate,
      placeText: shortPlace,
      countryHint: "DE",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "XCO-NRW Cup",
      seriesSlug: "xco-nrw-cup",
      seriesWebsite: "https://www.xco-nrw-cup.de/",
      sourceUrl: websiteUrl,
      websiteUrl,
      confidence: 0.88,
    });
  });
  return attachDeAtHub(events, deAtPageLinks(url, html));
}

/** RENA Kids Cup — Saturday of the Furtwangen marathon weekend. */
export async function parseRenaKidsCup(url: string, html: string): Promise<ParsedEvent[]> {
  let text = cheerio.load(html)("body").text().replace(/\s+/g, " ");
  if (!/rena\s*kids/i.test(text)) return [];
  let weekend = text.match(/(\d{1,2})\.\s*und\s*(\d{1,2})\.\s*September\s+(20\d{2})/i);
  if (!weekend) {
    const home = await fetchText("https://www.schwarzwald-bike-marathon.de/");
    if (home.ok) {
      text += " " + cheerio.load(home.text)("body").text().replace(/\s+/g, " ");
      weekend = text.match(/(\d{1,2})\.\s*und\s*(\d{1,2})\.\s*September\s+(20\d{2})/i);
    }
  }
  if (!weekend) return [];
  const startDate = `${weekend[3]}-09-${weekend[1]!.padStart(2, "0")}`;
  const endDate = `${weekend[3]}-09-${weekend[2]!.padStart(2, "0")}`;
  return [
    {
      externalId: `rena-kids-${startDate}`,
      name: "RENA Kids Cup — Furtwangen",
      startDate,
      endDate,
      placeText: "Furtwangen",
      countryHint: "DE",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "RENA Kids Cup",
      seriesSlug: "rena-kids-cup",
      seriesWebsite: "https://www.schwarzwald-bike-marathon.de/rennen-strecken/rena-kids-cup/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.86,
    },
  ];
}

/** Sparkassen-Kids-Cup — Albstadt Bike Marathon weekend. */
export function parseAlbstadtKidsCup(url: string, html: string): ParsedEvent[] {
  const text = cheerio.load(html)("body").text().replace(/\s+/g, " ");
  if (!/kids[\s-]*cup/i.test(text)) return [];
  const m = text.match(/(\d{1,2})\.\s*\/\s*(\d{1,2})\.\s*Juli\s+(20\d{2})/i);
  if (!m) return [];
  const startDate = `${m[3]}-07-${m[1]!.padStart(2, "0")}`;
  const endDate = `${m[3]}-07-${m[2]!.padStart(2, "0")}`;
  return [
    {
      externalId: `albstadt-kids-${startDate}`,
      name: "Sparkassen-Kids-Cup — Albstadt",
      startDate,
      endDate,
      placeText: "Albstadt",
      countryHint: "DE",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "Sparkassen-Kids-Cup Albstadt",
      seriesSlug: "sparkassen-kids-cup-albstadt",
      seriesWebsite: "https://www.albstadt-bike-marathon.de/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.85,
    },
  ];
}

/** Stoakart Moasta kids race — day before the Bad Griesbach XCO. */
export function parseStoakartMoasta(url: string, html: string): ParsedEvent[] {
  const text = cheerio.load(html)("body").text().replace(/\s+/g, " ");
  const year = Number(text.match(/Rennen\s+(20\d{2})/i)?.[1] ?? 2026);
  const m = text.match(/(\d{1,2})\.(\d{1,2})\.?\s+Stoakart\s+Moasta/i);
  if (!m) return [];
  const startDate = `${year}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return [
    {
      externalId: `stoakart-${startDate}`,
      name: "Stoakart Moasta — Bad Griesbach",
      startDate,
      placeText: "Bad Griesbach",
      countryHint: "DE",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "Stoakart Moasta",
      seriesSlug: "stoakart-moasta",
      seriesWebsite: "https://rsv-bad-griesbach.de/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.86,
    },
  ];
}

/** Jarní Bahno XC — four Karlovy Vary rounds. */
export async function parseBahno(url: string, html: string): Promise<ParsedEvent[]> {
  let parsed = parseBahnoHtml(url, html);
  if (parsed.length < 3) {
    const home = await fetchText("https://bahno.ambike.com/");
    if (home.ok) parsed = parseBahnoHtml("https://bahno.ambike.com/", home.text);
  }
  return parsed;
}

function parseBahnoHtml(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const year = Number($("body").text().match(/Bahno\s+(20\d{2})/i)?.[1] ?? 2026);
  $("h2, h3").each((_, el) => {
    const raw = $(el)
      .text()
      .replace(/\s+/g, " ")
      .replace(/([^\d\s])(\d)/g, "$1 $2")
      .trim();
    const m = raw.match(/^(.{3,40}?)\s+(\d{1,2})\.\s*(\d{1,2})\.?$/);
    if (!m) return;
    const place = m[1]!.replace(/<[^>]+>/g, "").trim();
    if (!/michal|linhart|kino|goethovka|goethe/i.test(place)) return;
    const startDate = `${year}-${m[3]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
    const label = /michal/i.test(place)
      ? "Sokolov"
      : /linhart/i.test(place)
        ? "Svatý Linhart"
        : /kino/i.test(place)
          ? "Karlovy Vary"
          : "Karlovy Vary";
    push(events, seen, {
      externalId: `bahno-${startDate}-${normalizeName(place)}`,
      name: `Jarní Bahno — ${place}`,
      startDate,
      placeText: label,
      countryHint: "CZ",
      discipline: ["xco"],
      audience: "mixed",
      seriesName: "Jarní Bahno",
      seriesSlug: "jarni-bahno",
      seriesWebsite: "https://bahno.ambike.com/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.87,
    });
  });
  return events;
}

/** BIKE REVOLUTION Kids Race — Davos + Huttwil weekends. */
export function parseBikeRevolutionKids(url: string, html: string): ParsedEvent[] {
  const text = cheerio.load(html)("body").text().replace(/\s+/g, " ");
  if (!/kids\s*race/i.test(text) && !/bike revolution/i.test(text)) return [];
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const rounds: { re: RegExp; place: string; start: string; end: string }[] = [
    {
      re: /26\.\s*bis\s*28\.\s*Juni\s+2026[\s\S]{0,120}Davos/i,
      place: "Davos",
      start: "2026-06-26",
      end: "2026-06-28",
    },
    {
      re: /4\.\s*bis\s*6\.\s*September[\s\S]{0,80}Huttwil/i,
      place: "Huttwil",
      start: "2026-09-04",
      end: "2026-09-06",
    },
  ];
  for (const row of rounds) {
    if (!row.re.test(text)) continue;
    push(events, seen, {
      externalId: `bike-revolution-kids-${row.start}-${normalizeName(row.place)}`,
      name: `BIKE REVOLUTION Kids Race — ${row.place}`,
      startDate: row.start,
      endDate: row.end,
      placeText: row.place,
      countryHint: "CH",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "BIKE REVOLUTION Kids Race",
      seriesSlug: "bike-revolution-kids",
      seriesWebsite: "https://bike-revolution.ch/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.86,
    });
  }
  return events;
}

/** BikeSide Kids Race — Einsiedeln festival Saturday. */
export async function parseBikeSideKids(url: string, html: string): Promise<ParsedEvent[]> {
  let text = cheerio.load(html)("body").text().replace(/\s+/g, " ");
  if (!/kids\s*race|bikeside|iron bike/i.test(text)) return [];
  let m =
    text.match(/(\d{1,2})\.\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.?(\d{2,4})/) ||
    text.match(/(\d{1,2})\.(\d{1,2})\.(20\d{2}).{0,40}(\d{1,2})\.(\d{1,2})\.(20\d{2})/);
  if (!m) {
    const home = await fetchText("https://www.bikeside.ch/");
    if (home.ok) {
      text = cheerio.load(home.text)("body").text().replace(/\s+/g, " ");
      m = text.match(/(\d{1,2})\.\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.?(\d{2,4})/);
    }
  }
  if (!m) return [];
  const yearRaw = m[4] && m[4].length <= 4 ? m[4] : "2026";
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  const startDay = Number(m[1]);
  // Festival Fri–Sun; kids race is Saturday.
  const sat = String(startDay + 1).padStart(2, "0");
  const startDate = `${year}-${m[3]!.padStart(2, "0")}-${sat}`;
  return [
    {
      externalId: `bikeside-kids-${startDate}`,
      name: "BikeSide Kids Race — Einsiedeln",
      startDate,
      placeText: "Einsiedeln",
      countryHint: "CH",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "BikeSide Kids Race",
      seriesSlug: "bikeside-kids",
      seriesWebsite: "https://www.bikeside.ch/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.86,
    },
  ];
}

/** MTB Race Series — Egg. */
export function parseMtbRaceSeriesEgg(url: string, html: string): ParsedEvent[] {
  const text = cheerio.load(html)("body").text().replace(/\s+/g, " ");
  const startDate = deMonthDay(
    text.match(/(\d{1,2})\.\s*September\s+2026/i)?.[1] ?? "",
    "September",
    2026,
  );
  if (!startDate || !/egg/i.test(text)) return [];
  return [
    {
      externalId: `mtb-race-series-egg-${startDate}`,
      name: "MTB Race Series — Egg",
      startDate,
      placeText: "Egg",
      countryHint: "CH",
      discipline: ["xco"],
      audience: "mixed",
      seriesName: "MTB Race Series",
      seriesSlug: "mtb-race-series",
      seriesWebsite: "https://mtbraceseries.ch/egg/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.85,
    },
  ];
}

/** Copa Madrid MTB Kids / X-Sauce Series — 2026 block only. */
export function parseCopaMadridKids(url: string, html: string): ParsedEvent[] {
  const text = cheerio.load(html)("body").text().replace(/\s+/g, " ");
  const block = text.split(/MOUNTAIN BIKE 2026/i)[1]?.split(/MOUNTAIN BIKE 2025/i)[0] ?? "";
  if (!block) return [];
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const re =
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre)\s*[-–]\s*([\s\S]{12,220}?)(?=\s+\d{1,2}\s+de\s+|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const blob = m[3]!;
    if (!/kids|escuelas|copa de madrid/i.test(blob)) continue;
    const mo = ES_MON[m[2]!.toLowerCase()];
    if (!mo) continue;
    const startDate = `2026-${mo}-${m[1]!.padStart(2, "0")}`;
    let place = "Madrid";
    if (/valdeiglesias/i.test(blob)) place = "San Martín de Valdeiglesias";
    else if (/colmenar/i.test(blob)) place = "Colmenar Viejo";
    else if (/alpedrete/i.test(blob)) place = "Alpedrete";
    else if (/ciempozuelos/i.test(blob)) place = "Ciempozuelos";
    else if (/arroyomolinos/i.test(blob)) place = "Arroyomolinos";
    else if (/paracuellos/i.test(blob)) place = "Paracuellos";
    else continue;
    push(events, seen, {
      externalId: `copa-madrid-kids-${startDate}-${normalizeName(place)}`,
      name: `Copa Madrid MTB Kids — ${place}`,
      startDate,
      placeText: place,
      countryHint: "ES",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "Copa Madrid MTB Kids",
      seriesSlug: "copa-madrid-mtb-kids",
      seriesWebsite: url.split("?")[0]!,
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.84,
    });
  }
  return events;
}

/** RaceResult JSON-LD helper for one-off kids races. */
export function parseLillelundsCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  let startDate = "";
  let place = "Denmark";
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text()) as {
        startDate?: string;
        location?: { address?: { addressLocality?: string; addressCountry?: string } };
      };
      if (data.startDate) startDate = data.startDate.slice(0, 10);
      if (data.location?.address?.addressLocality) {
        place = data.location.address.addressLocality;
      }
    } catch {
      /* ignore */
    }
  });
  if (!startDate) {
    const t = $("title").text() + " " + $("body").text();
    const m = t.match(/(\d{2})\.(\d{2})\.(20\d{2})/);
    if (m) startDate = `${m[3]}-${m[2]}-${m[1]}`;
  }
  if (!startDate) return [];
  return [
    {
      externalId: `lillelunds-${startDate}`,
      name: "Lillelunds-Malerforretning MTB Cup",
      startDate,
      placeText: place,
      countryHint: "DK",
      discipline: ["xco"],
      audience: "mixed",
      seriesName: "Lillelunds MTB Cup",
      seriesSlug: "lillelunds-mtb-cup",
      seriesWebsite: url.split("?")[0]!,
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.86,
    },
  ];
}
