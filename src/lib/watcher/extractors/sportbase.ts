import * as cheerio from "cheerio";
import type { Audience, Discipline, ParsedEvent } from "@/lib/domain";
import { geocodeFromGazetteer } from "@/lib/geocode";
import { inferDisciplines, isIngestibleDate } from "@/lib/taxonomy";

const SITE = "https://sport-base.eu";
const TRILOGY_WEB = "https://www.mtbtrilogy.com";
const PRIMA_CUP_WEB = "https://www.iprimacup.cz";
const JUNIOR_CUP_WEB = "https://www.juniorcup.net";

const SKIP =
  /over\s*all|\bbeh\b|\bběh\b|winter\s*run|canicross|triatlon|triathlon|p[uů]lmaraton|orienteer|\bkros\b|lyž|lyz|cani\b|\(kopie\)/i;
const CYCLING_SPORT =
  /^(mtb|cyklistika|gravel|silnice|cyklokros|bmx|enduro|cycling|bike)\b/i;
const CYCLING_NAME =
  /\bmtb\b|\benduro\b|cyklomaraton|cyklo[\s-]?maraton|\bkujebike\b|\bcyclo\b/i;
const KNOWN_CARD_SPORT =
  /^(mtb|cyklistika|gravel|silnice|cyklokros|bmx|enduro|cycling|bike|b[eě]h|ocr|canicross(\s*\/\s*ocrc)?|b[eě][zž]ky|ostatn[ií]|triatlon|triathlon)$/i;

interface RawSportBaseRace {
  slug: string;
  name: string;
  startDate: string;
  place: string;
  sport?: string | null;
  registrationUrl?: string;
  resultsUrl?: string;
}

function sbDate(raw: string): string | null {
  const m = raw.replace(/\s+/g, " ").trim().match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/);
  if (!m) return null;
  return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

function isValidIsoDate(iso: string): boolean {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function parseEndDate(name: string, startDate: string): string | undefined {
  // e.g. "29. 6. - 1. 7. 2027"
  const crossMonth = name.match(
    /(\d{1,2})\.\s*(\d{1,2})\.\s*[-–]\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/,
  );
  if (crossMonth) {
    const end = `${crossMonth[5]}-${crossMonth[4]!.padStart(2, "0")}-${crossMonth[3]!.padStart(2, "0")}`;
    if (isValidIsoDate(end) && end >= startDate && end !== startDate) return end;
  }
  // e.g. "3. - 5.7.2027" or "3.-5. 7. 2027"
  const sameMonth = name.match(/(\d{1,2})\.\s*[-–]\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/);
  if (sameMonth) {
    const end = `${sameMonth[4]}-${sameMonth[3]!.padStart(2, "0")}-${sameMonth[2]!.padStart(2, "0")}`;
    if (isValidIsoDate(end) && end >= startDate && end !== startDate) return end;
  }
  return undefined;
}

function isCycling(name: string, sport?: string | null): boolean {
  if (SKIP.test(name)) return false;
  const s = (sport ?? "").trim();
  if (s) return CYCLING_SPORT.test(s);
  return CYCLING_NAME.test(name);
}

function slugFromHref(href: string | undefined): string | null {
  const path = (href || "").split("?")[0] || "";
  const m = path.match(/\/competitions\/([^/]+)\/?$/i);
  if (!m) return null;
  const slug = m[1]!;
  if (/^(results|register|start-list)$/i.test(slug)) return null;
  return slug;
}

function abs(href: string | undefined): string | undefined {
  const raw = (href || "").trim();
  if (!raw || raw.startsWith("javascript:") || raw === "#") return undefined;
  try {
    return new URL(raw, SITE).toString();
  } catch {
    return undefined;
  }
}

function cleanPlace(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/teploice/gi, "Teplice")
    .replace(/\s*[-–]\s*Vinice$/i, "")
    .trim();
}

function discOf(name: string): Discipline[] {
  const t = name.toLowerCase();
  const seed: Discipline[] = /\benduro\b/.test(t)
    ? ["enduro"]
    : /cyklomaraton|maraton|xcm/.test(t)
      ? ["xcm"]
      : ["mtb"];
  const inferred = inferDisciplines(name, seed);
  return inferred.length ? inferred : seed;
}

function audienceOf(name: string): Audience {
  return /d[eě]tsk|kids/i.test(name) ? "kids" : "mixed";
}

function seriesOf(
  name: string,
  slug: string,
): { seriesName: string; seriesSlug: string; seriesWebsite: string; websiteUrl?: string } {
  if (/mtb\s*trilogy/i.test(name)) {
    return {
      seriesName: "Kupkolo.cz MTB Trilogy",
      seriesSlug: /\benduro\b/i.test(name) ? "mtb-trilogy-enduro" : "mtb-trilogy",
      seriesWebsite: TRILOGY_WEB,
      websiteUrl: TRILOGY_WEB,
    };
  }
  if (/prima\s*cup/i.test(name) || /^pc-/i.test(slug)) {
    return {
      seriesName: "Prima CUP",
      seriesSlug: "prima-cup",
      seriesWebsite: PRIMA_CUP_WEB,
      websiteUrl: PRIMA_CUP_WEB,
    };
  }
  if (/junior\s*cup/i.test(name)) {
    return {
      seriesName: "JUNIOR cup",
      seriesSlug: "junior-cup",
      seriesWebsite: JUNIOR_CUP_WEB,
      websiteUrl: JUNIOR_CUP_WEB,
    };
  }
  if (/decathlon\s*cyklomaraton/i.test(name)) {
    return {
      seriesName: /d[eě]tsk/i.test(name)
        ? "Decathlon Cyklomaraton — děti"
        : "Decathlon Cyklomaraton",
      seriesSlug: /d[eě]tsk/i.test(name) ? "decathlon-cyklomaraton-kids" : "decathlon-cyklomaraton",
      seriesWebsite: SITE,
    };
  }
  if (/kujebike/i.test(name)) {
    return {
      seriesName: "KUJEBIKE",
      seriesSlug: "kujebike",
      seriesWebsite: SITE,
    };
  }
  return {
    seriesName: name.slice(0, 80),
    seriesSlug: "sport-base",
    seriesWebsite: SITE,
  };
}

function extractBalancedJson(
  text: string,
  openIndex: number,
  openChar: "[" | "{",
  closeChar: "]" | "}",
): string | null {
  if (text[openIndex] !== openChar) return null;
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
    } else {
      if (ch === '"') inStr = true;
      else if (ch === openChar) depth++;
      else if (ch === closeChar) {
        depth--;
        if (depth === 0) return text.slice(openIndex, i + 1);
      }
    }
  }
  return null;
}

interface RscRaceItem {
  slug?: unknown;
  name?: unknown;
  day?: unknown;
  location?: unknown;
  sport?: unknown;
  canRegister?: unknown;
  hasPublicResults?: unknown;
  hasResults?: unknown;
}

function parseRscItem(item: RscRaceItem): RawSportBaseRace | null {
  const slug = typeof item.slug === "string" ? item.slug.trim() : "";
  const name = typeof item.name === "string" ? item.name.replace(/\s+/g, " ").trim() : "";
  const day = typeof item.day === "string" ? item.day.trim() : "";
  if (!slug || !name || !isValidIsoDate(day)) return null;
  const place = typeof item.location === "string" ? cleanPlace(item.location) : "";
  const sport = typeof item.sport === "string" ? item.sport.trim() : null;
  const hasResults = item.hasPublicResults === true || item.hasResults === true;
  return {
    slug,
    name,
    startDate: day,
    place,
    sport,
    registrationUrl: item.canRegister === true ? `${SITE}/competitions/${slug}/register` : undefined,
    resultsUrl: hasResults ? `${SITE}/competitions/${slug}/results` : undefined,
  };
}

function extractRscRaces(html: string): RawSportBaseRace[] {
  const pushRe = /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g;
  const chunks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pushRe.exec(html)) !== null) {
    try {
      chunks.push(JSON.parse(`"${m[1]}"`) as string);
    } catch {
      // ignore malformed chunk
    }
  }
  if (!chunks.length) return [];
  const joined = chunks.join("");
  const out: RawSportBaseRace[] = [];

  const arrayKeyRe = /"(?:races|competitions)"\s*:\s*\[/g;
  while ((m = arrayKeyRe.exec(joined)) !== null) {
    const arrStr = extractBalancedJson(joined, m.index + m[0].length - 1, "[", "]");
    if (!arrStr) continue;
    try {
      const parsed = JSON.parse(arrStr) as unknown;
      if (!Array.isArray(parsed)) continue;
      for (const entry of parsed) {
        if (!entry || typeof entry !== "object") continue;
        const raw = parseRscItem(entry as RscRaceItem);
        if (raw) out.push(raw);
      }
    } catch {
      // ignore non-JSON array
    }
  }

  if (out.length) return out;

  // Fallback: individual JSON objects with slug + day in RSC stream
  const objRe = /\{"id":"[^"]+","slug":"[^"]+","name":"(?:\\.|[^"\\])*","day":"\d{4}-\d{2}-\d{2}"/g;
  while ((m = objRe.exec(joined)) !== null) {
    const objStr = extractBalancedJson(joined, m.index, "{", "}");
    if (!objStr) continue;
    try {
      const parsed = JSON.parse(objStr) as RscRaceItem;
      const raw = parseRscItem(parsed);
      if (raw) out.push(raw);
    } catch {
      // ignore malformed object
    }
  }
  return out;
}

function extractCardRaces($: cheerio.CheerioAPI): RawSportBaseRace[] {
  const out: RawSportBaseRace[] = [];
  $("a[href*='/competitions/']").each((_, el) => {
    const $a = $(el);
    if ($a.closest("tr").length) return;
    const slug = slugFromHref($a.attr("href"));
    if (!slug) return;
    const name = $a.text().replace(/\s+/g, " ").trim();
    if (!name) return;

    const metaText = $a.parent().find("p").first().text().replace(/\s+/g, " ").trim();
    if (!metaText) return;
    const parts = metaText.split(",").map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return;
    const startDate = sbDate(parts[0]!);
    if (!startDate) return;

    let sport: string | null = null;
    let placeParts = parts.slice(1);
    if (placeParts.length >= 2 && KNOWN_CARD_SPORT.test(placeParts[placeParts.length - 1]!)) {
      sport = placeParts.pop()!;
    } else if (placeParts.length === 1 && KNOWN_CARD_SPORT.test(placeParts[0]!)) {
      sport = placeParts.pop()!;
    }
    const place = cleanPlace(placeParts.join(", "));

    const $card = $a.parent().parent();
    const hrefs = $card
      .find("a[href*='/competitions/']")
      .map((__, link) => $(link).attr("href") || "")
      .get();
    const registrationUrl = abs(
      hrefs.find((h) => new RegExp(`/competitions/${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/register/?$`, "i").test(h)),
    );
    const resultsUrl = abs(
      hrefs.find((h) => new RegExp(`/competitions/${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/results/?$`, "i").test(h)),
    );

    out.push({ slug, name, startDate, place, sport, registrationUrl, resultsUrl });
  });
  return out;
}

function extractTableRaces($: cheerio.CheerioAPI): RawSportBaseRace[] {
  const out: RawSportBaseRace[] = [];
  $("tr").each((_, tr) => {
    const $tr = $(tr);
    const $tds = $tr.find("td");
    if ($tds.length < 4) return;
    const name = ($tr.find("[title]").first().attr("title") || $tds.eq(2).text())
      .replace(/\s+/g, " ")
      .trim();
    if (!name) return;
    const startDate = sbDate($tds.eq(1).text());
    if (!startDate) return;
    const place = cleanPlace($tds.eq(3).text());
    if (!place) return;

    const hrefs = $tr
      .find("a[href*='/competitions/']")
      .map((__, a) => $(a).attr("href") || "")
      .get();
    const slug =
      hrefs.map((h) => slugFromHref(h)).find(Boolean) ||
      hrefs
        .map((h) => (h.match(/\/competitions\/([^/]+)/i) || [])[1])
        .find((s) => s && !/results|register|start-list/i.test(s));
    if (!slug) return;

    out.push({
      slug,
      name,
      startDate,
      place,
      sport: null,
      registrationUrl: abs(hrefs.find((h) => /\/register\/?$/i.test(h))),
      resultsUrl: abs(hrefs.find((h) => /\/results\/?$/i.test(h))),
    });
  });
  return out;
}

/**
 * sport:base listing — cycling rows only. The rest is running / OCR / canicross / skiing.
 * Supports Next.js App Router RSC payload, rendered competition cards, and legacy HTML tables.
 * Skip OVER ALL series standings; keep kids loops off the adult pin.
 */
export function parseSportBase(url: string, html: string): ParsedEvent[] {
  let rawRaces = extractRscRaces(html);
  if (!rawRaces.length) {
    const $ = cheerio.load(html);
    rawRaces = extractCardRaces($);
    if (!rawRaces.length) {
      rawRaces = extractTableRaces($);
    }
  }

  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  for (const raw of rawRaces) {
    if (!raw.name || !isCycling(raw.name, raw.sport)) continue;
    if (!raw.startDate || !isIngestibleDate(raw.startDate)) continue;
    if (!raw.place) continue;

    const externalId = `sportbase-${raw.slug}`;
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    const sourceUrl = `${SITE}/competitions/${raw.slug}`;
    const series = seriesOf(raw.name, raw.slug);
    const countryHint = "CZ";
    const geo = geocodeFromGazetteer(raw.place, countryHint);
    const endDate = parseEndDate(raw.name, raw.startDate);

    events.push({
      externalId,
      name: raw.name.slice(0, 160),
      startDate: raw.startDate,
      ...(endDate ? { endDate } : {}),
      placeText: raw.place.slice(0, 80),
      countryHint,
      discipline: discOf(raw.name),
      audience: audienceOf(raw.name),
      seriesName: series.seriesName,
      seriesSlug: series.seriesSlug,
      seriesWebsite: series.seriesWebsite,
      sourceUrl,
      websiteUrl: series.websiteUrl ?? sourceUrl,
      registrationUrl: raw.registrationUrl,
      resultsUrl: raw.resultsUrl,
      lat: geo?.lat,
      lng: geo?.lng,
      confidence: 0.86,
    });
  }

  return events;
}
