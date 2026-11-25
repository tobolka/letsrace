import { load } from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import type { PracticalDetails } from "@/lib/practical-details";

export type DrnListRow = {
  title: string;
  url: string;
  date: string;
  discipline: Discipline;
  stateName: string;
  lat: number | null;
  lng: number | null;
  radNetUrl: string | null;
};

export type DrnRaceRow = {
  code: string;
  category: string;
  feeEur: number | null;
  lateFeeEur: number | null;
  durationOrDistance: string;
  startTime: string | null;
  rawLine: string;
};

export type DrnDetail = {
  url: string;
  title: string;
  startDate: string;
  endDate: string | null;
  place: string;
  organizer: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  venue: string | null;
  websiteUrl: string | null;
  radNetUrl: string | null;
  registrationClosesAt: string | null;
  notes: string | null;
  races: DrnRaceRow[];
  evidenceQuote: string;
};

const DISC_MAP: Record<string, Discipline> = {
  cross: "cx",
  mtb: "mtb",
  bahn: "track",
  strasse: "road",
  "straße": "road",
  gravel: "gravel",
  bmx: "bmx",
};

const NOT_A_RACE = /athletik|sichtung|schülerradsporttag|lehrgang|meldungen|fortbildung|kampfrichter/i;

function decodeHtml(s: string): string {
  return s
    .replace(/&#8222;|&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&#038;|&amp;/g, "&")
    .replace(/&#8217;|&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDeDate(text: string): string | null {
  const m = text.match(/(\d{1,2})\.(\d{1,2})\.(20\d{2})/);
  if (!m) return null;
  return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

export function isDrnRaceTitle(title: string): boolean {
  return !NOT_A_RACE.test(title);
}

/** Parses the embedded `locations = [...]` array on deutscherradsportnachwuchs.de homepage. */
export function parseDrnList(html: string): DrnListRow[] {
  const rows: DrnListRow[] = [];
  const re = /\{\s*lat:\s*([^,]+),\s*lng:\s*([^,]+),\s*age:\s*'([^']*)',\s*date:\s*'([^']*)',\s*order_date:\s*'([^']*)',\s*state:\s*'([^']*)',\s*state_name:\s*'([^']*)',\s*discipline:\s*'([^']*)'\s*,\s*discipline_name:\s*'([^']*)',\s*title:\s*'((?:\\'|[^'])*)',\s*url:\s*'([^']*)',\s*reg_link:\s*'((?:\\'|[^'])*)'\s*\}/g;
  for (const m of html.matchAll(re)) {
    const latNum = Number(m[1]!.trim());
    const lngNum = Number(m[2]!.trim());
    const date = parseDeDate(m[4]!) ?? (m[5]!.length === 8 ? `${m[5]!.slice(0, 4)}-${m[5]!.slice(4, 6)}-${m[5]!.slice(6, 8)}` : null);
    if (!date) continue;
    const discKey = m[8]!.toLowerCase().trim();
    const discipline = DISC_MAP[discKey];
    if (!discipline) continue;
    const title = decodeHtml(m[10]!.replace(/\\'/g, "'"));
    const url = m[11]!.trim();
    const regHtml = m[12]!.replace(/\\'/g, "'");
    const radNetRaw = regHtml.match(/href="([^"]+)"/)?.[1] ?? null;
    const radNetUrl = radNetRaw ? decodeHtml(radNetRaw).replace("rad-net.de//", "rad-net.de/") : null;
    rows.push({
      title,
      url,
      date,
      discipline,
      stateName: decodeHtml(m[7]!),
      lat: Number.isFinite(latNum) && latNum !== 0 ? latNum : null,
      lng: Number.isFinite(lngNum) && lngNum !== 0 ? lngNum : null,
      radNetUrl,
    });
  }
  return rows;
}

export function radNetEventId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/ID_Veranstaltung(?:%3D|=)(\d+)/i);
  return m?.[1] ?? null;
}

function cleanVal(val: string | undefined): string | null {
  if (!val) return null;
  const t = val.replace(/\s+/g, " ").trim();
  if (!t || t === "-" || t === "–" || t === "—") return null;
  return t;
}

function normalizeUrl(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().split(/\s+/)[0]!;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\.[^\s/]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

/** Parses a deutscherradsportnachwuchs.de/event/<slug>/ detail page. */
export function parseDrnDetail(html: string, url: string): DrnDetail | null {
  const $ = load(html);
  const title = cleanVal($("h1").first().text()) ?? cleanVal($("h2").first().text()) ?? "";
  const kv = new Map<string, string>();
  $("table tr").each((_, tr) => {
    const cells = $(tr).find("td, th");
    if (cells.length >= 2) {
      const k = $(cells[0]).text().replace(/\s+/g, " ").trim();
      const v = $(cells[1]).text().replace(/\s+/g, " ").trim();
      if (k && !kv.has(k)) kv.set(k, v);
    }
  });
  const tagVal = kv.get("Tag") ?? "";
  const dates = [...tagVal.matchAll(/(\d{1,2})\.(\d{1,2})\.(20\d{2})/g)].map(
    m => `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`,
  );
  const startDate = dates[0];
  if (!startDate) return null;
  const endDate = dates.length > 1 && dates[dates.length - 1] !== startDate ? dates[dates.length - 1]! : null;
  const place = cleanVal(kv.get("Ort")) ?? "";
  if (!place) return null;

  const radNetHref = $("a[href*='rad-net.de']").first().attr("href") ?? null;
  const radNetUrl = radNetHref ? radNetHref.replace("rad-net.de//", "rad-net.de/") : null;

  const regDeadlineRaw = cleanVal(kv.get("Nennung bis"));
  const registrationClosesAt = regDeadlineRaw ? parseDeDate(regDeadlineRaw) : null;

  const races: DrnRaceRow[] = [];
  $(".race_table table tr").each((_, tr) => {
    const cells = $(tr).find("td").map((__, td) => $(td).text().replace(/\s+/g, " ").trim()).get();
    if (cells.length < 2) return;
    const code = cells[0]!;
    if (!/^R\./i.test(code)) return;
    const descCell = cells[1] ?? "";
    const feeMatch = descCell.match(/Nenngeld:\s*(\d+(?:[.,]\d{1,2})?)\s*€/i);
    const lateMatch = descCell.match(/Nachm\.?\s*(\d+(?:[.,]\d{1,2})?)\s*€/i);
    const category = descCell.replace(/\s*Nenngeld:[\s\S]*$/i, "").trim();
    const durationOrDistance = cells[2] ?? "";
    const startCell = cells.find(c => /Start:\s*\d{1,2}:\d{2}/i.test(c)) ?? "";
    const startTime = startCell.match(/(\d{1,2}:\d{2})/)?.[1] ?? null;
    if (!category) return;
    races.push({
      code,
      category,
      feeEur: feeMatch ? Number(feeMatch[1]!.replace(",", ".")) : null,
      lateFeeEur: lateMatch ? Number(lateMatch[1]!.replace(",", ".")) : null,
      durationOrDistance,
      startTime: startTime ? startTime.padStart(5, "0") : null,
      rawLine: cells.filter(Boolean).join(" ").trim(),
    });
  });

  const organizer = cleanVal(kv.get("Veranstalter")) ?? cleanVal(kv.get("Ausrichter"));
  const evidenceQuote = `Tag ${tagVal} Ort ${place}`.slice(0, 280);

  return {
    url,
    title,
    startDate,
    endDate,
    place,
    organizer,
    contactName: cleanVal(kv.get("An")),
    phone: cleanVal(kv.get("Telefon")),
    email: cleanVal(kv.get("E-Mail")),
    venue: cleanVal(kv.get("Start/Ziel")),
    websiteUrl: normalizeUrl(cleanVal(kv.get("Internet"))),
    radNetUrl,
    registrationClosesAt,
    notes: cleanVal(kv.get("Bemerkung")),
    races,
    evidenceQuote,
  };
}

/** Converts a DRN detail into PracticalDetails ready for savePracticalDetails(). */
export function drnPracticalDetails(detail: DrnDetail, now = new Date().toISOString()): PracticalDetails {
  const year = Number(detail.startDate.slice(0, 4));
  const out: PracticalDetails = {};
  if (detail.venue) {
    out.venue = {
      value: { name: detail.venue, locality: detail.place.replace(/^\d{5}\s+/, "").trim(), precision: "start" },
      sourceUrl: detail.url,
      quote: `Start/Ziel ${detail.venue} · Ort ${detail.place}`.slice(0, 300),
      checkedAt: now,
      editionYear: year,
      status: "current",
    };
  }
  if (detail.organizer) {
    out.organizer = {
      value: {
        name: detail.organizer,
        ...(detail.email ? { email: detail.email } : {}),
        ...(detail.phone ? { phone: detail.phone } : {}),
        ...(detail.websiteUrl ? { url: detail.websiteUrl } : {}),
      },
      sourceUrl: detail.url,
      quote: `Veranstalter ${detail.organizer}${detail.email ? ` · ${detail.email}` : ""}`.slice(0, 300),
      checkedAt: now,
      editionYear: year,
      status: "current",
    };
  }
  const schedule = detail.races
    .filter(r => r.startTime)
    .map(r => ({
      label: r.category,
      date: detail.startDate,
      time: r.startTime!,
      sourceUrl: detail.url,
      sourceQuote: r.rawLine.slice(0, 300),
      checkedAt: now,
    }));
  if (schedule.length) {
    out.schedule = {
      value: schedule,
      sourceUrl: detail.url,
      quote: schedule.slice(0, 3).map(s => s.sourceQuote).join("\n").slice(0, 600),
      checkedAt: now,
      editionYear: year,
      status: "current",
    };
  }
  const fees = detail.races
    .filter(r => r.feeEur !== null)
    .map(r => ({
      label: r.category,
      amount: r.feeEur!,
      currency: "EUR",
      ...(detail.registrationClosesAt ? { validUntil: detail.registrationClosesAt } : {}),
      sourceUrl: detail.url,
      sourceQuote: r.rawLine.slice(0, 300),
      checkedAt: now,
    }));
  if (fees.length) {
    out.fees = {
      value: fees,
      sourceUrl: detail.url,
      quote: fees.slice(0, 3).map(f => f.sourceQuote).join("\n").slice(0, 600),
      checkedAt: now,
      editionYear: year,
      status: "current",
    };
  }
  const categories = detail.races.map(r => ({
    label: r.category,
    sourceUrl: detail.url,
    sourceQuote: r.rawLine.slice(0, 300),
    checkedAt: now,
  }));
  if (categories.length) {
    out.categories = {
      value: categories,
      sourceUrl: detail.url,
      quote: categories.slice(0, 5).map(c => c.sourceQuote).join("\n").slice(0, 600),
      checkedAt: now,
      editionYear: year,
      status: "current",
    };
  }
  return out;
}

export function drnParsedEvent(row: DrnListRow, detail: DrnDetail, textQuote: string): ParsedEvent {
  const radId = radNetEventId(detail.radNetUrl ?? row.radNetUrl);
  const slug = row.url.replace(/\/+$/, "").split("/").pop() ?? "event";
  return {
    externalId: radId ? `radnet:${radId}` : `drn:${slug}:${detail.startDate}`,
    name: detail.title || row.title,
    startDate: detail.startDate,
    ...(detail.endDate ? { endDate: detail.endDate } : {}),
    placeText: detail.place,
    countryHint: "DE",
    discipline: [row.discipline],
    sourceUrl: row.url,
    ...(detail.websiteUrl ? { websiteUrl: detail.websiteUrl } : {}),
    regulationsUrl: row.url,
    ...(detail.registrationClosesAt ? { registrationClosesAt: detail.registrationClosesAt } : {}),
    confidence: 0.9,
    evidence: {
      quote: textQuote.slice(0, 280),
      sourceUrl: row.url,
      method: "drn_ausschreibung",
      version: "drn-v1",
    },
  };
}
