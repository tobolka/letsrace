import { load } from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";

// ── Shared Italian helpers ──────────────────────────────────────────────────

const IT_MONTHS: Record<string, string> = {
  gennaio: "01", gen: "01",
  febbraio: "02", feb: "02",
  marzo: "03", mar: "03",
  aprile: "04", apr: "04",
  maggio: "05", mag: "05",
  giugno: "06", giu: "06",
  luglio: "07", lug: "07",
  agosto: "08", ago: "08",
  settembre: "09", set: "09",
  ottobre: "10", ott: "10",
  novembre: "11", nov: "11",
  dicembre: "12", dic: "12",
};

const NOT_CYCLING = /\b(?:podism\w*|corsa|run\b|running|trail(?:\s+run\w*)?|mezza\s+maratona|half[- ]?marathon|maratona\s+di|triathlon|duathlon|aquathlon|swim\w*|nuoto|sci\b|ski\w*|skyrun\w*|camminata|nordic\s+walking|hybrid\s+race|atletica|altro)\b/i;
const CYCLING_HINT = /\b(?:ciclism\w*|ciclocross|cyclo[- ]?cross|mtb|mountain\s*bike|gran\s*fondo|gravel|xco|xcc|xce|xcm|xcp|cx|enduro|downhill|dh|bmx|strada|crono|criterium|bike|pedalata|strade\s+bianche|point\s+to\s+point|cross\s*country|marathon)\b/i;

const FOREIGN_COUNTRY_SUFFIX = /(?:[-–,]\s*)(?:cechia|repubblica\s+ceca|belgio|francia|spagna|regno\s+unito|paesi\s+bassi|olanda|svizzera|austria|germania|slovacchia|slovenia|croazia|polonia|ungheria|portogallo|lussemburgo|irlanda|danimarca|svezia|norvegia|finlandia|stati\s+uniti|usa|canada|australia|andorra|principato\s+di\s+monaco)\s*$/i;

function validIsoDate(year: string, month: string, day: string): string | null {
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const dt = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(dt.getTime()) && dt.toISOString().slice(0, 10) === iso ? iso : null;
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "event";
}

export function parseItalianDateRange(raw: string): { startDate: string; endDate: string | null } | null {
  const clean = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  // Cross-month range: "21 febbraio – 26 settembre 2027"
  const crossMonth = clean.match(/\b(\d{1,2})\s+([a-z]+)\s*[-–]\s*(\d{1,2})\s+([a-z]+)\s+(20\d{2})\b/);
  if (crossMonth) {
    const m1 = IT_MONTHS[crossMonth[2]!];
    const m2 = IT_MONTHS[crossMonth[4]!];
    if (!m1 || !m2) return null;
    const s = validIsoDate(crossMonth[5]!, m1, crossMonth[1]!);
    const e = validIsoDate(crossMonth[5]!, m2, crossMonth[3]!);
    if (!s || !e || e < s) return null;
    return { startDate: s, endDate: e !== s ? e : null };
  }

  // Same-month range: "5–6 giugno 2027"
  const sameMonth = clean.match(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([a-z]+)\s+(20\d{2})\b/);
  if (sameMonth) {
    const m = IT_MONTHS[sameMonth[3]!];
    if (!m) return null;
    const s = validIsoDate(sameMonth[4]!, m, sameMonth[1]!);
    const e = validIsoDate(sameMonth[4]!, m, sameMonth[2]!);
    if (!s || !e || e < s) return null;
    return { startDate: s, endDate: e !== s ? e : null };
  }

  // Single day: "14 marzo 2027"
  const single = clean.match(/\b(\d{1,2})\s+([a-z]+)\s+(20\d{2})\b/);
  if (single) {
    const m = IT_MONTHS[single[2]!];
    if (!m) return null;
    const s = validIsoDate(single[3]!, m, single[1]!);
    return s ? { startDate: s, endDate: null } : null;
  }

  return null;
}

/** Converts UTC timestamps (e.g. `2027-03-13T23:00:00.000Z`) into Europe/Rome calendar dates (`2027-03-14`). */
export function romeDateFromIso(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return validIsoDate(trimmed.slice(0, 4), trimmed.slice(5, 7), trimmed.slice(8, 10));
  }
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export function isItalianLocation(placeText: string): boolean {
  const clean = placeText.replace(/\s+/g, " ").trim();
  if (!clean) return false;
  return !FOREIGN_COUNTRY_SUFFIX.test(clean);
}

export function isItalianCyclingEvent(sports: string[], title: string): boolean {
  const sportHay = sports.join(" ").trim();
  if (sportHay && NOT_CYCLING.test(sportHay)) return false;
  if (NOT_CYCLING.test(title)) return false;
  const combined = `${sportHay} ${title}`;
  return CYCLING_HINT.test(combined);
}

export function mapItDisciplines(sports: string[], title: string): Discipline[] {
  const out: Discipline[] = [];
  const add = (d: Discipline) => { if (!out.includes(d)) out.push(d); };
  const sources = sports.length ? sports : [title];

  for (const s of sources) {
    const hay = `${s} ${title}`;
    if (/cyclo[- ]?cross|ciclocross|\bcx\b/i.test(s) || (/cyclo[- ]?cross|ciclocross|\bcx\b/i.test(title) && !/gravel|strada/i.test(s))) {
      add("cx");
    } else if (/gravel/i.test(s) || (/gravel/i.test(title) && !/strada/i.test(s))) {
      add("gravel");
    } else if (/downhill|\bdh\b/i.test(hay)) {
      add("dh");
    } else if (/enduro/i.test(hay)) {
      add("enduro");
    } else if (/\bbmx\b/i.test(hay)) {
      add("bmx");
    } else if (/cross[- ]?country|\bxco\b|\bxcc\b|\bxce\b|\bxcp\b/i.test(hay)) {
      add("xco");
    } else if (/marathon|\bxcm\b|point\s+to\s+point|\bmtb\b|mountain\s*bike/i.test(s) || (/\bmtb\b|durona\s+bike|brenta\s+bike|100\s*km\s+dei\s+forti|assietta/i.test(title) && !/strada/i.test(s))) {
      add("xcm");
    } else if ((/gran\s*fondo/i.test(s) || /gran\s*fondo/i.test(title)) && !/\bmtb\b|mountain\s*bike/i.test(sources.join(" "))) {
      add("gran_fondo");
    } else if (/criterium/i.test(hay)) {
      add("criterium");
    } else if (/crono|time\s*trial/i.test(hay)) {
      add("tt");
    } else if (/strada|road|ciclismo/i.test(s)) {
      add("road");
    }
  }

  return out.length ? out : ["road"];
}

// ── 1. MTBonline.it (Italy) ─────────────────────────────────────────────────

export type MtbOnlineRow = {
  id: string | null;
  externalId: string;
  title: string;
  startDate: string;
  place: string;
  typeText: string;
  discipline: Discipline;
  detailUrl: string | null;
  monthHeading: string;
  rawQuote: string;
};

export function parseMtbOnlineEvents(html: string, baseUrl = "https://www.mtbonline.it/Eventi"): MtbOnlineRow[] {
  const $ = load(html);
  const rows: MtbOnlineRow[] = [];
  const seen = new Set<string>();

  $(".roadbook-row").each((_, el) => {
    const row = $(el);
    const title = row.find(".roadbook-card__title").first().text().replace(/\s+/g, " ").trim();
    const startDate = row.find("time.roadbook-card__date").first().attr("datetime")?.trim() ?? "";
    const dateLabel = row.find("time.roadbook-card__date").first().text().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const place = row.find(".roadbook-card__place").first().text().replace(/\s+/g, " ").trim();
    const typeText = (row.find(".roadbook-card__type").first().text() || row.attr("data-event-type") || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !place) return;
    if (!validIsoDate(startDate.slice(0, 4), startDate.slice(5, 7), startDate.slice(8, 10))) return;
    if (!isItalianLocation(place)) return;
    if (!isItalianCyclingEvent(typeText ? [typeText] : [], title)) return;

    const href = row.find("a.roadbook-card[href]").first().attr("href")?.trim() ?? "";
    const detailUrl = href ? new URL(href, baseUrl).toString() : null;
    const id = detailUrl?.match(/\/Evento\/(\d+)/i)?.[1] ?? null;
    const externalId = id
      ? `mtbonline:${id}`
      : `mtbonline:${startDate}:${slugify(title)}:${slugify(place)}`;

    if (seen.has(externalId)) return;
    seen.add(externalId);

    const monthHeading = row
      .closest(".event-month")
      .find("h2.roadbook-month__title")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();

    const [disc] = mapItDisciplines(typeText ? [typeText] : [], title);
    const quoteParts = [
      /\b20\d{2}\b/.test(monthHeading) ? monthHeading : "",
      dateLabel,
      title,
      place,
    ].filter(Boolean);

    rows.push({
      id,
      externalId,
      title,
      startDate,
      place,
      typeText,
      discipline: disc ?? "mtb",
      detailUrl,
      monthHeading,
      rawQuote: quoteParts.join("\n").slice(0, 280),
    });
  });

  return rows;
}

export function mtbOnlineParsedEvent(row: MtbOnlineRow, sourceUrl = "https://www.mtbonline.it/Eventi"): ParsedEvent {
  return {
    externalId: row.externalId,
    name: row.title,
    startDate: row.startDate,
    placeText: row.place,
    countryHint: "IT",
    discipline: [row.discipline],
    sourceUrl,
    ...(row.detailUrl ? { registrationUrl: row.detailUrl } : {}),
    confidence: 0.85,
    evidence: {
      quote: row.rawQuote,
      sourceUrl,
      method: "mtbonline_it",
      version: "mtbonline-v1",
    },
  };
}

export function enrichMtbOnlineFromDetail(row: MtbOnlineRow, detailHtml: string, detailUrl: string): ParsedEvent {
  const $ = load(detailHtml);
  let sportsLd: {
    name?: string;
    startDate?: string;
    endDate?: string;
    location?: { name?: string };
  } | null = null;

  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const parsed = JSON.parse($(el).text());
      if (parsed?.["@type"] === "SportsEvent") sportsLd = parsed;
    } catch { /* ignore */ }
  }

  const name = (sportsLd?.name || $("h1").first().text() || row.title).replace(/\s+/g, " ").trim();
  const startDate = romeDateFromIso(sportsLd?.startDate) ?? row.startDate;
  const endRaw = romeDateFromIso(sportsLd?.endDate);
  const endDate = endRaw && endRaw > startDate ? endRaw : undefined;
  const placeText = (sportsLd?.location?.name || row.place).replace(/\s+/g, " ").trim();

  let lat: number | undefined;
  let lng: number | undefined;
  let websiteUrl: string | undefined;

  $("main a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim() ?? "";
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!href) return;
    let decodedHref = href;
    try { decodedHref = decodeURIComponent(href); } catch { /* keep raw */ }
    const mapsMatch = decodedHref.match(/maps\.google\.com\/\?q=([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?)/i);
    if (mapsMatch && lat === undefined) {
      lat = Number(mapsMatch[1]);
      lng = Number(mapsMatch[2]);
    }
    if (
      /^https?:\/\//i.test(href) &&
      /sito\s+ufficiale/i.test(text) &&
      !/mtbonline\.it|facebook\.com|instagram\.com/i.test(href) &&
      !websiteUrl
    ) {
      websiteUrl = href;
    }
  });

  const mainText = $("main").text().replace(/\s+/g, " ").trim();
  const fullDateMatch = mainText.match(/\b\d{1,2}\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+20\d{2}\b/i);
  const quote = fullDateMatch
    ? [name, fullDateMatch[0], placeText].filter(Boolean).join("\n").slice(0, 280)
    : row.rawQuote;

  return {
    externalId: row.externalId,
    name,
    startDate,
    ...(endDate ? { endDate } : {}),
    placeText,
    countryHint: "IT",
    discipline: [row.discipline],
    sourceUrl: detailUrl,
    ...(websiteUrl ? { websiteUrl } : {}),
    registrationUrl: detailUrl,
    ...(lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}),
    confidence: 0.9,
    evidence: {
      quote,
      sourceUrl: detailUrl,
      method: "mtbonline_it",
      version: "mtbonline-v1",
    },
  };
}

// ── 2. WinningTime (iscrizioni.winningtime.it) ──────────────────────────────

export type WinningTimeCard = {
  slug: string;
  title: string;
  dateText: string;
  startDate: string;
  endDate: string | null;
  place: string | null;
  sports: string[];
  isCircuit: boolean;
  detailUrl: string;
};

export function parseWinningTimeList(html: string, baseUrl = "https://iscrizioni.winningtime.it/eventi"): WinningTimeCard[] {
  const $ = load(html);
  const cards: WinningTimeCard[] = [];
  const seen = new Set<string>();

  $('a[href^="/eventi/"], a[href^="https://iscrizioni.winningtime.it/eventi/"]').each((_, el) => {
    const a = $(el);
    const href = a.attr("href")?.trim() ?? "";
    const slugMatch = href.match(/\/eventi\/([a-z0-9-]+)\/?$/i);
    if (!slugMatch) return;
    const slug = slugMatch[1]!;
    if (seen.has(slug)) return;

    const title = a.find("h3").first().text().replace(/\s+/g, " ").trim();
    if (!title) return;

    const sports = a
      .find("span.bg-lime")
      .map((_, s) => $(s).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean);

    if (!isItalianCyclingEvent(sports, title)) return;

    // Meta row contains date span and optional place span (circuits omit place and span multiple months).
    const metaSpans = a
      .find("div.text-body-sm span.inline-flex")
      .map((_, s) => $(s).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean);

    const badgeDate = a.find("span.bottom-4.right-4").first().text().replace(/\s+/g, " ").trim();
    const dateText = metaSpans[0] || badgeDate;
    const parsedDate = parseItalianDateRange(dateText);
    if (!parsedDate) return;

    const place = metaSpans.length >= 2 ? metaSpans[1]! : null;
    const daySpan = parsedDate.endDate
      ? (Date.parse(parsedDate.endDate) - Date.parse(parsedDate.startDate)) / 86_400_000
      : 0;
    const isCircuit = !place && (/circuito/i.test(title) || daySpan > 14);

    seen.add(slug);
    cards.push({
      slug,
      title,
      dateText,
      startDate: parsedDate.startDate,
      endDate: parsedDate.endDate,
      place,
      sports,
      isCircuit,
      detailUrl: new URL(`/eventi/${slug}`, baseUrl).toString(),
    });
  });

  return cards;
}

type WinningTimeJsonLd = {
  "@type"?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  sport?: string;
  description?: string;
  organizer?: { name?: string; url?: string };
  location?: {
    name?: string;
    address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string };
    geo?: { latitude?: number; longitude?: number };
  };
};

export function parseWinningTimeDetail(html: string, url: string, fallbackCard?: WinningTimeCard): ParsedEvent | null {
  const $ = load(html);
  const slug = url.replace(/\/+$/, "").split("/").pop() ?? "event";

  // Circuit pages ("Iscriviti al circuito" / "Località da confermare") are parsed via parseWinningTimeCircuitStages.
  const mainText = $("main").text().replace(/\s+/g, " ").trim();
  if (/iscriviti\s+al\s+circuito/i.test(mainText) || /localit[aà]\s+da\s+confermare/i.test(mainText)) {
    return null;
  }

  const ldEvents: WinningTimeJsonLd[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item?.["@type"] === "SportsEvent") ldEvents.push(item as WinningTimeJsonLd);
      }
    } catch { /* ignore */ }
  });

  const primary = ldEvents[0];
  const h1 = $("main h1").first().text().replace(/\s+/g, " ").trim();
  const name = h1 || (primary?.name?.split(" — ")[0] ?? "").trim() || fallbackCard?.title || "";
  if (!name) return null;

  const sports = [
    ...new Set([
      ...ldEvents.map(e => e.sport?.trim() ?? "").filter(Boolean),
      ...(fallbackCard?.sports ?? []),
    ]),
  ];
  if (!isItalianCyclingEvent(sports, name)) return null;

  // Prefer visible Italian date in hero (immune to UTC midnight shift), falling back to Europe/Rome conversion.
  const heroDateMatch = mainText.match(/\b(\d{1,2}\s*[–-]\s*\d{1,2}\s+[a-z]+\s+20\d{2}|\d{1,2}\s+[a-z]+\s+20\d{2})\b/i);
  const heroDates = heroDateMatch ? parseItalianDateRange(heroDateMatch[1]!) : null;

  const ldStarts = ldEvents.map(e => romeDateFromIso(e.startDate)).filter((d): d is string => Boolean(d)).sort();
  const ldEnds = ldEvents.map(e => romeDateFromIso(e.endDate)).filter((d): d is string => Boolean(d)).sort();

  const startDate = heroDates?.startDate ?? ldStarts[0] ?? fallbackCard?.startDate;
  if (!startDate) return null;
  const endCandidate = heroDates?.endDate ?? ldEnds[ldEnds.length - 1] ?? fallbackCard?.endDate ?? null;
  const endDate = endCandidate && endCandidate > startDate ? endCandidate : undefined;

  const addr = primary?.location?.address;
  const countryHint = (addr?.addressCountry ?? "IT").trim().toUpperCase();
  if (countryHint !== "IT") return null;

  const locality = (addr?.addressLocality || fallbackCard?.place || "").replace(/\s+/g, " ").trim();
  if (!locality || /^localit[aà]\s+da\s+confermare/i.test(locality)) return null;
  const placeText = addr?.addressRegion && !locality.toLowerCase().includes(addr.addressRegion.toLowerCase())
    ? `${locality}, ${addr.addressRegion}`
    : locality;

  let websiteUrl: string | undefined;
  const orgUrl = primary?.organizer?.url?.trim();
  if (orgUrl && /^https?:\/\//i.test(orgUrl) && !/winningtime\.it|facebook\.com|instagram\.com/i.test(orgUrl)) {
    websiteUrl = orgUrl;
  }

  let regulationsUrl: string | undefined;
  let registrationUrl: string | undefined;
  let resultsUrl: string | undefined;

  $("main a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim() ?? "";
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!href) return;
    if (/regolamento/i.test(text) && /^https?:\/\//i.test(href) && !regulationsUrl) {
      regulationsUrl = href;
    } else if (/iscriviti/i.test(text) && !registrationUrl) {
      registrationUrl = new URL(href, url).toString();
    } else if (/classifiche/i.test(text) && !resultsUrl) {
      resultsUrl = new URL(href, url).toString();
    }
  });

  const lat = primary?.location?.geo?.latitude;
  const lng = primary?.location?.geo?.longitude;
  const quoteDate = heroDateMatch?.[1] ?? fallbackCard?.dateText ?? startDate;
  const quote = [name, quoteDate, locality].join("\n").slice(0, 280);

  return {
    externalId: `winningtime:${slug}`,
    name,
    startDate,
    ...(endDate ? { endDate } : {}),
    placeText,
    countryHint: "IT",
    discipline: mapItDisciplines(sports, name),
    sourceUrl: url,
    ...(websiteUrl ? { websiteUrl } : {}),
    registrationUrl: registrationUrl ?? `${url.replace(/\/+$/, "")}/iscrizioni`,
    ...(regulationsUrl ? { regulationsUrl } : {}),
    ...(resultsUrl ? { resultsUrl } : {}),
    ...(typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}),
    confidence: 0.9,
    evidence: {
      quote,
      sourceUrl: url,
      method: "winningtime_it",
      version: "wt-v1",
    },
  };
}

export function parseWinningTimeCircuitStages(
  html: string,
  circuitIscrizioniUrl: string,
  circuitSports: string[] = ["MTB"],
): ParsedEvent[] {
  const $ = load(html);
  const stages: ParsedEvent[] = [];
  const seen = new Set<string>();
  const slugMatch = circuitIscrizioniUrl.match(/\/eventi\/([a-z0-9-]+)/i);
  const circuitSlug = slugMatch?.[1] ?? "circuit";
  const circuitName = $("main h1").first().text().replace(/\s+/g, " ").trim() || undefined;
  const circuitUrl = circuitIscrizioniUrl.replace(/\/iscrizioni\/?$/i, "");

  $("main ol > li").each((_, li) => {
    const item = $(li);
    const title = item.find("h3").first().text().replace(/\s+/g, " ").trim();
    if (!title || NOT_CYCLING.test(title)) return;

    const metaTexts = item
      .find("div.text-body-sm span.inline-flex, span.inline-flex")
      .map((_, s) => $(s).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean);

    const dateRaw = metaTexts.find(t => parseItalianDateRange(t) !== null);
    if (!dateRaw) return;
    const dates = parseItalianDateRange(dateRaw);
    if (!dates) return;

    const placeRaw =
      metaTexts.find(t => t !== dateRaw && /·\s*[A-Z]{2}\s*$/.test(t)) ??
      metaTexts.find(t => t !== dateRaw && !/^\d+$/.test(t)) ??
      "";
    const countryMatch = placeRaw.match(/·\s*([A-Z]{2})\s*$/);
    const countryCode = countryMatch?.[1] ?? "IT";
    if (countryCode !== "IT") return;
    const placeText = placeRaw.replace(/\s*·\s*[A-Z]{2}\s*$/, "").replace(/\s+/g, " ").trim();
    if (!placeText) return;

    const externalId = `winningtime-stage:${circuitSlug}:${dates.startDate}:${slugify(title)}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const routeLabels = item
      .find("ul li span.text-ink")
      .map((_, s) => $(s).text().replace(/\s+/g, " ").trim())
      .get();
    const sports = [...circuitSports, ...routeLabels];
    const quote = [title, dateRaw, placeText].join("\n").slice(0, 280);

    stages.push({
      externalId,
      name: title,
      startDate: dates.startDate,
      ...(dates.endDate ? { endDate: dates.endDate } : {}),
      placeText,
      countryHint: "IT",
      discipline: mapItDisciplines(sports, title),
      ...(circuitName ? { seriesName: circuitName, seriesSlug: circuitSlug, seriesWebsite: circuitUrl } : {}),
      sourceUrl: circuitIscrizioniUrl,
      registrationUrl: circuitIscrizioniUrl,
      confidence: 0.85,
      evidence: {
        quote,
        sourceUrl: circuitIscrizioniUrl,
        method: "winningtime_it",
        version: "wt-v1",
      },
    });
  });

  return stages;
}
