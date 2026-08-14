import * as cheerio from "cheerio";
import type { Audience, Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { fetchText } from "@/lib/watcher/http";

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

const PL_MONTHS: Record<string, string> = {
  stycznia: "01",
  lutego: "02",
  marca: "03",
  kwietnia: "04",
  maja: "05",
  czerwca: "06",
  lipca: "07",
  sierpnia: "08",
  wrzesnia: "09",
  września: "09",
  pazdziernika: "10",
  października: "10",
  listopada: "11",
  grudnia: "12",
};

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function deNamed(raw: string, year: number): string | null {
  const m = raw
    .replace(/\s+/g, " ")
    .trim()
    .match(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)/);
  if (!m) return null;
  const mo = DE_MONTHS[m[2]!.toLowerCase()] || DE_MONTHS[fold(m[2]!)];
  if (!mo) return null;
  const y = raw.match(/(20\d{2})/)?.[1] ?? String(year);
  return `${y}-${mo}-${m[1]!.padStart(2, "0")}`;
}

function dmy(raw: string): { start: string; end?: string } | null {
  const t = raw.replace(/\s+/g, " ").trim();
  const range = t.match(
    /(\d{1,2})\.(\d{1,2})\.(20\d{2})\D+(\d{1,2})\.(\d{1,2})\.(20\d{2})/,
  );
  if (range) {
    return {
      start: `${range[3]}-${range[2]!.padStart(2, "0")}-${range[1]!.padStart(2, "0")}`,
      end: `${range[6]}-${range[5]!.padStart(2, "0")}-${range[4]!.padStart(2, "0")}`,
    };
  }
  const one = t.match(/(\d{1,2})\.(\d{1,2})\.(20\d{2})/);
  if (!one) return null;
  return {
    start: `${one[3]}-${one[2]!.padStart(2, "0")}-${one[1]!.padStart(2, "0")}`,
  };
}

function dmyNoYear(raw: string, year: number): string | null {
  const m = raw.replace(/\s+/g, "").match(/^(\d{1,2})\.(\d{1,2})\.?$/);
  if (!m) return null;
  return `${year}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

function push(
  events: ParsedEvent[],
  seen: Set<string>,
  ev: ParsedEvent,
): void {
  if (seen.has(ev.externalId)) return;
  seen.add(ev.externalId);
  events.push(ev);
}

function szcSeries(name: string): {
  seriesName: string;
  seriesSlug: string;
  audience: Audience;
  discipline: Discipline[];
} | null {
  const t = fold(name);
  if (/pumptrack|pumpcup|pump track/.test(t)) return null;
  if (/detska tour petra sagana|\bdtps\b/.test(t)) {
    return {
      seriesName: "Detská Tour Petra Sagana",
      seriesSlug: "detska-tour-petra-sagana",
      audience: "kids",
      discipline: ["xco"],
    };
  }
  if (/detsk[eé]\s*mtb/.test(t)) {
    return {
      seriesName: "Detské MTB",
      seriesSlug: "detske-mtb",
      audience: "kids",
      discipline: ["xco"],
    };
  }
  if (/povazska cykloliga/.test(t)) {
    return {
      seriesName: "Detská Považská Cykloliga",
      seriesSlug: "detska-povazska-cykloliga",
      audience: "kids",
      discipline: ["xco"],
    };
  }
  if (/zupny pohar/.test(t)) {
    if (/road\s*sprint/.test(t)) return null;
    return {
      seriesName: "Župný pohár",
      seriesSlug: "zupny-pohar",
      audience: "mixed",
      discipline: /sprint/.test(t) ? ["xcc"] : ["xcm"],
    };
  }
  if (/\bsp mtb xc\b|m sr.*xc/.test(t) || /\bc[123]\b/.test(t)) {
    return {
      seriesName: "Slovenský pohár MTB XC",
      seriesSlug: "slovensky-pohar-mtb-xc",
      audience: "mixed",
      discipline: /xcc/.test(t) ? ["xcc"] : ["xco"],
    };
  }
  if (/maraton|xcm/.test(t)) {
    return {
      seriesName: "ŠKODA MTB maratóny",
      seriesSlug: "skoda-mtb-maratony",
      audience: "mixed",
      discipline: ["xcm"],
    };
  }
  return {
    seriesName: "SZC MTB XC",
    seriesSlug: "szc-mtb-xc",
    audience: "mixed",
    discipline: ["xco"],
  };
}

/** Slovak Cycling Federation MTB XC calendar — covers DTPS, kids cups, SP XC. */
export function parseSzcMtb(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $("table.table_events tr").each((_, tr) => {
    const $tds = $(tr).find("td");
    if ($tds.length < 3) return;
    const dates = dmy($tds.eq(0).text());
    if (!dates) return;
    const name = $tds
      .eq(1)
      .text()
      .replace(/\s+/g, " ")
      .replace(/\s*MTB Cross country\s*$/i, "")
      .trim();
    const place = $tds.eq(2).text().replace(/\s+/g, " ").trim();
    if (!name || name.length < 4) return;
    if (!place || dates.start.endsWith("-01-01")) return;
    const meta = szcSeries(name);
    if (!meta) return;

    const pdf = $tds.find("a[href$='.pdf']").attr("href");
    let websiteUrl = url;
    if (pdf) {
      try {
        websiteUrl = new URL(pdf, url).toString();
      } catch {
        /* keep */
      }
    }

    push(events, seen, {
      externalId: `szc-${dates.start}-${normalizeName(name)}`,
      name,
      startDate: dates.start,
      endDate: dates.end,
      placeText: place.replace(/\s*\(CZE\)\s*/i, "").trim(),
      countryHint: /cze\)|\bcZ\b/i.test(place) ? "CZ" : "SK",
      discipline: meta.discipline,
      audience: meta.audience,
      seriesName: meta.seriesName,
      seriesSlug: meta.seriesSlug,
      seriesWebsite: "https://www.cyklistikaszc.sk/sk/mtb-cross-country/kalendar",
      sourceUrl: url,
      websiteUrl,
      confidence: 0.88,
    });
  });
  return events;
}

/** ALB-GOLD Juniors Cup — The Events Calendar REST. */
export async function parseAlbGoldJuniors(
  url: string,
  _html: string,
): Promise<ParsedEvent[]> {
  const y = new Date().getFullYear();
  const api = `https://albgold-juniorscup.de/wp-json/tribe/events/v1/events?start_date=${y}-01-01&end_date=${y + 1}-12-31&per_page=50`;
  const fetched = await fetchText(api, { accept: "application/json" });
  if (!fetched.ok || !fetched.text) return [];
  let payload: { events?: { start_date?: string; title?: string; url?: string }[] };
  try {
    payload = JSON.parse(fetched.text) as typeof payload;
  } catch {
    return [];
  }
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  for (const ev of payload.events ?? []) {
    const startDate = (ev.start_date || "").slice(0, 10);
    const title = (ev.title || "").replace(/\s+/g, " ").trim();
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(startDate) || !title) continue;
    if (/ehrung|siegerehrung/i.test(title)) continue;
    const place = title.replace(/^AGJC\s+/i, "").trim();
    push(events, seen, {
      externalId: `alb-gold-${startDate}-${normalizeName(title)}`,
      name: `ALB-GOLD Juniors Cup — ${place}`,
      startDate,
      placeText: place,
      countryHint: "DE",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "ALB-GOLD Juniors Cup",
      seriesSlug: "alb-gold-juniors-cup",
      seriesWebsite: "https://albgold-juniorscup.de/",
      sourceUrl: url,
      websiteUrl: ev.url || "https://albgold-juniorscup.de/",
      confidence: 0.9,
    });
  }
  return events;
}

export function parseRookiesOstbayern(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  $("article.rco-upcoming-race-card").each((_, el) => {
    const $el = $(el);
    const startDate = deNamed($el.find(".rco-upcoming-race-date").text(), 2026);
    const name = $el.find(".rco-upcoming-race-title").text().replace(/\s+/g, " ").trim();
    const place = $el.find(".rco-upcoming-race-place").text().replace(/\s+/g, " ").trim();
    if (!startDate || !name) return;
    const href = $el.find("a[href*='/races/']").attr("href");
    let websiteUrl = url;
    if (href) {
      try {
        websiteUrl = new URL(href, url).toString();
      } catch {
        /* keep */
      }
    }
    const shortPlace = (place.split(",")[0] || name).trim();
    push(events, seen, {
      externalId: `rookies-ob-${startDate}-${normalizeName(name)}`,
      name: `Rookies Cup Ostbayern — ${name.replace(/\s*2026\s*$/, "").trim()}`,
      startDate,
      placeText: shortPlace,
      countryHint: "DE",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "Rookies Cup Ostbayern",
      seriesSlug: "rookies-cup-ostbayern",
      seriesWebsite: "https://rookiescup-ostbayern.de/",
      sourceUrl: url,
      websiteUrl,
      confidence: 0.88,
    });
  });
  return events;
}

export function parseXcoBikecup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const year = Number(html.match(/Rennen\s*(20\d{2})/i)?.[1] ?? new Date().getFullYear());
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  $(".event-kachel").each((_, el) => {
    const $el = $(el);
    const place = $el.find(".event-title").text().replace(/\s+/g, " ").trim();
    const startDate = deNamed($el.find(".event-date").text(), year);
    if (!place || !startDate) return;
    push(events, seen, {
      externalId: `xco-bikecup-${startDate}-${normalizeName(place)}`,
      name: `XCO-Bikecup — ${place}`,
      startDate,
      placeText: place.replace(/\s*\(.*\)\s*$/, "").trim(),
      countryHint: "DE",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "XCO-Bikecup Mitteldeutschland",
      seriesSlug: "xco-bikecup",
      seriesWebsite: "https://xco-bikecup.de/",
      sourceUrl: url,
      websiteUrl: url,
      confidence: 0.86,
    });
  });
  return events;
}

export function parseSchwarzwalderCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text();
  const places = new Map<string, string>();
  const placeRe = /R(\d)\s*[–-]\s*([A-Za-zÄÖÜäöüß. \/-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = placeRe.exec(text))) {
    places.set(m[1]!, m[2]!.trim());
  }
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const dateRe = /R(\d)\s+(?:Sa|So)?\s*(\d{2}\.\d{2}\.20\d{2})/g;
  while ((m = dateRe.exec(text))) {
    const dates = dmy(m[2]!);
    const place = places.get(m[1]!);
    if (!dates || !place) continue;
    push(events, seen, {
      externalId: `smc-${dates.start}-r${m[1]}`,
      name: `Schwarzwälder MTB Cup — ${place}`,
      startDate: dates.start,
      placeText: place,
      countryHint: "DE",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "Schwarzwälder ADAC MTB Cup",
      seriesSlug: "schwarzwaelder-mtb-cup",
      seriesWebsite: "https://schwarzwaelder-mtb-cup.de/",
      sourceUrl: url,
      websiteUrl: url,
      confidence: 0.84,
    });
  }
  return events;
}

export function parseRheinEifelCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  $("h4").each((_, el) => {
    const raw = $(el).text().replace(/\s+/g, " ").trim();
    const m = raw.match(/^(\d{2}\.\d{2}\.20\d{2})\s+([A-ZÄÖÜ][A-Za-zäöüß-]+)$/);
    if (!m) return;
    const dates = dmy(m[1]!);
    const place = m[2]!.trim();
    if (!dates || /rhein|eifel|cup|support|termine/i.test(place)) return;
    push(events, seen, {
      externalId: `rhein-eifel-${dates.start}-${normalizeName(place)}`,
      name: `Rhein-Eifel MTB Cup — ${place}`,
      startDate: dates.start,
      placeText: place,
      countryHint: "DE",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "Rhein-Eifel MTB Cup",
      seriesSlug: "rhein-eifel-mtb-cup",
      seriesWebsite: "https://rhein-eifel-mtb-cup.de/",
      sourceUrl: url,
      websiteUrl: url,
      confidence: 0.85,
    });
  });
  return events;
}

export function parseOberschwabenCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const year = Number(
    html.match(/OMV Cup\s*(20\d{2})/i)?.[1] ?? String(new Date().getFullYear()),
  );
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  $("a").each((_, a) => {
    const raw = $(a).text().replace(/\s+/g, " ").trim();
    const hyphen = raw.match(/^(\d{1,2}\.\d{1,2})\s*[-–]\s*(.+)$/);
    const spaced = raw.match(/^(\d{1,2}\.\d{1,2})\s+([A-ZÄÖÜ].+)$/);
    const m = hyphen || spaced;
    if (!m) return;
    const startDate = dmyNoYear(m[1]!, year);
    const place = m[2]!.replace(/\s+Kurz.*$/i, "").trim();
    if (!startDate || place.length < 3 || place.length > 40) return;
    if (/übersicht|ergebnis|anmeld|home|cup/i.test(place)) return;
    push(events, seen, {
      externalId: `omv-${startDate}-${normalizeName(place)}`,
      name: `MTB Oberschwaben Cup — ${place}`,
      startDate,
      placeText: place,
      countryHint: "DE",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "MTB Oberschwaben Cup",
      seriesSlug: "mtb-oberschwaben-cup",
      seriesWebsite: "https://mtb-oberschwaben-cup.de/",
      sourceUrl: url,
      websiteUrl: url,
      confidence: 0.82,
    });
  });
  return events;
}

const SAARLAND_VENUES: { place: string; slug: string }[] = [
  { place: "Neunkirchen", slug: "neunkirchen" },
  { place: "Eppelborn", slug: "eppelborn" },
  { place: "Hirzweiler", slug: "hirzweiler" },
  { place: "Sankt Ingbert", slug: "sankt-ingbert" },
  { place: "Oberthal", slug: "oberthal" },
  { place: "Schmelz", slug: "schmelz" },
  { place: "Freisen", slug: "freisen" },
  { place: "Kirkel", slug: "kirkel" },
];

function saarlandDate(raw: string): { start: string; end?: string } | null {
  const span = raw.match(/(\d{2})\.\+(\d{2})\.(\d{2})\.(20\d{2})/);
  if (span) {
    return {
      start: `${span[4]}-${span[3]!.padStart(2, "0")}-${span[1]!.padStart(2, "0")}`,
      end: `${span[4]}-${span[3]!.padStart(2, "0")}-${span[2]!.padStart(2, "0")}`,
    };
  }
  return dmy(raw);
}

export function parseSaarlandliga(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const re = /((?:\d{2}\.\+)?\d{2}\.\d{2}\.20\d{2})\s+(XCO|XCC|Technik)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const dates = saarlandDate(m[1]!);
    if (!dates) continue;
    const before = text.slice(Math.max(0, m.index - 48), m.index);
    const venue = [...SAARLAND_VENUES]
      .map((v) => ({ ...v, at: before.toLowerCase().lastIndexOf(v.place.toLowerCase()) }))
      .filter((v) => v.at >= 0)
      .sort((a, b) => b.at - a.at)[0];
    if (!venue) continue;
    push(events, seen, {
      externalId: `saarlandliga-${dates.start}-${venue.slug}`,
      name: `MTB Saarlandliga — ${venue.place}`,
      startDate: dates.start,
      endDate: dates.end,
      placeText: venue.place,
      countryHint: "DE",
      discipline: /xcc/i.test(m[2]!) ? ["xcc"] : ["xco"],
      audience: "kids",
      seriesName: "MTB Saarlandliga",
      seriesSlug: "mtb-saarlandliga",
      seriesWebsite: "https://mtbsaarlandliga.de/",
      sourceUrl: url,
      websiteUrl: `https://mtbsaarlandliga.de/rennen/${venue.slug}/`,
      confidence: 0.86,
    });
  }
  return events;
}

export function parseJuniorBikeCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text();
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const re = /(\d{2}\.\d{2}\.20\d{2})\s*[–-]\s*([^|\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const dates = dmy(m[1]!);
    const rest = m[2]!.replace(/\s+/g, " ").trim();
    if (!dates || /stra[sß]e|pumptrack/i.test(rest)) continue;
    const slash = rest.split(/\s*\/\s*/);
    const place = (slash[1] || slash[0] || "")
      .replace(/[„"].*$/, "")
      .replace(/\s+Link.*$/i, "")
      .replace(/^Union MTB Club\s+/i, "")
      .trim();
    if (!place || place.length < 3 || /^[a-z]$/i.test(place)) continue;
    push(events, seen, {
      externalId: `jbc-${dates.start}-${normalizeName(place)}`,
      name: `Junior Bike Cup — ${place}`,
      startDate: dates.start,
      placeText: place,
      countryHint: "AT",
      discipline: /xc/i.test(rest) ? ["xco"] : ["mtb"],
      audience: "kids",
      seriesName: "Junior Bike Cup",
      seriesSlug: "junior-bike-cup",
      seriesWebsite: "https://www.juniorbikecup.at/",
      sourceUrl: url,
      websiteUrl: url,
      confidence: 0.84,
    });
  }
  return events;
}

export function parseOnOffMtb(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const dates = dmy(text.match(/Termín:\s*[^0-9]*(\d{2}\.\d{2}\.20\d{2})/i)?.[1] ?? "");
  const place =
    text.match(/Místo:\s*([^0-9]{8,80}?)\s*(?:Přihlášení|Start)/i)?.[1]?.replace(
      /\s+/g,
      " ",
    ).trim() || "Branka u Opavy";
  if (!dates) return [];
  const shortPlace = /brance u opavy|branka/i.test(place) ? "Branka u Opavy" : place.slice(0, 40);
  return [
    {
      externalId: `on-off-${dates.start}-${normalizeName(shortPlace)}`,
      name: `ON-OFF MTB pohár — ${shortPlace}`,
      startDate: dates.start,
      placeText: shortPlace,
      countryHint: "CZ",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "ON-OFF MTB pohár",
      seriesSlug: "on-off-mtb-pohar",
      seriesWebsite: "https://on-offteam.cz/on-off-mtb-pohar-2026/",
      sourceUrl: url,
      websiteUrl: url,
      confidence: 0.86,
    },
  ];
}

export function parsePolandBike(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const year = Number(html.match(/POLAND BIKE MARATHON\s*(20\d{2})/i)?.[1] ?? 2026);
  const values: string[] = [];
  $("td[data-original-value]").each((_, td) => {
    const raw = ($(td).attr("data-original-value") || $(td).text())
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!raw || /\.png/i.test(raw)) return;
    values.push(raw);
  });
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < values.length - 1; i++) {
    const dm = values[i]!.match(
      /^(\d{1,2})\s+(stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|wrze[sś]nia|pa[zź]dziernika|listopada|grudnia)\b/i,
    );
    if (!dm) continue;
    const label = values[i + 1]!;
    if (/^\d{1,2}\s+/.test(label)) continue;
    const mo = PL_MONTHS[dm[2]!.toLowerCase()] || PL_MONTHS[fold(dm[2]!)];
    if (!mo) continue;
    const startDate = `${year}-${mo}-${dm[1]!.padStart(2, "0")}`;
    const place = label
      .replace(/^(INAUGURACJA|FINA[ŁL])\s*[-–]\s*/i, "")
      .replace(/^[IVXLCDM]+\s*ETAP\s*[-–]\s*/i, "")
      .replace(/^GMINA\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!place || place.length < 3) continue;
    push(events, seen, {
      externalId: `polandbike-${startDate}-${normalizeName(place)}`,
      name: `Poland Bike — ${place}`,
      startDate,
      placeText: place.replace(/\s*\(.*\)\s*$/, "").trim(),
      countryHint: "PL",
      discipline: ["xcm"],
      audience: "mixed",
      seriesName: "LOTTO Poland Bike Marathon",
      seriesSlug: "poland-bike",
      seriesWebsite: "https://polandbike.pl/",
      sourceUrl: url,
      websiteUrl: "https://polandbike.pl/junior-race/",
      confidence: 0.84,
    });
    i += 1;
  }
  return events;
}

export function parseSalzkammergutTrophy(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text();
  const m = text.match(/(\d{2}\.\d{2}\.20\d{2})\s+Salzkammergut Trophy/i);
  const dates = m ? dmy(m[1]!) : null;
  if (!dates) return [];
  return [
    {
      externalId: `skgtrophy-${dates.start}`,
      name: "Salzkammergut Trophy",
      startDate: dates.start,
      placeText: "Bad Goisern",
      countryHint: "AT",
      discipline: ["xcm"],
      audience: "mixed",
      seriesName: "Salzkammergut Trophy",
      seriesSlug: "salzkammergut-trophy",
      seriesWebsite: "https://www.salzkammergut-trophy.at/",
      sourceUrl: url,
      websiteUrl: "https://www.salzkammergut-trophy.at/",
      confidence: 0.9,
    },
  ];
}

function sumavskyPlace(place: string): string {
  if (/tábor|cekanice|čekanice|cihelna/i.test(place)) return "Tábor";
  return place.split("–")[0]!.split("-")[0]!.trim();
}

function pushSumavsky(
  events: ParsedEvent[],
  seen: Set<string>,
  url: string,
  place: string,
  startDate: string,
): void {
  if (/waldkirchen/i.test(place)) return;
  const shortPlace = sumavskyPlace(place);
  if (!shortPlace) return;
  push(events, seen, {
    externalId: `sumavsky-${startDate}-${normalizeName(shortPlace)}`,
    name: `Šumavský pohár MTB — ${shortPlace}`,
    startDate,
    placeText: shortPlace,
    countryHint: "CZ",
    discipline: ["xco"],
    audience: "mixed",
    seriesName: "Šumavský MTB pohár",
    seriesSlug: "sumavsky-mtb-pohar",
    seriesWebsite: "https://jcp-mtb.cz/",
    sourceUrl: url.split("?")[0]!,
    websiteUrl: "https://jcp-mtb.cz/",
    confidence: 0.9,
  });
}

/** Šumavský pohár MTB — `jcp-mtb.cz` race cards (TERMÍN in each section). */
export function parseSumavskyPohar(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  $("section.race-item").each((_, section) => {
    const $s = $(section);
    const place = $s.find("h2").first().text().replace(/\s+/g, " ").trim();
    if (!place || /regionální|seriál|kalendář/i.test(place)) return;
    const chunk = $s.find("table").first().text().replace(/\s+/g, " ");
    const dates = dmy(chunk.match(/TERMÍN[^0-9]*(\d{1,2}\.\d{1,2}\.20\d{2})/i)?.[1] ?? "");
    if (!dates) return;
    pushSumavsky(events, seen, url, place, dates.start);
  });
  if (events.length) return events;
  $(".calendar-item").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    const dates = dmy(t);
    if (!dates) return;
    const place = t.replace(/.*?(\d{1,2}\.\d{1,2}\.20\d{2})\s*/, "").trim();
    pushSumavsky(events, seen, url, place, dates.start);
  });
  return events;
}

function bayerwaldStart(dateCell: string, typeCell: string): string | null {
  const cc = typeCell.match(/(\d{1,2})\.(\d{1,2})\.?\s*CC/i);
  if (cc) {
    const y = dateCell.match(/(20\d{2}|\d{2})\s*$/)?.[1];
    const year = y && y.length === 2 ? `20${y}` : y || "2026";
    return `${year}-${cc[2]!.padStart(2, "0")}-${cc[1]!.padStart(2, "0")}`;
  }
  const span = dateCell.match(/(\d{1,2})\.(\d{1,2})\.?(20\d{2}|\d{2})?\s*[-–/]\s*(\d{1,2})\.(\d{1,2})\.?(20\d{2}|\d{2})?/);
  if (span) {
    const y = span[6] || span[3] || "2026";
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${span[5]!.padStart(2, "0")}-${span[4]!.padStart(2, "0")}`;
  }
  const one = dateCell.match(/(\d{1,2})\.(\d{1,2})\.(20\d{2})/);
  if (one) return `${one[3]}-${one[2]!.padStart(2, "0")}-${one[1]!.padStart(2, "0")}`;
  return dmy(dateCell)?.start ?? null;
}

function bayerwaldDiscipline(type: string): Discipline[] {
  const t = type.toLowerCase();
  const out: Discipline[] = [];
  if (/\bxce\b|eliminator/.test(t)) out.push("xce");
  if (/\bxcc\b/.test(t)) out.push("xcc");
  if (/bergrennen|xcu/.test(t)) out.push("hill_climb");
  if (/\bcc\b|xco|technik|slalom/.test(t) && !out.includes("xco")) out.push("xco");
  return out.length ? out : ["xco"];
}

function bayerwaldPlace(name: string): string {
  const n = name.replace(/\s*\(.*\)\s*$/, "").trim();
  if (/karolirado/i.test(n)) return "Waldkirchen";
  if (/ilztalkini|b[üu]chlberg/i.test(n)) return "Büchlberg";
  if (/kronberg|viechtach/i.test(n)) return "Viechtach";
  if (/passau/i.test(n)) return "Passau";
  if (/tag des sports|neureichenau/i.test(n)) return "Neureichenau";
  if (/griesbach/i.test(n)) return "Bad Griesbach";
  return n.replace(/\s+Stoakart.*/i, "").replace(/\s*bei Lipno/i, "").trim();
}

function absHttp(raw: string, base: string): string {
  const t = raw.trim();
  if (!t) return base;
  try {
    if (/^https?:\/\//i.test(t)) return new URL(t, base).toString();
    if (/^(www\.)?[\w.-]+\.[a-z]{2,}(\/|$)/i.test(t)) {
      return `https://${t.replace(/^\/\//, "")}`;
    }
    return new URL(t, base).toString();
  } catch {
    return base;
  }
}

/** Bayerwald MTB Cup — homepage TablePress calendar. */
export function parseBayerwaldCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  $("#tablepress-4 tr").each((_, tr) => {
    const $tds = $(tr).find("td");
    if ($tds.length < 2) return;
    const dateRaw = $tds.eq(0).text().replace(/\s+/g, " ").trim();
    const name = $tds.eq(1).text().replace(/\s+/g, " ").trim();
    const type = $tds.eq(2).text().replace(/\s+/g, " ").trim();
    const href =
      $tds.eq(3).find("a[href]").attr("href") ||
      $tds.eq(3).text().replace(/\s+/g, " ").trim();
    if (!name || /siegerung|gesamtwertung|ehrung/i.test(name)) return;
    // Nová Pec is the Šumavský round.
    if (/nov[aá]\s*pec/i.test(name)) return;
    const startDate = bayerwaldStart(dateRaw, type);
    if (!startDate) return;
    const place = bayerwaldPlace(name);
    const websiteUrl = absHttp(href, url.split("?")[0]!);
    push(events, seen, {
      externalId: `bayerwald-${startDate}-${normalizeName(place)}`,
      name: `Bayerwald MTB Cup — ${place}`,
      startDate,
      placeText: place,
      countryHint: "DE",
      discipline: bayerwaldDiscipline(`${type} ${name}`),
      audience: /nur ab u17/i.test(`${type} ${name}`) ? "youth" : "kids",
      seriesName: "Bayerwald MTB Cup",
      seriesSlug: "bayerwald-mtb-cup",
      seriesWebsite: "https://www.bayerwald-mtb-cup.com/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl,
      confidence: 0.88,
    });
  });
  return events;
}

/** Werdenfelser MTB-Kids-Cup — `werdenfelscup.html` date list. */
export function parseWerdenfelserCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const re =
    /(\d{1,2})\.\s*(Juni|Juli|August|September|Oktober|November)\s*(20\d{2})?\s*(?:in\s+)?[-–]?\s*(Farchant|Mittenwald|Oberammergau|Benediktbeuern)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const startDate = deNamed(`${m[1]}. ${m[2]} ${m[3] || "2026"}`, 2026);
    const place = m[4]!;
    if (!startDate) continue;
    const discipline: Discipline[] = /oberammergau/i.test(place) ? ["dh"] : ["xco"];
    push(events, seen, {
      externalId: `werdenfels-${startDate}-${normalizeName(place)}`,
      name: `Werdenfelser MTB-Kids-Cup — ${place}`,
      startDate,
      placeText: place,
      countryHint: "DE",
      discipline,
      audience: "kids",
      seriesName: "Werdenfelser MTB-Kids-Cup",
      seriesSlug: "werdenfelser-mtb-kids-cup",
      seriesWebsite: "https://mtb.skiclub-bb.com/werdenfelscup.html",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.9,
    });
  }
  return events;
}

/** FILIPA Podkrkonošský maraton — single 2026 race with kids categories. */
export function parsePodkrkonosskyMaraton(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  let heading = "";
  $("h2").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (/\d{1,2}\.\d{1,2}\.20\d{2}/.test(t)) {
      heading = t;
      return false;
    }
  });
  const hm = heading.match(/(\d{1,2})\.(\d{1,2})\.(20\d{2})\s+(.+)/);
  const startDate = hm
    ? `${hm[3]}-${hm[2]!.padStart(2, "0")}-${hm[1]!.padStart(2, "0")}`
    : null;
  const place = (hm?.[4] || "Lázně Bělohrad").replace(/\s+/g, " ").trim();
  if (!startDate) return [];
  return [
    {
      externalId: `podkrkonossky-${startDate}`,
      name: "Podkrkonošský maraton",
      startDate,
      placeText: place,
      countryHint: "CZ",
      discipline: ["xcm"],
      audience: "mixed",
      seriesName: "Podkrkonošský maraton",
      seriesSlug: "podkrkonossky-maraton",
      seriesWebsite: "https://www.sportchallenge.cz/cz/podkrkonosskymaraton/2026",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: "https://www.sportchallenge.cz/cz/podkrkonosskymaraton/2026",
      confidence: 0.86,
    },
  ];
}

/** MTB Rhein-Main-Cup — homepage 2026 dates. */
export function parseRheinMainCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const re =
    /(\d{1,2})\.(\d{1,2})\.(20\d{2})\s*[-–]\s*(Bensheim|Dexheim|Bauschheim|Darmstadt)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const startDate = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    const place = m[4]!;
    push(events, seen, {
      externalId: `rhein-main-${startDate}-${normalizeName(place)}`,
      name: `MTB Rhein-Main-Cup — ${place}`,
      startDate,
      placeText: place,
      countryHint: "DE",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "MTB Rhein-Main-Cup",
      seriesSlug: "mtb-rhein-main-cup",
      seriesWebsite: "https://www.mtb-rhein-main-cup.de/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: "https://www.mtb-rhein-main-cup.de/",
      confidence: 0.9,
    });
  }
  return events;
}

/** eldoRADo Kids-Cup — `termine-2` table. Skip marathon + awards + Benediktbeuern (Werdenfels). */
export function parseEldoradoKidsCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  $("figure.wp-block-table table tr, table tr").each((_, tr) => {
    const $tds = $(tr).find("td");
    if ($tds.length < 2) return;
    const dateRaw = $tds.eq(0).text().replace(/\s+/g, " ").trim();
    const placeRaw = $tds.eq(1).text().replace(/\s+/g, " ").trim();
    const href = $tds.eq(2).find("a[href]").attr("href") || $tds.eq(2).text().trim();
    if (/marathon|sportklasse|schlussveranstaltung|benediktbeuern/i.test(`${placeRaw} ${dateRaw}`)) {
      return;
    }
    const dates = dmy(dateRaw);
    if (!dates) return;
    const cc = /\(GER\)|\(DE\)/i.test(placeRaw) ? "DE" : "AT";
    const place = placeRaw.replace(/\s*\((AUT|GER|DE|AT)\)\s*/i, "").trim();
    if (!place) return;
    push(events, seen, {
      externalId: `eldorado-${dates.start}-${normalizeName(place)}`,
      name: `eldoRADo Kids-Cup — ${place}`,
      startDate: dates.start,
      placeText: place,
      countryHint: cc,
      discipline: ["xco"],
      audience: "kids",
      seriesName: "eldoRADo Kids-Cup",
      seriesSlug: "eldorado-kids-cup",
      seriesWebsite: "https://mtb-kidscup.de/start/termine-2/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: absHttp(href, url.split("?")[0]!),
      confidence: 0.9,
    });
  });
  return events;
}

/** KTM Junior Challenge — dates labelled with Austrian state codes. */
export function parseKtmJuniorChallenge(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const re =
    /(\d{1,2})\.(\d{1,2})\.(20\d{2})\s+(Maria Lankowitz|Kleinzell|Stattegg|Graz\/Stattegg|Bad Goisern|Mank|Krumbach)\s*\((ST|OÖ|NÖ|OT)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const startDate = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    const raw = m[4]!;
    const place = /stattegg/i.test(raw) ? "Stattegg" : raw;
    push(events, seen, {
      externalId: `ktm-junior-${startDate}-${normalizeName(place)}`,
      name: `KTM Junior Challenge — ${place}`,
      startDate,
      placeText: place,
      countryHint: "AT",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "KTM Junior Challenge",
      seriesSlug: "ktm-junior-challenge",
      seriesWebsite: "https://www.mountainbike-challenge.at/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: "https://www.mountainbike-challenge.at/",
      confidence: 0.88,
    });
  }
  return events;
}

function vrlPlace(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (/hrabušice|hrabusice/i.test(t)) return "Hrabušice";
  if (/\bsvit\b/i.test(t)) return "Svit";
  if (/košice|kosice/i.test(t)) return "Košice";
  if (/stropkov/i.test(t)) return "Stropkov";
  if (/spišská belá|spisska bela/i.test(t)) return "Spišská Belá";
  if (/tatranská lomnica|tatranska lomnica/i.test(t)) return "Tatranská Lomnica";
  if (/spišský hrhov|spissky hrhov/i.test(t)) return "Spišský Hrhov";
  if (/šarišské bohdanovce|sarisske/i.test(t)) return "Šarišské Bohdanovce";
  if (/uzovské pekľany|uzovske peklany/i.test(t)) return "Uzovské Pekľany";
  if (/lučivná|lucivna/i.test(t)) return "Lučivná";
  if (/prešov|presov/i.test(t)) return "Prešov";
  if (/svidník|svidnik/i.test(t)) return "Svidník";
  return t.split(/\s+[-–]\s+/)[0]!.replace(/\s+\d+\.kolo.*$/i, "").trim();
}

/** Detská VRL Adriána Babiča — SooF.sk event calendar lines. */
export function parseDetskaVrl(url: string, html: string): ParsedEvent[] {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ");
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const re =
    /(\d{1,2})\.(\d{1,2})\.(20\d{2})\s*[-–]\s*\d+[.\-]?kolo\s*[-–]\s*(?:Detská VRL Adriána Babiča|Memoriál A\.\s*Babiča)\s*[-–]\s*([^0-9]{3,80}?)(?=\s+\d{1,2}\.\d{1,2}\.20\d{2}|\s+VÝCHOD|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const startDate = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    const place = vrlPlace(m[4]!);
    if (!place) continue;
    push(events, seen, {
      externalId: `detska-vrl-${startDate}-${normalizeName(place)}`,
      name: `Detská VRL — ${place}`,
      startDate,
      placeText: place,
      countryHint: "SK",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "Detská VRL Adriána Babiča",
      seriesSlug: "detska-vrl",
      seriesWebsite: "https://www.soof.sk/podujatia-a-akcie",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.86,
    });
  }
  return events;
}

/** Berg & Bike / MPDV Cup — 2026 menu dates. */
export function parseMpdvCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const re = /(\d{1,2})\.(\d{1,2})\.(20\d{2})\s+([A-Za-zÄÖÜäöüß-]+)\s*\[W\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const startDate = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    const place = m[4]!;
    push(events, seen, {
      externalId: `mpdv-${startDate}-${normalizeName(place)}`,
      name: `Berg & Bike Cup — ${place}`,
      startDate,
      placeText: place,
      countryHint: "DE",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "Berg & Bike Cup",
      seriesSlug: "berg-bike-cup",
      seriesWebsite: "https://www.mpdv-cup.de/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: "https://www.mpdv-cup.de/",
      confidence: 0.84,
    });
  }
  return events;
}

/** Wiesbadener Stadtmeisterschaft — Adamstal round only (Dexheim is Rhein-Main). */
export function parseWiesbadenStadtmeisterschaft(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const m = text.match(/Hofgut Adamstal am (\d{1,2})\.(\d{1,2})\.(20\d{2})/i);
  if (!m) return [];
  const startDate = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return [
    {
      externalId: `wiesbaden-stadt-${startDate}`,
      name: "Wiesbadener Stadtmeisterschaft MTB",
      startDate,
      placeText: "Wiesbaden",
      countryHint: "DE",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "Wiesbadener Stadtmeisterschaft MTB",
      seriesSlug: "wiesbadener-stadtmeisterschaft-mtb",
      seriesWebsite: "https://schulsportverein.de/stadtmeisterschaft/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.86,
    },
  ];
}

/** globmetal XC Race — SPA; dates live in the meta description. */
export function parseGlobmetalXc(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const desc =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";
  const m = desc.match(/(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s+([A-Za-ząćęłńóśźż]+)\s+(20\d{2})/i);
  if (!m) return [];
  const mo = PL_MONTHS[m[3]!.toLowerCase()] || PL_MONTHS[fold(m[3]!)];
  if (!mo) return [];
  const startDate = `${m[4]}-${mo}-${m[1]!.padStart(2, "0")}`;
  const endDate = m[2] ? `${m[4]}-${mo}-${m[2]!.padStart(2, "0")}` : undefined;
  return [
    {
      externalId: `globmetal-${startDate}`,
      name: "globmetal XC Race",
      startDate,
      endDate,
      placeText: "Mrągowo",
      countryHint: "PL",
      discipline: ["xco"],
      audience: "mixed",
      seriesName: "globmetal XC Race",
      seriesSlug: "globmetal-xc-race",
      seriesWebsite: "https://globmetalxc.pl/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: "https://globmetalxc.pl/",
      confidence: 0.84,
    },
  ];
}

/** Zanzenberg Race XCO ÖM — RaceResult JSON-LD. */
export function parseZanzenbergOem(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  let startDate = "";
  let endDate: string | undefined;
  let place = "Dornbirn";
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text()) as {
        startDate?: string;
        endDate?: string;
        location?: { address?: { addressLocality?: string } };
      };
      if (data.startDate) startDate = data.startDate.slice(0, 10);
      if (data.endDate) endDate = data.endDate.slice(0, 10);
      if (data.location?.address?.addressLocality) {
        place = data.location.address.addressLocality;
      }
    } catch {
      /* ignore */
    }
  });
  if (!startDate) {
    const t = $("title").text();
    const m = t.match(/(\d{2})\.(\d{2})\.(20\d{2})/);
    if (m) startDate = `${m[3]}-${m[2]}-${m[1]}`;
  }
  if (!startDate) return [];
  return [
    {
      externalId: `zanzenberg-${startDate}`,
      name: "Zanzenberg Race XCO ÖM",
      startDate,
      endDate,
      placeText: place,
      countryHint: "AT",
      discipline: ["xco"],
      audience: "mixed",
      seriesName: "Zanzenberg Race",
      seriesSlug: "zanzenberg-race",
      seriesWebsite: url.split("?")[0]!,
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.88,
    },
  ];
}

/** Allgäuer Alpenwasser MTB Kids Cup — Wildpoldsried datasport page. */
export function parseAllgaeuKidsCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const startDate = deNamed(text.match(/(\d{1,2}\.\s*[A-Za-zÄÖÜäöüß]+\s+20\d{2})/)?.[1] ?? "", 2026);
  if (!startDate) return [];
  return [
    {
      externalId: `allgaeu-kids-${startDate}-wildpoldsried`,
      name: "Allgäuer Alpenwasser MTB Kids Cup — Wildpoldsried",
      startDate,
      placeText: "Wildpoldsried",
      countryHint: "DE",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "Allgäuer Alpenwasser MTB Kids Cup",
      seriesSlug: "allgaeuer-alpenwasser-mtb-kids-cup",
      seriesWebsite: url.split("?")[0]!,
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.85,
    },
  ];
}

const SK_MONTHS: Record<string, string> = {
  januar: "01",
  februar: "02",
  marec: "03",
  april: "04",
  maj: "05",
  jun: "06",
  jul: "07",
  august: "08",
  september: "09",
  oktober: "10",
  november: "11",
  december: "12",
};

const SK_MONTH_ALT =
  "janu[aá]r|febru[aá]r|marec|apr[ií]l|m[aá]j|j[uú]n|j[uú]l|august|september|okt[oó]ber|november|december";

/** Official homepage round list: "4. Apríl | 2026Šamorín" (year glued to town). */
export function parseDetskaTour(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const re = new RegExp(
    `(\\d{1,2})\\.\\s*(${SK_MONTH_ALT})\\s*\\|\\s*(20\\d{2})\\s*([A-ZÁÉÍÓÚÄÔĎŤŇŽŠČĽ][\\w\\-áéíóúäôďťňžščľÁÉÍÓÚ]*)`,
    "i",
  );
  const tours = $(".tour").toArray();
  const chunks = tours.length
    ? tours.map((el) => $(el).text().replace(/\s+/g, " ").trim())
    : [...$("body").text().replace(/\s+/g, " ").matchAll(
        new RegExp(re.source, "gi"),
      )].map((x) => x[0]!);
  for (const chunk of chunks) {
    const m = re.exec(chunk);
    if (!m) continue;
    const mo = SK_MONTHS[fold(m[2]!)] || SK_MONTHS[m[2]!.toLowerCase()];
    if (!mo) continue;
    const startDate = `${m[3]}-${mo}-${m[1]!.padStart(2, "0")}`;
    const place = m[4]!.trim();
    if (place.length < 3) continue;
    push(events, seen, {
      externalId: `dtps-${startDate}-${normalizeName(place)}`,
      name: `DTPS — ${place}`,
      startDate,
      placeText: place,
      countryHint: "SK",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "Detská Tour Petra Sagana",
      seriesSlug: "detska-tour-petra-sagana",
      seriesWebsite: "https://detskatour.sk/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      confidence: 0.9,
    });
  }
  return events;
}
