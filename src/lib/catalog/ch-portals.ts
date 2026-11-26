import type { Discipline, ParsedEvent } from "@/lib/domain";

const COVERED_COUNTRIES = new Set(["CZ", "SK", "DE", "PL", "AT", "IT", "CH"]);

const ISO3_TO_ISO2: Record<string, string> = {
  CHE: "CH",
  AUT: "AT",
  DEU: "DE",
  ITA: "IT",
  CZE: "CZ",
  SVK: "SK",
  POL: "PL",
  LIE: "LI",
  FRA: "FR",
  NOR: "NO",
  ESP: "ES",
  NLD: "NL",
  BEL: "BE",
  LUX: "LU",
  SVN: "SI",
};

const NOT_CYCLING = /\b(?:lauf\w*|volkslauf|stadtlauf|trail\s*run\w*|run(?:ning)?|marathonlauf|halbmarathon|half\s*marathon|triathlon|duathlon|aquathlon|swim\w*|schwimm\w*|ski\w*|langlauf|nordic\s*walk\w*|walking|hike|hiking|wandern|skat\w*|golf|yoga|orienteering|orientierungslauf|hybrid\s*racing|cours[ea]\s+a\s+pied)\b/i;
const CYCLING_TITLE = /\b(?:velo\w*|rad\w*|rennrad|mountain\s*bike|mtb|bike\w*|gravel\w*|cyclocross|cyclo[- ]?cross|querfeldein|xco|xcm|enduro|downhill|bmx|alpenbrevet|ultracycling|gran\s*fondo|medio\s*fondo)\b/i;

function formatDeDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

function spanDays(startIso: string, endIso: string | null | undefined): number {
  if (!endIso) return 0;
  const a = Date.parse(`${startIso}T00:00:00Z`);
  const b = Date.parse(`${endIso}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function normalizePortalUrl(raw: string | null | undefined, opts?: { allowSocial?: boolean }): string | undefined {
  if (!raw) return undefined;
  let s = raw.trim();
  if (!s) return undefined;
  if (/^www\./i.test(s)) s = `https://${s}`;
  if (!/^https?:\/\//i.test(s)) return undefined;
  try {
    const u = new URL(s);
    if (!["http:", "https:"].includes(u.protocol)) return undefined;
    if (!opts?.allowSocial && /(?:^|\.)(?:facebook\.com|instagram\.com|twitter\.com|x\.com)$/i.test(u.hostname)) {
      return undefined;
    }
    return u.toString();
  } catch {
    return undefined;
  }
}

export function validEuroCoords(lat: number | null | undefined, lng: number | null | undefined): { lat: number; lng: number } | undefined {
  if (typeof lat !== "number" || typeof lng !== "number") return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < 35 || lat > 72 || lng < -15 || lng > 40) return undefined;
  return { lat, lng };
}

export function inferAlpineCyclingDiscipline(text: string): Discipline {
  if (/gravel/i.test(text)) return "gravel";
  if (/cyclocross|cyclo[- ]?cross|querfeldein|\bcx\b/i.test(text)) return "cx";
  if (/enduro/i.test(text)) return "enduro";
  if (/downhill|\bdh\b/i.test(text)) return "dh";
  if (/\bxco\b|cross[- ]?country/i.test(text)) return "xco";
  if (/\bxcm\b|bike[- ]?marathon|mtb[- ]?marathon|ultra[- ]?bike/i.test(text)) return "xcm";
  if (/\bmtb\b|mountain\s*bike|\bvtt\b|e-mtb/i.test(text)) return "mtb";
  if (/\bbmx\b/i.test(text)) return "bmx";
  if (/zeitfahren|time\s*trial/i.test(text)) return "tt";
  if (/bergrennen|mountain\s*race|hill\s*climb/i.test(text)) return "hill_climb";
  if (/kriterium|criterium/i.test(text)) return "criterium";
  if (/gran\s*fondo|radmarathon|alpenbrevet|brevet|ultracycling/i.test(text)) return "gran_fondo";
  if (/strassenrennen|road\s*race|course\s+sur\s+route|gara\s+su\s+strada/i.test(text)) return "road_race";
  return "road";
}

// ── 1. TrackMaxx.ch (Switzerland) ────────────────────────────────────────────

export type TrackMaxxRawEvent = {
  name?: string | null;
  shortname?: string | null;
  webtag?: string | null;
  racedate?: string | null;
  racedate2?: string | null;
  city?: string | null;
  showresultlist?: boolean;
  showregistration?: boolean;
  hideregistration?: boolean;
  showentrylist?: boolean;
  linkfacebook?: string | null;
  linktwitter?: string | null;
  linkinstagram?: string | null;
  linkevent?: string | null;
  linkentrylist?: string | null;
  linkresultlist?: string | null;
  linkregistration?: string | null;
  linkracemap?: string | null;
  eventtype?: string | null;
  mapcoordinates?: string | null;
};

const SWISS_PLACE_HINT = /\b(Andermatt|Arosa|Basel|Bern|Biel|Chur|Davos|Fribourg|Genf|Gen[eè]ve|Interlaken|Jura|Laufenburg|Lausanne|Lenzerheide|Locarno|Lugano|Luzern|Schaffhausen|St\.?\s*Gallen|Thun|Winterthur|Zug|Zürich)\b/i;

function parseTrackMaxxCoords(raw: string | null | undefined): { lat: number; lng: number } | undefined {
  if (!raw) return undefined;
  const parts = raw.split(",").map(s => Number(s.trim()));
  if (parts.length !== 2) return undefined;
  return validCoordsCheck(parts[0], parts[1]);
}

function validCoordsCheck(lat: number | undefined, lng: number | undefined) {
  return validEuroCoords(lat, lng);
}

function inferTrackMaxxCountry(city: string, websiteUrl: string | undefined, coords: { lat: number; lng: number } | undefined): string | null {
  if (coords && coords.lat >= 45.8 && coords.lat <= 47.85 && coords.lng >= 5.9 && coords.lng <= 10.55) {
    return "CH";
  }
  if (websiteUrl) {
    try {
      const host = new URL(websiteUrl).hostname.toLowerCase();
      if (host.endsWith(".ch")) return "CH";
      if (host.endsWith(".at")) return "AT";
      if (host.endsWith(".de")) return "DE";
      if (host.endsWith(".it")) return "IT";
    } catch { /* ignore */ }
  }
  if (SWISS_PLACE_HINT.test(city)) return "CH";
  return null;
}

/** Extracts the embedded `e.data = [...]` JSON array from TrackMaxx HTML. */
export function extractTrackMaxxJson(html: string): TrackMaxxRawEvent[] {
  const m = html.match(/e\.data\s*=\s*(\[\{[\s\S]*?\}\])\s*;/);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[1]!);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isTrackMaxxCycling(row: TrackMaxxRawEvent): boolean {
  const name = (row.name ?? "").trim();
  const webtag = (row.webtag ?? "").trim();
  const raceDate = row.racedate?.slice(0, 10) ?? "";
  if (!name || !webtag || !/^\d{4}-\d{2}-\d{2}$/.test(raceDate)) return false;
  if (NOT_CYCLING.test(name)) return false;

  const endRaw = row.racedate2?.slice(0, 10);
  if (endRaw && /^\d{4}-\d{2}-\d{2}$/.test(endRaw) && spanDays(raceDate, endRaw) > 45) {
    return false;
  }

  const eventType = (row.eventtype ?? "").trim();
  if (eventType) {
    return /^cycling$/i.test(eventType);
  }
  return CYCLING_TITLE.test(name);
}

export function trackMaxxParsedEvent(row: TrackMaxxRawEvent, sourceUrl = "https://trackmaxx.ch/"): ParsedEvent | null {
  if (!isTrackMaxxCycling(row)) return null;
  const name = row.name!.replace(/\s+/g, " ").trim();
  const webtag = row.webtag!.trim().toLowerCase();
  const startDate = row.racedate!.slice(0, 10);
  const endRaw = row.racedate2?.slice(0, 10);
  const endDate = endRaw && /^\d{4}-\d{2}-\d{2}$/.test(endRaw) && endRaw > startDate ? endRaw : undefined;

  const city = (row.city ?? "").replace(/\s+/g, " ").trim();
  const placeFromName = !city ? (name.match(SWISS_PLACE_HINT)?.[1] ?? "") : "";
  const place = city || placeFromName;
  if (!place || /^(?:schweiz|switzerland|suisse|svizzera)$/i.test(place)) return null;

  const websiteUrl = normalizePortalUrl(row.linkevent);
  const coords = parseTrackMaxxCoords(row.mapcoordinates);
  const countryHint = inferTrackMaxxCountry(place, websiteUrl, coords);
  if (!countryHint || !COVERED_COUNTRIES.has(countryHint)) return null;

  const registrationUrl = normalizePortalUrl(row.linkregistration, { allowSocial: true })
    ?? (row.showregistration && !row.hideregistration ? `https://trackmaxx.ch/registration/?race=${encodeURIComponent(webtag)}` : undefined);
  const resultsUrl = normalizePortalUrl(row.linkresultlist, { allowSocial: true })
    ?? (row.showresultlist ? `https://trackmaxx.ch/results/?race=${encodeURIComponent(webtag)}` : undefined);

  const disc = inferAlpineCyclingDiscipline(name);
  const dateRangeDe = endDate ? `${formatDeDate(startDate)} - ${formatDeDate(endDate)}` : formatDeDate(startDate);
  const quote = `${name} | ${dateRangeDe} | ${place} | ${row.eventtype?.trim() || "Cycling"}`.slice(0, 280);

  return {
    externalId: `trackmaxx:${webtag}`,
    name,
    startDate,
    ...(endDate ? { endDate } : {}),
    placeText: place,
    countryHint,
    discipline: [disc],
    sourceUrl,
    ...(websiteUrl ? { websiteUrl } : {}),
    ...(registrationUrl ? { registrationUrl } : {}),
    ...(resultsUrl ? { resultsUrl } : {}),
    ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    confidence: 0.85,
    evidence: {
      quote,
      sourceUrl,
      method: "trackmaxx_ch",
      version: "trackmaxx-v1",
    },
  };
}

export function parseTrackMaxxCycling(html: string, sourceUrl = "https://trackmaxx.ch/"): ParsedEvent[] {
  const out: ParsedEvent[] = [];
  const seen = new Set<string>();
  for (const raw of extractTrackMaxxJson(html)) {
    const ev = trackMaxxParsedEvent(raw, sourceUrl);
    if (!ev || seen.has(ev.externalId)) continue;
    seen.add(ev.externalId);
    out.push(ev);
  }
  return out;
}

// ── 2. Datasport.com (CH / AT / DE / IT) ─────────────────────────────────────

export type DatasportLabel = {
  de?: string | null;
  en?: string | null;
  it?: string | null;
  fr?: string | null;
};

export type DatasportRegion = {
  id?: number;
  countryCode?: string | null;
  name?: DatasportLabel | null;
};

export type DatasportEdition = {
  id: number;
  raceNr?: number | null;
  name?: string | null;
  slug?: string | null;
  editionFrom?: string | null;
  editionTo?: string | null;
  organizerLink?: string | null;
  onRegLink?: string | null;
  onRegLinkTo?: string | null;
  onRegActive?: boolean;
  showLinkRegistration?: boolean;
  resultLink?: string | null;
  cancelled?: boolean;
  visible?: boolean;
  regions?: DatasportRegion[] | null;
  sportTypes?: DatasportLabel[] | null;
  disciplines?: DatasportLabel[] | null;
  raceResultId?: number | null;
  // Present on /editions/by-slug/:slug detail responses
  town?: DatasportLabel | null;
  preciseLocation?: { latitude?: number | null; longitude?: number | null } | null;
};

const DS_CYCLING_SPORT = /^(?:rennrad|road\s*bike|bike\s*su\s*strada|mtb|gravel|cyclocross|cycling)$/i;
const DS_EXCLUDED_SPORT = /^(?:triathlon|duathlon|aquathlon|ski\s*&\s*snowboard|langlauf|cross\s*country|hybrid\s*racing|walking|skating|schwimmen|swimming)$/i;
const DS_RUN_SPORT = /^(?:lauf|run|corsa|course)$/i;

function pickLabel(label: DatasportLabel | null | undefined): string {
  if (!label) return "";
  return (label.de || label.en || label.fr || label.it || Object.values(label).find(Boolean) || "").replace(/\s+/g, " ").trim();
}

export function isDatasportCycling(edition: DatasportEdition): boolean {
  if (!edition.id || !edition.name || !edition.slug || !edition.editionFrom) return false;
  if (edition.cancelled || edition.visible === false) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(edition.editionFrom.slice(0, 10))) return false;

  const start = edition.editionFrom.slice(0, 10);
  const end = edition.editionTo?.slice(0, 10);
  if (end && /^\d{4}-\d{2}-\d{2}$/.test(end) && spanDays(start, end) > 45) return false;

  const sportLabels = (edition.sportTypes ?? [])
    .flatMap(s => [s.de, s.en, s.it, s.fr])
    .filter((v): v is string => Boolean(v?.trim()))
    .map(v => v.trim());

  if (sportLabels.some(s => DS_EXCLUDED_SPORT.test(s))) return false;
  const hasCyclingSport = sportLabels.some(s => DS_CYCLING_SPORT.test(s));
  if (!hasCyclingSport) return false;

  const hasRunSport = sportLabels.some(s => DS_RUN_SPORT.test(s));
  if (hasRunSport && !CYCLING_TITLE.test(edition.name)) return false;

  if (NOT_CYCLING.test(edition.name) && !CYCLING_TITLE.test(edition.name)) return false;
  return true;
}

export function inferDatasportCountry(edition: DatasportEdition): string | null {
  for (const reg of edition.regions ?? []) {
    const raw = (reg.countryCode ?? "").trim().toUpperCase();
    if (!raw) continue;
    const iso2 = raw.length === 2 ? raw : ISO3_TO_ISO2[raw] ?? null;
    if (iso2) return COVERED_COUNTRIES.has(iso2) ? iso2 : null;
  }

  const website = normalizePortalUrl(edition.organizerLink);
  if (website) {
    try {
      const host = new URL(website).hostname.toLowerCase();
      if (host.endsWith(".ch")) return "CH";
      if (host.endsWith(".at")) return "AT";
      if (host.endsWith(".de")) return "DE";
      if (host.endsWith(".it")) return "IT";
    } catch { /* ignore */ }
  }

  const regionText = (edition.regions ?? []).map(r => pickLabel(r.name)).join(" ");
  if (/\b(?:kanton|canton)\b/i.test(regionText) || SWISS_PLACE_HINT.test(edition.name ?? "")) {
    return "CH";
  }
  return null;
}

/** Deduplicates Datasport rows that share a slug (prefers numbered/active editions). */
export function dedupeDatasportEditions(editions: DatasportEdition[]): DatasportEdition[] {
  const bySlug = new Map<string, DatasportEdition>();
  const score = (e: DatasportEdition) =>
    (e.raceNr != null ? 4 : 0) + (e.raceResultId != null ? 2 : 0) + (e.onRegLinkTo?.slice(0, 4) === e.editionFrom?.slice(0, 4) ? 1 : 0);

  for (const ed of editions) {
    if (!ed.slug) continue;
    const prev = bySlug.get(ed.slug);
    if (!prev || score(ed) > score(prev)) {
      bySlug.set(ed.slug, ed);
    }
  }
  return [...bySlug.values()];
}

export function inferDatasportDisciplines(edition: DatasportEdition): Discipline[] {
  const discTexts = (edition.disciplines ?? []).map(pickLabel).filter(Boolean);
  const sportTexts = (edition.sportTypes ?? []).map(pickLabel).filter(Boolean);
  const name = edition.name ?? "";
  const isMtbSport = sportTexts.some(s => /\bmtb\b/i.test(s));
  const out: Discipline[] = [];

  for (const d of discTexts) {
    if (/gravel/i.test(d)) out.push("gravel");
    else if (/cross\s*country|\bxco\b/i.test(d)) out.push("xco");
    else if (/bike\s*marathon|\bxcm\b/i.test(d)) out.push("xcm");
    else if (/radmarathon/i.test(d)) out.push("gran_fondo");
    else if (/bergrennen|mountain\s*race/i.test(d)) out.push(isMtbSport ? "xcm" : "hill_climb");
    else if (/strassenrennen|road\s*race/i.test(d)) out.push("road_race");
    else if (/enduro/i.test(d)) out.push("enduro");
    else if (/downhill/i.test(d)) out.push("dh");
    else if (/cyclocross|querfeldein/i.test(d)) out.push("cx");
    else if (/zeitfahren|time\s*trial/i.test(d)) out.push("tt");
    else if (/e-mtb/i.test(d)) out.push("mtb");
  }

  if (!out.length) {
    out.push(inferAlpineCyclingDiscipline(`${name} ${discTexts.join(" ")} ${sportTexts.join(" ")}`));
  } else if (/gravel/i.test(name) && !out.includes("gravel")) {
    out.unshift("gravel");
  }

  return [...new Set(out)];
}

export function datasportParsedEvent(edition: DatasportEdition, detail?: Partial<DatasportEdition> | null): ParsedEvent | null {
  const merged: DatasportEdition = detail ? { ...edition, ...detail } : edition;
  if (!isDatasportCycling(merged)) return null;

  const countryHint = inferDatasportCountry(merged);
  if (!countryHint) return null;

  const name = merged.name!.replace(/\s+/g, " ").trim();
  const startDate = merged.editionFrom!.slice(0, 10);
  const endRaw = merged.editionTo?.slice(0, 10);
  const endDate = endRaw && /^\d{4}-\d{2}-\d{2}$/.test(endRaw) && endRaw > startDate ? endRaw : undefined;

  const town = pickLabel(merged.town);
  const regionName = pickLabel(merged.regions?.[0]?.name).replace(/^(?:Kanton|Canton|Land)\s+/i, "").trim();
  const place = town || regionName;
  if (!place || /^(?:schweiz|switzerland|deutschland|germany|österreich|austria|italien|italy)$/i.test(place)) {
    return null;
  }

  const slug = merged.slug!.trim();
  const sourceUrl = `https://datasport.com/de/events/${slug}`;
  const websiteUrl = normalizePortalUrl(merged.organizerLink);
  const registrationUrl = merged.showLinkRegistration !== false ? normalizePortalUrl(merged.onRegLink, { allowSocial: true }) : undefined;
  const resultsUrl = normalizePortalUrl(merged.resultLink, { allowSocial: true });
  const coords = validEuroCoords(merged.preciseLocation?.latitude, merged.preciseLocation?.longitude);

  const regClose = merged.onRegLinkTo?.slice(0, 10);
  const registrationClosesAt = regClose && /^\d{4}-\d{2}-\d{2}$/.test(regClose) && regClose.slice(0, 4) === startDate.slice(0, 4)
    ? regClose
    : undefined;

  const sportLabel = (merged.sportTypes ?? []).map(pickLabel).filter(Boolean).join(", ");
  const dateRangeDe = endDate ? `${formatDeDate(startDate)} - ${formatDeDate(endDate)}` : formatDeDate(startDate);
  const quote = `${name} | ${dateRangeDe} | ${place} (${countryHint})${sportLabel ? ` | ${sportLabel}` : ""}`.slice(0, 280);

  return {
    externalId: `datasport:${merged.id}`,
    name,
    startDate,
    ...(endDate ? { endDate } : {}),
    placeText: place,
    countryHint,
    discipline: inferDatasportDisciplines(merged),
    sourceUrl,
    ...(websiteUrl ? { websiteUrl } : {}),
    ...(registrationUrl ? { registrationUrl } : {}),
    ...(resultsUrl ? { resultsUrl } : {}),
    ...(registrationClosesAt ? { registrationClosesAt } : {}),
    ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    confidence: 0.85,
    evidence: {
      quote,
      sourceUrl,
      method: "datasport_ch",
      version: "datasport-v1",
    },
  };
}
