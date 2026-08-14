import * as cheerio from "cheerio";
import type { Audience, Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";

const IT_MON_ABBR: Record<string, string> = {
  gen: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  mag: "05",
  giu: "06",
  lug: "07",
  ago: "08",
  set: "09",
  ott: "10",
  nov: "11",
  dic: "12",
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

function dmy(day: string, month: string, year: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function cells($: cheerio.CheerioAPI, tr: cheerio.Element): string[] {
  return $(tr)
    .find("td")
    .toArray()
    .map((td) => $(td).text().replace(/\s+/g, " ").trim());
}

function stripItPlace(raw: string): string {
  let p = raw
    .replace(/\s*\(([^)]+)\)\s*$/, "")
    .replace(/\s+[A-Z]{2}\s*$/, "")
    .replace(/\s*-\s*OASI ZEGNA.*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/rivoli/i.test(p)) return "Rivoli Veronese";
  if (/pergine/i.test(p)) return "Pergine Valsugana";
  return p;
}

function yearFrom(html: string, fallback = "2026"): string {
  return html.match(/20\d{2}/)?.[0] || fallback;
}

export function parseItaliaBikeCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const sourceUrl = url.split("?")[0]!;
  const year = yearFrom(html);
  $("table tr").each((_, tr) => {
    const c = cells($, tr);
    if (c.length < 2) return;
    const dateRaw = c[0]!;
    const place = stripItPlace(c[1] || "");
    if (!place || place.length < 3) return;
    const klass = c.slice(2).join(" ");
    let startDate: string | null = null;
    let young = /naz\s*giov|esordienti|allievi/i.test(klass);
    const iso = dateRaw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?$/);
    if (iso) {
      startDate = dmy(iso[1]!, iso[2]!, iso[3] || year);
      young = false;
    } else {
      const named = dateRaw.match(/^(\d{1,2})-(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)$/i);
      if (!named) return;
      startDate = dmy(named[1]!, IT_MON_ABBR[named[2]!.toLowerCase()]!, year);
      young = true;
    }
    if (!startDate || !/c[123]|naz\s*giov/i.test(klass)) return;
    const label = young ? "Italia Bike Cup Young" : "Italia Bike Cup";
    const id = `ibc-${young ? "young-" : ""}${startDate}-${normalizeName(place)}`;
    if (seen.has(id)) return;
    seen.add(id);
    events.push({
      externalId: id,
      name: `${label} — ${place}`,
      startDate,
      placeText: place,
      countryHint: "IT",
      discipline: ["xco"],
      audience: (young ? "kids" : "mixed") as Audience,
      seriesName: young ? "Italia Bike Cup Young" : "Italia Bike Cup",
      seriesSlug: young ? "italia-bike-cup-young" : "italia-bike-cup",
      seriesWebsite: sourceUrl,
      sourceUrl,
      websiteUrl: sourceUrl,
      confidence: 0.9,
    });
  });
  return events;
}

export function parseCoppaItaliaGiovanile(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const sourceUrl = url.split("?")[0]!;
  $("table tr").each((_, tr) => {
    const c = cells($, tr);
    if (c.length < 5) return;
    const dateCell = c.find((x) => /^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(x));
    const placeCell = c.find((x, i) => i >= 3 && /[A-Za-zÀ-ÿ]{3,}/.test(x) && !/giov|coppa|asd|ssd|team|org/i.test(x));
    if (!dateCell) return;
    const dm = dateCell.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)!;
    const year = dm[3]!.length === 2 ? `20${dm[3]}` : dm[3]!;
    const startDate = dmy(dm[1]!, dm[2]!, year);
    const place = stripItPlace(placeCell || c[4] || "");
    if (!place || place.length < 3) return;
    if (!/coppa\s*italia|giov/i.test(c.join(" "))) return;
    const id = `cig-mtb-${startDate}-${normalizeName(place)}`;
    if (seen.has(id)) return;
    seen.add(id);
    events.push({
      externalId: id,
      name: `Coppa Italia Giovanile MTB — ${place}`,
      startDate,
      placeText: place,
      countryHint: "IT",
      discipline: ["xco"],
      audience: "kids",
      seriesName: "Coppa Italia Giovanile MTB",
      seriesSlug: "coppa-italia-giovanile-mtb",
      seriesWebsite: sourceUrl,
      sourceUrl,
      websiteUrl: sourceUrl,
      confidence: 0.88,
    });
  });
  return events;
}

function parseCaDate(raw: string): string | null {
  const m = raw.match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})/);
  if (!m) return null;
  return dmy(m[1]!, m[2]!, m[3]!);
}

function parseCiclismeTable(
  url: string,
  html: string,
  opts: {
    seriesName: string;
    seriesSlug: string;
    skip?: (row: string) => boolean;
    kids?: (row: string) => boolean;
    discipline?: Discipline[];
  },
): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const sourceUrl = url.split("?")[0]!;
  $("table tr").each((_, tr) => {
    const c = cells($, tr);
    if (c.length < 2) return;
    const blob = c.join(" ");
    if (opts.skip?.(blob)) return;
    const startDate = parseCaDate(c[0]!);
    const name = c[1] || "";
    if (!startDate || name.length < 6) return;
    let place = (c[2] || "").replace(/\s+/g, " ").trim();
    if (!place || place.length < 3) {
      const fromName = name.split(/\s[-–—]\s/).at(-1)?.trim();
      place = fromName && fromName.length >= 3 ? fromName : name;
    }
    if (/naturland/i.test(name) && place.length < 4) place = "La Massana";
    const kids = Boolean(opts.kids?.(blob));
    const id = `${opts.seriesSlug}-${startDate}-${normalizeName(place)}`;
    if (seen.has(id)) return;
    seen.add(id);
    events.push({
      externalId: id,
      name: name.slice(0, 120),
      startDate,
      placeText: place.replace(/\s+(Girona|Lleida|Barcelona|Tarragona)\s*$/i, "").trim() || place,
      countryHint: /naturland|massana/i.test(`${name} ${place}`) ? "AD" : "ES",
      discipline: opts.discipline ?? ["xco"],
      audience: (kids ? "kids" : "mixed") as Audience,
      seriesName: opts.seriesName,
      seriesSlug: opts.seriesSlug,
      seriesWebsite: sourceUrl,
      sourceUrl,
      websiteUrl: sourceUrl,
      confidence: 0.88,
    });
  });
  return events;
}

export function parseCopaCatalanaInternacional(url: string, html: string): ParsedEvent[] {
  return parseCiclismeTable(url, html, {
    seriesName: "Copa Catalana Internacional BTT",
    seriesSlug: "copa-catalana-internacional",
  });
}

export function parseCopaCatalunyaBtt(url: string, html: string): ParsedEvent[] {
  return parseCiclismeTable(url, html, {
    seriesName: "Copa Catalunya BTT",
    seriesSlug: "copa-catalunya-btt",
    skip: (row) => /anul|cancel/i.test(row),
    kids: (row) => /infantil|kids|promoci/i.test(row),
  });
}

function parseEsNamedDate(raw: string): string | null {
  const m = raw.match(
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i,
  );
  if (!m) return null;
  return dmy(m[1]!, ES_MON[m[2]!.toLowerCase()]!, "2026");
}

function splitEsRound(rest: string): { name: string; place: string } {
  const clean = rest
    .replace(/\s+Calendario\s+Copa[\s\S]*$/i, "")
    .replace(/\s+Env[ií]a[\s\S]*$/i, "")
    .replace(/\s*\([^)]+\)\s*$/, (m) => m) // keep last paren for split
    .trim();
  const paren = clean.match(/^(.*?)\s+[–-]\s+([^(]+?)\s*\(([^)]+)\)\s*$/);
  if (paren) return { name: paren[1]!.trim(), place: paren[2]!.trim() };
  const parts = clean.split(/\s+[–-]\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { name: parts.slice(0, -1).join(" – "), place: parts.at(-1)! };
  }
  return { name: clean, place: clean };
}

const COPA_ES_HEADINGS: {
  re: RegExp;
  seriesName: string;
  seriesSlug: string;
  disc: Discipline[];
}[] = [
  {
    re: /calendario nacional de marat[oó]n|copa de espa[nñ]a xcm 2026/i,
    seriesName: "Copa de España XCM",
    seriesSlug: "copa-espana-xcm",
    disc: ["xcm"],
  },
  {
    re: /copa de espa[nñ]a de enduro 2026/i,
    seriesName: "Copa de España Enduro",
    seriesSlug: "copa-espana-enduro",
    disc: ["enduro"],
  },
  {
    re: /copa de espa[nñ]a de descenso 2026/i,
    seriesName: "Copa de España Descenso",
    seriesSlug: "copa-espana-dh",
    disc: ["dh"],
  },
];

export function parseCopasEspana(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const sourceUrl = url.split("?")[0]!;
  const marks = COPA_ES_HEADINGS.map((h) => {
    const m = h.re.exec(text);
    return m && m.index != null ? { at: m.index, ...h } : null;
  }).filter((x): x is NonNullable<typeof x> => Boolean(x));
  marks.sort((a, b) => a.at - b.at);

  const roundRe =
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+[–-]\s+(.+?)(?=\s+\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b|\s+Calendario\s+Copa|\s+Env[ií]a\b|$)/gi;
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = roundRe.exec(text))) {
    const idx = m.index;
    if (idx < (marks[0]?.at ?? 0)) continue;
    const heading = [...marks].reverse().find((h) => h.at <= idx);
    if (!heading) continue;
    const startDate = parseEsNamedDate(m[0]!);
    const { name, place } = splitEsRound(m[3]!.trim());
    if (!startDate || place.length < 3) continue;
    if (/poga[cč]ar|lanzarote|sujetadores/i.test(name)) continue;
    const id = `${heading.seriesSlug}-${startDate}-${normalizeName(place)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    events.push({
      externalId: id,
      name: name.slice(0, 120) || `${heading.seriesName} — ${place}`,
      startDate,
      placeText: place,
      countryHint: "ES",
      discipline: heading.disc,
      audience: "mixed",
      seriesName: heading.seriesName,
      seriesSlug: heading.seriesSlug,
      seriesWebsite: sourceUrl,
      sourceUrl,
      websiteUrl: sourceUrl,
      confidence: 0.86,
    });
  }
  return events;
}
