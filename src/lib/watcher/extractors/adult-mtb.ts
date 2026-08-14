import * as cheerio from "cheerio";
import type { ParsedEvent } from "@/lib/domain";
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

const CZ_MON: Record<string, string> = {
  ledna: "01",
  unora: "02",
  února: "02",
  brezna: "03",
  března: "03",
  dubna: "04",
  kvetna: "05",
  května: "05",
  cervna: "06",
  června: "06",
  cervence: "07",
  července: "07",
  srpna: "08",
  zari: "09",
  září: "09",
  rijna: "10",
  října: "10",
  listopadu: "11",
  prosince: "12",
};

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function bodyText(html: string): string {
  const $ = cheerio.load(html);
  const meta =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";
  return `${$("title").text()} ${meta} ${$("body").text()}`
    .replace(/\s+/g, " ")
    .trim();
}

function push(events: ParsedEvent[], seen: Set<string>, ev: ParsedEvent): void {
  if (seen.has(ev.externalId)) return;
  seen.add(ev.externalId);
  if (ev.endDate && ev.endDate === ev.startDate) delete ev.endDate;
  events.push(ev);
}

function dmy(day: string, month: string, year: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function namedMonth(raw: string, table: Record<string, string>): string | null {
  return table[raw.toLowerCase()] || table[fold(raw)] || null;
}

function single(
  ev: Omit<ParsedEvent, "confidence"> & { confidence?: number },
): ParsedEvent[] {
  return [{ confidence: 0.88, ...ev }];
}

/** MarathonMan Europe — skip Franken (CUBE Cup) and Salzkammergut (own parser). */
export function parseMarathonMan(url: string, html: string): ParsedEvent[] {
  const text = bodyText(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const re =
    /(\d{2})\.(\d{2})\.(20\d{2})\s*[-–]\s*(Author\s+Král\s+Šumavy|Malevil\s+Cup|Erzgebirgs\s+Bike\s+Marathon)/gi;
  const places: Record<string, { place: string; cc: string; site: string }> = {
    "author kral sumavy": {
      place: "Klatovy",
      cc: "CZ",
      site: "https://www.authorkralsumavy.cz/",
    },
    "malevil cup": {
      place: "Jablonné v Podještědí",
      cc: "CZ",
      site: "https://www.malevilcup.cz/",
    },
    "erzgebirgs bike marathon": {
      place: "Seiffen",
      cc: "DE",
      site: "https://www.ebm-united.de/",
    },
  };
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const startDate = dmy(m[1]!, m[2]!, m[3]!);
    const name = m[4]!.replace(/\s+/g, " ").trim();
    const meta = places[fold(name)];
    if (!meta) continue;
    push(events, seen, {
      externalId: `marathon-man-${startDate}-${normalizeName(name)}`,
      name,
      startDate,
      placeText: meta.place,
      countryHint: meta.cc,
      discipline: ["xcm"],
      audience: "mixed",
      seriesName: "MarathonMan Europe",
      seriesSlug: "marathon-man",
      seriesWebsite: "https://www.marathon-man.eu/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: meta.site,
      confidence: 0.9,
    });
  }
  return events;
}

export function parseKralSumavy(url: string, html: string): ParsedEvent[] {
  const text = `${bodyText(html)} ${html.replace(/<[^>]+>/g, " ")}`;
  if (!/kr[aá]l\s+[sš]umavy/i.test(text)) return [];
  const m = text.match(
    /KR[ÁA]L\s+[ŠS]UMAVY\s+MTB[^\d]{0,40}(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/i,
  );
  if (!m) return [];
  const startDate = dmy(m[1]!, m[2]!, m[3]!);
  return single({
    externalId: `kral-sumavy-${startDate}`,
    name: "AUTHOR Král Šumavy",
    startDate,
    placeText: "Klatovy",
    countryHint: "CZ",
    discipline: ["xcm"],
    audience: "mixed",
    seriesName: "AUTHOR Král Šumavy",
    seriesSlug: "kral-sumavy",
    seriesWebsite: "https://www.authorkralsumavy.cz/",
    sourceUrl: url.split("?")[0]!,
    websiteUrl: "https://www.authorkralsumavy.cz/",
  });
}

export function parseMalevilCup(url: string, html: string): ParsedEvent[] {
  const text = bodyText(html);
  const m = text.match(/Sobota\s+(\d{1,2})\.\s*([a-zá-ž]+)\s+(20\d{2})/i);
  if (!m) return [];
  const mo = namedMonth(m[2]!, CZ_MON);
  if (!mo) return [];
  const startDate = dmy(m[1]!, mo, m[3]!);
  return single({
    externalId: `malevil-${startDate}`,
    name: "Malevil Cup",
    startDate,
    placeText: "Jablonné v Podještědí",
    countryHint: "CZ",
    discipline: ["xcm"],
    audience: "mixed",
    seriesName: "Malevil Cup",
    seriesSlug: "malevil-cup",
    seriesWebsite: "https://www.malevilcup.cz/",
    sourceUrl: url.split("?")[0]!,
    websiteUrl: "https://www.malevilcup.cz/",
  });
}

export function parseHoral(url: string, html: string): ParsedEvent[] {
  const text = bodyText(html);
  const m = text.match(/(\d{1,2})\.\s*august[a]?\s+(20\d{2})/i);
  if (!m) return [];
  const startDate = dmy(m[1]!, "08", m[2]!);
  return single({
    externalId: `horal-${startDate}`,
    name: "ŠKODA Horal MTB maratón",
    startDate,
    placeText: "Svit",
    countryHint: "SK",
    discipline: ["xcm"],
    audience: "mixed",
    seriesName: "ŠKODA Horal MTB Marathon",
    seriesSlug: "horal-mtb",
    seriesWebsite: "https://www.horal.sk/",
    sourceUrl: url.split("?")[0]!,
    websiteUrl: "https://www.horal.sk/",
  });
}

export function parseNationalparkBike(url: string, html: string): ParsedEvent[] {
  const text = bodyText(html);
  const m = text.match(/(\d{1,2})\.\s*und\s+(\d{1,2})\.\s*August\s+(20\d{2})/i);
  if (!m) return [];
  const startDate = dmy(m[1]!, "08", m[3]!);
  const endDate = dmy(m[2]!, "08", m[3]!);
  return single({
    externalId: `np-bike-marathon-${startDate}`,
    name: "Nationalpark Bike-Marathon",
    startDate,
    endDate,
    placeText: "Scuol",
    countryHint: "CH",
    discipline: ["xcm"],
    audience: "mixed",
    seriesName: "Nationalpark Bike-Marathon",
    seriesSlug: "nationalpark-bike-marathon",
    seriesWebsite: "https://www.bike-marathon.com/",
    sourceUrl: url.split("?")[0]!,
    websiteUrl: "https://www.bike-marathon.com/",
  });
}

export function parseGrandRaid(url: string, html: string): ParsedEvent[] {
  const text = bodyText(html);
  const m =
    text.match(/Rendez-vous le (\d{1,2})\s+août\s+(20\d{2})/i) ||
    text.match(/samedi\s+(\d{1,2})\s+août\s+(20\d{2})/i);
  if (!m) return [];
  const startDate = dmy(m[1]!, "08", m[2]!);
  return single({
    externalId: `grand-raid-${startDate}`,
    name: "Grand Raid BCVS",
    startDate,
    placeText: "Grimentz",
    countryHint: "CH",
    discipline: ["xcm"],
    audience: "mixed",
    seriesName: "Grand Raid BCVS",
    seriesSlug: "grand-raid-bcvs",
    seriesWebsite: "https://grand-raid-bcvs.ch/",
    sourceUrl: url.split("?")[0]!,
    websiteUrl: "https://grand-raid-bcvs.ch/",
  });
}

/** Adult marathon — distinct from Kids Bike Cup Valais round. */
export function parseRaidEvolenard(url: string, html: string): ParsedEvent[] {
  const text = bodyText(html);
  const m = text.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s+juin\s+(20\d{2})/i);
  if (!m) return [];
  const startDate = dmy(m[1]!, "06", m[3]!);
  const endDate = dmy(m[2]!, "06", m[3]!);
  return single({
    externalId: `raid-evolenard-${startDate}`,
    name: "Raid Evolénard FMV",
    startDate,
    endDate,
    placeText: "Evolène",
    countryHint: "CH",
    discipline: ["xcm"],
    audience: "mixed",
    seriesName: "Raid Evolénard FMV",
    seriesSlug: "raid-evolenard-fmv",
    seriesWebsite: "https://raidevolenard-fmv.ch/",
    sourceUrl: url.split("?")[0]!,
    websiteUrl: "https://raidevolenard-fmv.ch/",
  });
}

export function parseEigerAdult(url: string, html: string): ParsedEvent[] {
  const text = bodyText(html);
  const m =
    text.match(/(\d{1,2})\.\s*\+\s*(\d{1,2})\.\s*August\s+(20\d{2})/i) ||
    text.match(/Saturday,\s+(\d{1,2})\.\s*August\s+(20\d{2})/i);
  if (!m) return [];
  const year = m[3] ?? m[2]!;
  const startDay = m[1]!;
  const endDay = m[3] ? m[2]! : m[1]!;
  const startDate = dmy(startDay, "08", year);
  const endDate = dmy(endDay, "08", year);
  return single({
    externalId: `eiger-adult-${startDate}`,
    name: "Eiger Bike Challenge",
    startDate,
    endDate,
    placeText: "Grindelwald",
    countryHint: "CH",
    discipline: ["xcm"],
    audience: "mixed",
    seriesName: "Eiger Bike Challenge",
    seriesSlug: "eiger-bike-challenge",
    seriesWebsite: "https://www.eigerbike.ch/",
    sourceUrl: url.split("?")[0]!,
    websiteUrl: "https://www.eigerbike.ch/en/race/informations/",
  });
}

export function parseMtbPomerania(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  $("a").each((_, a) => {
    const label = $(a).text().replace(/\s+/g, " ").trim();
    const m = label.match(
      /EDYCJA\s+\d+\s*[-–]\s*(.+?)\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(20\d{2})/i,
    );
    if (!m) return;
    const place = m[1]!.replace(/^GM\.\s*/i, "").replace(/\s+/g, " ").trim();
    if (!place || place.length < 3) return;
    const startDate = dmy(m[2]!, m[3]!, m[4]!);
    const href = $(a).attr("href");
    let websiteUrl = url.split("?")[0]!;
    if (href) {
      try {
        websiteUrl = new URL(href, url).toString().split("?")[0]!;
      } catch {
        /* keep */
      }
    }
    push(events, seen, {
      externalId: `pomerania-${startDate}-${normalizeName(place)}`,
      name: `MTB Pomerania — ${place}`,
      startDate,
      placeText: place.replace(/\s*[-–].*$/, "").trim(),
      countryHint: "PL",
      discipline: ["xcm"],
      audience: "mixed",
      seriesName: "MTB Pomerania Maraton",
      seriesSlug: "mtb-pomerania",
      seriesWebsite: "https://mtbpomerania.pl/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl,
      confidence: 0.9,
    });
  });
  return events;
}

export function parseSilesiaBike(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  $("a[href*='kalendarz-2026']").each((_, a) => {
    const href = $(a).attr("href") || "";
    if (/road-race/i.test(href)) return;
    const label = $(a).text().replace(/\s+/g, " ").trim();
    const m =
      label.match(/([A-Za-zÁČĘŁŃÓŚŹŻáčęłńóśźż. -]{3,28})\s+(\d{1,2})\s*\/\s*(\d{2})\s*\/?\s*(20\d{2})/) ||
      href.match(/mtb-([a-z-]+)-20\d{2}/i);
    const date = label.match(/(\d{1,2})\s*\/\s*(\d{2})\s*\/?\s*(20\d{2})/);
    if (!date) return;
    const rawPlace = m && m[1] && !/^\d/.test(m[1]) ? m[1] : label.split(/\d/)[0]!;
    const place = silesiaPlace(rawPlace);
    if (!place) return;
    const startDate = dmy(date[1]!, date[2]!, date[3]!);
    let websiteUrl = url.split("?")[0]!;
    try {
      websiteUrl = new URL(href, url).toString().split("?")[0]!;
    } catch {
      /* keep */
    }
    push(events, seen, {
      externalId: `silesia-bike-${startDate}-${normalizeName(place)}`,
      name: `Silesia Bike — ${place}`,
      startDate,
      placeText: place,
      countryHint: "PL",
      discipline: ["xcm"],
      audience: "mixed",
      seriesName: "Silesia Bike",
      seriesSlug: "silesia-bike",
      seriesWebsite: "https://silesia.bike/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl,
      confidence: 0.86,
    });
  });
  return events;
}

function silesiaPlace(raw: string): string | null {
  const t = raw.replace(/\s+/g, " ").trim();
  if (/^psary$/i.test(t)) return "Psary";
  if (/g[oó]rnicza|d\.\s*g/i.test(t)) return "Dąbrowa Górnicza";
  if (/czerwionka/i.test(t)) return "Czerwionka-Leszczyny";
  return null;
}

export function parseHeroDolomites(url: string, html: string): ParsedEvent[] {
  const text = bodyText(html);
  const m = text.match(/HERO\s+Südtirol\s+Dolomites\s+(\d{1,2})\.(\d{1,2})\.(20\d{2})/i);
  if (!m) return [];
  const startDate = dmy(m[1]!, m[2]!, m[3]!);
  return single({
    externalId: `hero-dolomites-${startDate}`,
    name: "HERO Südtirol Dolomites",
    startDate,
    placeText: "Selva di Val Gardena",
    countryHint: "IT",
    discipline: ["xcm"],
    audience: "mixed",
    seriesName: "HERO Südtirol Dolomites",
    seriesSlug: "hero-sudtirol-dolomites",
    seriesWebsite: "https://www.herodolomites.com/",
    sourceUrl: url.split("?")[0]!,
    websiteUrl: "https://www.herodolomites.com/",
    confidence: 0.92,
  });
}

export function parseTroiTrek(url: string, html: string): ParsedEvent[] {
  const text = bodyText(html);
  const m = text.match(/Polcenigo il (\d{1,2})\s+luglio\s+(20\d{2})/i);
  if (!m) return [];
  const startDate = dmy(m[1]!, "07", m[2]!);
  return single({
    externalId: `troi-trek-${startDate}`,
    name: "Troi Trek",
    startDate,
    placeText: "Polcenigo",
    countryHint: "IT",
    discipline: ["xcm"],
    audience: "mixed",
    seriesName: "Troi Trek",
    seriesSlug: "troi-trek",
    seriesWebsite: "https://www.troitrek.it/",
    sourceUrl: url.split("?")[0]!,
    websiteUrl: "https://www.troitrek.it/",
  });
}

export function parseSloEnduro(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const year = Number(url.match(/20\d{2}/)?.[0] ?? 2026);
  $("tr").each((_, tr) => {
    const $tr = $(tr);
    if ($tr.find("del").length) return;
    const t = $tr.text().replace(/\s+/g, " ").trim();
    if (/non-competitive/i.test(t)) return;
    const dm = t.match(
      /(\d{1,2})\/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)/i,
    );
    if (!dm) return;
    const mo = namedMonth(dm[3]!, EN_MON);
    if (!mo) return;
    const name = ($tr.find("h4").first().text() || $tr.find("a").first().text())
      .replace(/^\|\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!/sloenduro/i.test(name)) return;
    const venue = t.match(/([A-Za-zčšžáíéČŠŽÁÍÉ ]{3,40})\s*\((SLO|CRO)\)/i);
    const place = (venue?.[1] || name.replace(/^SloEnduro\s+/i, "")).replace(/\s+/g, " ").trim();
    const cc = venue?.[2]?.toUpperCase() === "CRO" ? "HR" : "SI";
    const startDate = dmy(dm[1]!, mo, String(year));
    const endDate = dmy(dm[2]!, mo, String(year));
    let websiteUrl = url.split("?")[0]!;
    const href = $tr.find("a").first().attr("href");
    if (href) {
      try {
        websiteUrl = new URL(href, url).toString().split("?")[0]!;
      } catch {
        /* keep */
      }
    }
    push(events, seen, {
      externalId: `sloenduro-${startDate}-${normalizeName(place)}`,
      name,
      startDate,
      endDate,
      placeText: place,
      countryHint: cc,
      discipline: ["enduro"],
      audience: "mixed",
      seriesName: "SloEnduro",
      seriesSlug: "sloenduro",
      seriesWebsite: "https://www.sloenduro.com/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl,
      confidence: 0.88,
    });
  });
  return events;
}

export function parseMbRace(url: string, html: string): ParsedEvent[] {
  const text = bodyText(html);
  const m = text.match(/(\d{1,2})\s+au\s+(\d{1,2})\s+Juillet\s+(20\d{2})/i);
  if (!m) return [];
  const startDate = dmy(m[1]!, "07", m[3]!);
  const endDate = dmy(m[2]!, "07", m[3]!);
  return single({
    externalId: `mb-race-${startDate}`,
    name: "MB Race",
    startDate,
    endDate,
    placeText: "Megève",
    countryHint: "FR",
    discipline: ["enduro"],
    audience: "mixed",
    seriesName: "MB Race",
    seriesSlug: "mb-race",
    seriesWebsite: "https://www.mb-race.com/",
    sourceUrl: url.split("?")[0]!,
    websiteUrl: "https://www.mb-race.com/",
  });
}

export function parseTransmaurienne(url: string, html: string): ParsedEvent[] {
  const text = bodyText(html);
  const m = text.match(/(\d{1,2})\s*►\s*(\d{1,2})\s+juillet\s+(20\d{2})/i);
  if (!m) return [];
  const startDate = dmy(m[1]!, "07", m[3]!);
  const endDate = dmy(m[2]!, "07", m[3]!);
  return single({
    externalId: `transmaurienne-${startDate}`,
    name: "Transmaurienne Vanoise",
    startDate,
    endDate,
    placeText: "Saint-Jean-de-Maurienne",
    countryHint: "FR",
    discipline: ["enduro"],
    audience: "mixed",
    seriesName: "Transmaurienne Vanoise",
    seriesSlug: "transmaurienne-vanoise",
    seriesWebsite: "https://transmaurienne-vanoise.com/",
    sourceUrl: url.split("?")[0]!,
    websiteUrl: "https://transmaurienne-vanoise.com/",
  });
}

export function parseRocAzur(url: string, html: string): ParsedEvent[] {
  const text = bodyText(html);
  const m = text.match(/(\d{1,2})\s+au\s+(\d{1,2})\s+octobre\s+(20\d{2})/i);
  if (!m) return [];
  const startDate = dmy(m[1]!, "10", m[3]!);
  const endDate = dmy(m[2]!, "10", m[3]!);
  return single({
    externalId: `roc-azur-${startDate}`,
    name: "Roc d'Azur",
    startDate,
    endDate,
    placeText: "Fréjus",
    countryHint: "FR",
    discipline: ["xcm"],
    audience: "mixed",
    seriesName: "Roc d'Azur",
    seriesSlug: "roc-dazur",
    seriesWebsite: "https://www.rocazur.com/",
    sourceUrl: url.split("?")[0]!,
    websiteUrl: "https://www.rocazur.com/",
  });
}

export function parseRyeBikeFestival(url: string, html: string): ParsedEvent[] {
  const text = bodyText(html);
  const m = text.match(/(\d{1,2})\.\s*-\s*(\d{1,2})\.\s*mai\s+(20\d{2})/i);
  if (!m) return [];
  const startDate = dmy(m[1]!, "05", m[3]!);
  const endDate = dmy(m[2]!, "05", m[3]!);
  return single({
    externalId: `rye-bike-${startDate}`,
    name: "Rye Bike Festival",
    startDate,
    endDate,
    placeText: "Oslo",
    countryHint: "NO",
    discipline: ["xco"],
    audience: "mixed",
    seriesName: "Rye Bike Festival",
    seriesSlug: "rye-bike-festival",
    seriesWebsite: "https://ryebikefestival.no/",
    sourceUrl: url.split("?")[0]!,
    websiteUrl: "https://ryebikefestival.no/",
  });
}

export function parseCrosskovacsi(url: string, html: string): ParsedEvent[] {
  const text = bodyText(html);
  const iso = text.match(/RAJT\s*:\s*(20\d{2})-(\d{2})-(\d{2})/i);
  const hu = text.match(/(20\d{2})\s+j[uú]nius\s+(\d{1,2})/i);
  let startDate = "";
  if (iso) startDate = `${iso[1]}-${iso[2]}-${iso[3]}`;
  else if (hu) startDate = dmy(hu[2]!, "06", hu[1]!);
  if (!startDate) return [];
  return single({
    externalId: `crosskovacsi-${startDate}`,
    name: "Crosskovácsi XCM",
    startDate,
    placeText: "Budapest",
    countryHint: "HU",
    discipline: ["xcm"],
    audience: "mixed",
    seriesName: "Crosskovácsi",
    seriesSlug: "crosskovacsi",
    seriesWebsite: "https://crosskovacsi.hu/",
    sourceUrl: url.split("?")[0]!,
    websiteUrl: "https://www.crosskovacsi.hu/",
  });
}

export function parseAlpentour(url: string, html: string): ParsedEvent[] {
  const text = bodyText(html);
  const m = text.match(/(\d{1,2})\.\s*-\s*(\d{1,2})\.\s*June\s+(20\d{2})/i);
  if (!m) return [];
  const startDate = dmy(m[1]!, "06", m[3]!);
  const endDate = dmy(m[2]!, "06", m[3]!);
  return single({
    externalId: `alpentour-${startDate}`,
    name: "Alpentour Trophy",
    startDate,
    endDate,
    placeText: "Ramsau am Dachstein",
    countryHint: "AT",
    discipline: ["xcm"],
    audience: "mixed",
    seriesName: "Alpentour Trophy",
    seriesSlug: "alpentour-trophy",
    seriesWebsite: "https://www.alpen-tour.at/",
    sourceUrl: url.split("?")[0]!,
    websiteUrl: "https://www.alpen-tour.at/",
  });
}

export function parseRiojaBike(url: string, html: string): ParsedEvent[] {
  const text = bodyText(html);
  const m = text.match(/(\d{1,2})\s+MAY\s+(20\d{2})/i);
  if (!m) return [];
  const startDate = dmy(m[1]!, "05", m[2]!);
  return single({
    externalId: `rioja-bike-${startDate}`,
    name: "La Rioja Bike Race",
    startDate,
    placeText: "Logroño",
    countryHint: "ES",
    discipline: ["xcm"],
    audience: "mixed",
    seriesName: "La Rioja Bike Race",
    seriesSlug: "la-rioja-bike-race",
    seriesWebsite: "https://riojabikeexperience.com/",
    sourceUrl: url.split("?")[0]!,
    websiteUrl: "https://riojabikeexperience.com/",
  });
}
