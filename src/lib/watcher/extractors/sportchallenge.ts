import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { geocodeFromGazetteer } from "@/lib/geocode";
import { inferDisciplines, isIngestibleDate } from "@/lib/taxonomy";

const NON_CYCLING_CLASSES = new Set([
  "beh",
  "run",
  "stafeta_beh",
  "ski",
  "pochod",
  "nw",
  "ocr",
  "ob",
  "kolobky",
  "inline",
  "triatlon",
  "3atlon",
  "camp",
  "serie",
]);

const CYCLING_CLASSES = new Set([
  "mtb",
  "k70",
  "road",
  "cx",
  "enduro",
  "xco",
  "xc",
  "xc_uci",
  "bch",
  "trophy",
  "casovka",
  "gravel",
  "cyklo",
  "bike",
  "bmx",
  "dh",
  "downhill",
  "mtbo",
]);

const AMBIGUOUS_MODIFIER_CLASSES = new Set(["deti", "stage", "uci"]);

const CYCLING_NAME_CUE =
  /\b(?:cykl\w*|mtb|xco|xcc|xce|xcm|mtbo|gravel|cyklokros|cyclocross|enduro|downhill|pumptrack|bmx|bikemaraton|bike\s*maraton|bike\b|horsk\w*\s+kol\w*|silnic\w*|casovk\w*|kriterium)\b/;

const NON_CYCLING_NAME =
  /\b(?:beh\w*|bezeck\w*|pulmaraton|half[\s-]?marathon|run\b|running|trailrun|triatlon\w*|triathlon\w*|duatlon\w*|duathlon\w*|kvadriatlon\w*|aquatlon\w*|skialp\w*|lyz\w*|bezky|canicross\w*|kolobeh\w*|kolobezk\w*|inline|nordic\s+walking|pochod\w*|orientacni\s+beh|ocr\b|kros\b)\b/;

const DUMMY_OR_SERIES_NAME =
  /(?:^rezervace\b|^__?test\b|testov[aá]n[ií]|\bseri[aá]l\s+z[aá]vod[uů]\b)/i;

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function validIsoDate(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dt = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(dt.getTime()) && dt.toISOString().slice(0, 10) === iso ? iso : null;
}

function parseDateRange(raw: string): { start: string; end?: string } | null {
  const clean = raw.replace(/\s+/g, " ").trim();
  const range = clean.match(
    /(\d{1,2})\.(\d{1,2})\.(20\d{2})\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(20\d{2})/,
  );
  if (range) {
    const start = validIsoDate(Number(range[3]), Number(range[2]), Number(range[1]));
    const end = validIsoDate(Number(range[6]), Number(range[5]), Number(range[4]));
    if (!start) return null;
    return {
      start,
      ...(end && end > start ? { end } : {}),
    };
  }
  const single = clean.match(/(\d{1,2})\.(\d{1,2})\.(20\d{2})/);
  if (!single) return null;
  const start = validIsoDate(Number(single[3]), Number(single[2]), Number(single[1]));
  return start ? { start } : null;
}

function parseRegistrationCloseDate(raw: string): string | undefined {
  const m = raw.replace(/\s+/g, " ").trim().match(/(\d{1,2})\.(\d{1,2})\.(20\d{2})/);
  if (!m) return undefined;
  return validIsoDate(Number(m[3]), Number(m[2]), Number(m[1])) ?? undefined;
}

function daysBetween(startIso: string, endIso: string): number {
  const a = Date.parse(`${startIso}T00:00:00Z`);
  const b = Date.parse(`${endIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

function isCyclingEntry(classTokens: string[], name: string): boolean {
  if (!name || name.length < 3 || DUMMY_OR_SERIES_NAME.test(name)) return false;
  if (classTokens.some((c) => NON_CYCLING_CLASSES.has(c))) return false;

  const foldedName = fold(name);
  if (NON_CYCLING_NAME.test(foldedName)) return false;

  if (classTokens.some((c) => CYCLING_CLASSES.has(c))) return true;
  if (
    classTokens.some((c) => AMBIGUOUS_MODIFIER_CLASSES.has(c)) &&
    CYCLING_NAME_CUE.test(foldedName)
  ) {
    return true;
  }
  return false;
}

function inferSportchallengeDisciplines(classTokens: string[], name: string): Discipline[] {
  const foldedName = fold(name);
  const seed: Discipline[] = [];
  if (classTokens.includes("cx")) seed.push("cx");
  else if (classTokens.includes("enduro")) seed.push("enduro");
  else if (classTokens.includes("road")) seed.push("road");
  else if (classTokens.includes("casovka")) seed.push("tt");
  else if (classTokens.includes("gravel")) seed.push("gravel");
  else if (classTokens.includes("xco")) seed.push("xco");
  else if (classTokens.includes("k70")) seed.push("xcm");
  else if (
    classTokens.some((c) => c === "mtb" || c === "xc" || c === "xc_uci" || c === "bch") ||
    (classTokens.includes("trophy") && !/\broad\b|silnic/.test(foldedName))
  ) {
    seed.push("mtb");
  }

  const inferred = inferDisciplines(`${name} ${classTokens.join(" ")}`, seed);
  return inferred.length ? inferred : seed.length ? seed : ["mtb"];
}

function cleanPlaceAndCountry(rawPlace: string): { placeText: string; countryHint: string } {
  const trimmed = rawPlace.replace(/\s+/g, " ").trim();
  let countryHint = "CZ";
  if (/\[(PL|POL)\]/i.test(trimmed) || /\bpolsk[oa]\b/i.test(trimmed)) {
    countryHint = "PL";
  } else if (/\[(SK|SVK)\]/i.test(trimmed) || /\bslovensk[oa]\b/i.test(trimmed)) {
    countryHint = "SK";
  }
  const placeText = trimmed
    .replace(/\s*\[(?:CZE|CZ|POL|PL|SVK|SK)\]\s*$/i, "")
    .trim();
  return { placeText, countryHint };
}

function externalIdFromUrl(absUrl: string, name: string, startDate: string): string {
  try {
    const path = new URL(absUrl).pathname
      .replace(/^\/(?:cz|en)\//i, "")
      .replace(/^\/+|\/+$/g, "");
    if (path) return `sportchallenge:${path.toLowerCase()}`;
  } catch {
    /* fallback below */
  }
  return `sportchallenge:${normalizeName(name)}-${startDate}`;
}

export function isSportchallengeListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!u.hostname.replace(/^www\./, "").endsWith("sportchallenge.cz")) return false;
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return path === "/" || /^\/(cz|en)$/i.test(path);
  } catch {
    return false;
  }
}

/**
 * sportchallenge.cz homepage (`#bude`) — Czech timing & registration portal.
 * Extracts upcoming cycling events only, skipping running, skiing, hiking,
 * nordic walking, OCR, triathlon, kickbike, inline, and season-long series.
 */
export function parseSportchallenge(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $("#bude ul.seznamZavodu > li").each((_, el) => {
    const $li = $(el);
    if ($li.hasClass("r")) return;

    const classTokens = ($li.attr("class") || "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    const $link = $li.find("a[href]").first();
    const href = ($link.attr("href") || "").trim();
    const name = $link.text().replace(/\s+/g, " ").trim();
    if (!href || !isCyclingEntry(classTokens, name)) return;

    const datumRaw = $li.find(".datum").first().text().replace(/\s+/g, " ").trim();
    const dates = parseDateRange(datumRaw);
    if (!dates || !isIngestibleDate(dates.start)) return;
    if (dates.end && daysBetween(dates.start, dates.end) > 21) return;

    let absUrl: string;
    try {
      const parsed = new URL(href, url);
      parsed.hash = "";
      parsed.search = "";
      absUrl = parsed.toString();
    } catch {
      return;
    }

    const externalId = externalIdFromUrl(absUrl, name, dates.start);
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const rawPlace = $li.find(".misto").first().text();
    const { placeText, countryHint: rawCountry } = cleanPlaceAndCountry(rawPlace);
    const geo = placeText ? geocodeFromGazetteer(placeText, rawCountry) : null;
    const countryHint = geo?.countryCode || rawCountry;

    const registrEndRaw = $li.find(".registrEnd").first().text();
    const registrationClosesAt = registrEndRaw
      ? parseRegistrationCloseDate(registrEndRaw)
      : undefined;

    const cancelled =
      classTokens.includes("zruseno") || /\(\s*zru[sš]eno\s*\)/i.test(name);

    events.push({
      externalId,
      name,
      startDate: dates.start,
      ...(dates.end ? { endDate: dates.end } : {}),
      placeText: placeText || name,
      countryHint,
      lat: geo?.lat,
      lng: geo?.lng,
      discipline: inferSportchallengeDisciplines(classTokens, name),
      audience:
        classTokens.includes("deti") ||
        /d[eě]tsk|kids|ml[aá]de[zž]|z[sš]\s*a\s*s[sš]/i.test(name)
          ? "kids"
          : "mixed",
      sourceUrl: absUrl,
      ...(registrationClosesAt
        ? { registrationUrl: absUrl, registrationClosesAt }
        : {}),
      ...(cancelled ? { status: "cancelled" as const } : {}),
      confidence: 0.86,
      evidence: {
        sourceUrl: url,
        quote: `${datumRaw} | ${name}${placeText ? ` | ${placeText}` : ""}`.slice(0, 300),
        method: "sportchallenge_list",
        version: "sportchallenge-v1",
      },
    });
  });

  return events;
}
