/**
 * Official edition/round detail URL discovery and verification for Race Finder.
 *
 * When a race only points to an official series hub or season calendar (such as
 * ucicyclocrossworldcup.com/en/calendar/2026-2027), this module discovers the
 * specific round's official detail page on the same official host and verifies
 * that the page actually matches this race, place and edition/date.
 */
import { editionYearSupported, fileStatesEdition, quoteContainsDate } from "@/lib/catalog/practical-extraction";
import { fold } from "@/lib/text-match";

export type DetailSourceRace = {
  id?: string;
  name: string;
  date: string;
  end_date?: string | null;
  place?: string | null;
  municipality?: string | null;
  series?: string | null;
};

export type DetailLink = { href: string; text?: string };

export type DetailPageSnapshot = {
  url: string;
  text: string;
  links: DetailLink[];
};

export type DetailVerification = { ok: boolean; reason?: string };

export type ResolvedDetailSources = {
  urls: string[];
  officialDetailUrl: string | null;
  missingDetailReason: string | null;
  previousMissingReason?: string | null;
};

const MULTI_TENANT_HOSTS = new Set([
  "facebook.com",
  "instagram.com",
  "google.com",
  "blogspot.com",
  "wordpress.com",
  "wixsite.com",
  "github.io",
  "netlify.app",
  "vercel.app",
  "pages.dev",
  "webnode.cz",
  "webnode.com",
  "weebly.com",
  "squarespace.com",
  "linktr.ee",
]);

const TWO_PART_TLDS = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "com.au",
  "net.au",
  "org.au",
  "com.pl",
  "net.pl",
  "org.pl",
  "co.nz",
  "com.br",
  "co.jp",
  "co.za",
]);

const ASSET_EXTENSION = /\.(?:jpe?g|png|gif|webp|svg|ico|css|js|mjs|woff2?|ttf|eot|mp4|mp3|avi|mov|webm)(?:[?#]|$)/i;

const GENERIC_RACE_WORDS = new Set([
  "tour",
  "cup",
  "world",
  "pro",
  "mtb",
  "cycling",
  "race",
  "maraton",
  "marathon",
  "challenge",
  "series",
  "pohar",
  "zavod",
  "zavody",
  "uci",
  "cyclo",
  "cross",
  "cyclocross",
  "cyklokros",
  "grand",
  "prix",
  "round",
  "stage",
  "etapa",
  "kolo",
  "memorial",
  "trophy",
  "classic",
  "criterium",
  "kriterium",
  "xco",
  "xcm",
  "xcc",
  "gravel",
  "road",
  "silnicni",
  "cesky",
  "slovensky",
  "national",
  "championship",
  "championships",
  "mistrovstvi",
]);

const NON_DETAIL_PATH_SEGMENT = /\b(?:news|blog|contact|kontakt|privacy|cookies?|terms|imprint|impressum|login|signin|sign-in|account|cart|shop|store|sponsors?|partners?|about|o-nas|rankings?|standings?|classification|photos?|gallery|galerie|videos?|media|press|faq|newsletter|archive|archiv)\b/i;

const HUB_PATH_PATTERN = /^\/?(?:[a-z]{2}\/)?(?:calendar|kalendar|events?|races?|rounds?|series|schedule|season|seasons|rules|regulations|regulations-[a-z]{2}|propozice|terminy|termine|calendario|calendrier)?(?:\/20\d{2}(?:[-/]20\d{2}|[-/]\d{2})?)?\/?$/i;
const CALENDAR_HUB_PATH = /^\/?(?:[a-z]{2}\/)?(?:calendar|kalendar|events?|races?|rounds?|series|schedule|season|seasons|rules|regulations|regulations-[a-z]{2}|terminy|termine|calendario|calendrier)(?:\/20\d{2}(?:[-/]20\d{2}|[-/]\d{2})?)?\/?$/i;

export const CORE_PRACTICAL_FIELDS = ["venue", "routes", "fees", "schedule", "categories"] as const;

const GENERIC_SERIES_REGULATIONS_PATH =
  /^\/(?:.*\/)?(?:o-serialu\/pravidla|pravidla(?:-serialu)?|rules|regulations(?:-[a-z]{2})?|generalausschreibung|reglement|series-rules|series-regulations|calendar|kalendar|terminy|termine|calendario|calendrier)(?:\/20\d{2}(?:[-/]20\d{2}|[-/]\d{2})?)?$/i;

const GENERIC_SERIES_PDF_NAME =
  /^(?:generalausschreibung|series[-_]rules|series[-_]regulations|pravidla[-_]serialu|reglement[-_]general)\.(?:pdf|docx?)$/i;

const NON_SPECIFIC_QUERY_PARAMS = new Set(["lang", "locale", "hl", "fbclid", "gclid"]);

/**
 * True when `url` points to a generic series rules, regulations, calendar overview,
 * or root homepage rather than a specific round/race document or detail page.
 */
export function isGenericSeriesRegulationsUrl(url: string | null | undefined): boolean {
  const parsed = parseHttpUrl(url);
  if (!parsed) return false;
  for (const key of parsed.searchParams.keys()) {
    const lower = key.toLowerCase();
    if (!NON_SPECIFIC_QUERY_PARAMS.has(lower) && !lower.startsWith("utm_")) {
      return false;
    }
  }
  const pathname = parsed.pathname.replace(/\/+$/, "");
  if (!pathname) return true;
  if (/\.(?:pdf|docx?)$/i.test(pathname)) {
    const filename = pathname.split("/").pop() ?? "";
    return GENERIC_SERIES_PDF_NAME.test(filename);
  }
  return GENERIC_SERIES_REGULATIONS_PATH.test(pathname);
}

function hasPracticalFieldValue(entry: unknown): boolean {
  if (entry === null || entry === undefined) return false;
  if (typeof entry === "string") return entry.trim().length > 0;
  if (Array.isArray(entry)) return entry.length > 0;
  if (typeof entry !== "object") return Boolean(entry);
  const record = entry as Record<string, unknown>;
  if ("value" in record) {
    const val = record.value;
    if (val === null || val === undefined) return false;
    if (typeof val === "string") return val.trim().length > 0;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "object") return Object.keys(val as Record<string, unknown>).length > 0;
    return Boolean(val);
  }
  return Object.keys(record).length > 0;
}

/**
 * Determines whether a race still needs round-specific regulations discovery
 * or practical detail extraction from its available official/registration URLs.
 */
export function needsRoundRegulationsOrDetails(race: {
  regulations_url?: string | null;
  website_url?: string | null;
  registration_url?: string | null;
  practical_details?: Record<string, unknown> | null;
}): {
  needsRegulations: boolean;
  needsDetails: boolean;
  genericSeriesRules: boolean;
  missingCoreFields: string[];
} {
  const details = race.practical_details && typeof race.practical_details === "object" ? race.practical_details : {};
  const missingCoreFields = CORE_PRACTICAL_FIELDS.filter((field) => !hasPracticalFieldValue(details[field]));
  const genericSeriesRules = isGenericSeriesRegulationsUrl(race.regulations_url);
  const needsRegulations = !race.regulations_url || (genericSeriesRules && missingCoreFields.length >= 3);
  const needsDetails =
    missingCoreFields.length > 0 && Boolean(race.regulations_url || race.website_url || race.registration_url);
  return {
    needsRegulations,
    needsDetails,
    genericSeriesRules,
    missingCoreFields,
  };
}

function parseHttpUrl(raw: string | null | undefined): URL | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}

function normalizeUrl(url: URL): string {
  const clean = new URL(url.href);
  clean.hash = "";
  if (clean.pathname.length > 1) clean.pathname = clean.pathname.replace(/\/+$/, "");
  return clean.href;
}

function decodedUrl(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

function registrableDomain(hostname: string): string {
  const host = hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join(".");
  if (TWO_PART_TLDS.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

/**
 * True when `detailUrl` belongs to the same official host/registrable domain
 * as at least one URL in `hubUrls`. Rejects invalid/non-http(s) URLs and never
 * widens multi-tenant platforms (e.g. google.com, wordpress.com) across subdomains.
 */
export function isVerifiedDetailUrlForHub(
  detailUrl: string,
  hubUrls: (string | null | undefined)[],
): boolean {
  const target = parseHttpUrl(detailUrl);
  if (!target) return false;
  const targetHost = target.hostname.toLowerCase().replace(/^www\./, "");
  const targetDomain = registrableDomain(targetHost);

  for (const hubRaw of hubUrls) {
    const hub = parseHttpUrl(hubRaw);
    if (!hub) continue;
    const hubHost = hub.hostname.toLowerCase().replace(/^www\./, "");
    if (targetHost === hubHost) return true;
    const hubDomain = registrableDomain(hubHost);
    if (MULTI_TENANT_HOSTS.has(hubDomain) || MULTI_TENANT_HOSTS.has(targetDomain)) continue;
    if (targetDomain === hubDomain) return true;
  }
  return false;
}

function extractSeasonRanges(text: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  for (const match of text.matchAll(/(?<!\d)(20\d{2})\s*[-/]\s*(20\d{2}|\d{2})(?!\d)/g)) {
    const start = Number(match[1]);
    const rawEnd = match[2]!;
    const end = rawEnd.length === 2 ? Math.floor(start / 100) * 100 + Number(rawEnd) : Number(rawEnd);
    if (end === start + 1) ranges.push({ start, end });
  }
  return ranges;
}

function seasonMatchesDate(range: { start: number; end: number }, isoDate: string): boolean {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  if (month >= 8) return range.start === year && range.end === year + 1;
  if (month <= 5) return range.start === year - 1 && range.end === year;
  return range.start === year || range.end === year;
}

function extractStandaloneYears(text: string): number[] {
  // Strip ISO dates (YYYY-MM-DD) and season ranges (YYYY-YYYY / YYYY-YY) first
  const stripped = text
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, " ")
    .replace(/(?<!\d)20\d{2}\s*[-/]\s*(?:20\d{2}|\d{2})(?!\d)/g, " ");
  return [...stripped.matchAll(/(?<!\d)(20\d{2})(?!\d)/g)].map((m) => Number(m[1]));
}

function placeTokens(race: DetailSourceRace): string[] {
  const raw = [race.place, race.municipality].filter((v): v is string => Boolean(v && v.trim()));
  const tokens = new Set<string>();
  for (const item of raw) {
    for (const token of fold(item).match(/[a-z0-9]{3,}/g) ?? []) {
      tokens.add(token);
    }
  }
  return [...tokens];
}

function distinctiveRaceTokens(race: DetailSourceRace): string[] {
  const words = fold(race.name)
    .replace(/\b20\d{2}\b/g, " ")
    .match(/[a-z0-9]{3,}/g) ?? [];
  return [...new Set(words.filter((w) => !GENERIC_RACE_WORDS.has(w)))];
}

function tokenPresent(haystack: string, token: string): boolean {
  if (!token) return false;
  return new RegExp(`(?:^|[^a-z0-9])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9])`).test(haystack);
}

function allFullDatesIn(text: string): Set<string> {
  const dates = new Set<string>();
  for (const m of text.matchAll(/(?<![\d.])(\d{1,2})\.\s*(\d{1,2})\.?\s*(20\d{2})(?!\d)|(?<!\d)(20\d{2})-(\d{2})-(\d{2})(?!\d)/g)) {
    const iso = m[1]
      ? `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1].padStart(2, "0")}`
      : `${m[4]}-${m[5]}-${m[6]}`;
    dates.add(iso);
  }
  const monthNames = [
    "january|januar|leden|ledna|gennaio|stycznia|janvier",
    "february|februar|unor|unora|febbraio|lutego|fevrier",
    "march|marz|brezen|brezna|marzo|marca|mars",
    "april|duben|dubna|aprile|kwietnia|avril",
    "may|mai|kveten|kvetna|maggio|maja",
    "june|juni|cerven|cervna|giugno|czerwca|juin",
    "july|juli|cervenec|cervence|luglio|lipca|juillet",
    "august|srpen|srpna|agosto|sierpnia|aout",
    "september|zari|settembre|wrzesnia|septembre",
    "october|oktober|rijen|rijna|ottobre|pazdziernika|octobre",
    "november|listopad|listopadu|novembre|listopada",
    "december|dezember|prosinec|prosince|dicembre|grudnia|decembre",
  ];
  const folded = fold(text);
  monthNames.forEach((pattern, index) => {
    const mm = String(index + 1).padStart(2, "0");
    const dayFirst = new RegExp(`(?<!\\d)(\\d{1,2})(?:st|nd|rd|th|\\.)?\\s+(?:of\\s+)?(?:${pattern})\\b\\s*,?\\s*(20\\d{2})(?!\\d)`, "g");
    for (const m of folded.matchAll(dayFirst)) {
      dates.add(`${m[2]}-${mm}-${m[1]!.padStart(2, "0")}`);
    }
    const monthFirst = new RegExp(`\\b(?:${pattern})\\b\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s*(20\\d{2})(?!\\d)`, "g");
    for (const m of folded.matchAll(monthFirst)) {
      dates.add(`${m[2]}-${mm}-${m[1]!.padStart(2, "0")}`);
    }
  });
  return dates;
}

/**
 * Extract and rank candidate official detail URLs from a hub/calendar page.
 * Only links on the same official host/domain as `hubUrl` are accepted.
 */
export function extractOfficialDetailCandidates(
  hubUrl: string,
  links: DetailLink[],
  race: DetailSourceRace,
): string[] {
  const hub = parseHttpUrl(hubUrl);
  if (!hub) return [];
  const normalizedHub = normalizeUrl(hub);
  const hubDepth = hub.pathname.split("/").filter(Boolean).length;

  const pTokens = placeTokens(race);
  const rTokens = distinctiveRaceTokens(race);
  const raceYear = Number(race.date.slice(0, 4));
  const scored = new Map<string, number>();

  for (const link of links) {
    if (!link?.href) continue;
    let resolved: URL;
    try {
      resolved = new URL(link.href.trim(), hub);
    } catch {
      continue;
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;
    if (ASSET_EXTENSION.test(resolved.pathname)) continue;
    if (!isVerifiedDetailUrlForHub(resolved.href, [hubUrl])) continue;

    const canonical = normalizeUrl(resolved);
    if (canonical === normalizedHub) continue;

    const pathFolded = fold(decodedUrl(resolved.pathname + " " + resolved.search));
    const textFolded = fold(link.text ?? "");

    // Reject explicit conflicting season or year in the URL path
    const urlSeasons = extractSeasonRanges(pathFolded);
    if (urlSeasons.length > 0 && !urlSeasons.some((s) => seasonMatchesDate(s, race.date))) {
      continue;
    }
    const urlYears = extractStandaloneYears(pathFolded);
    if (urlYears.length > 0 && !urlYears.includes(raceYear) && !urlSeasons.some((s) => seasonMatchesDate(s, race.date))) {
      continue;
    }

    const placeInUrl = pTokens.filter((t) => tokenPresent(pathFolded, t)).length;
    const placeInText = pTokens.filter((t) => tokenPresent(textFolded, t)).length;
    const raceInUrl = rTokens.filter((t) => tokenPresent(pathFolded, t)).length;
    const raceInText = rTokens.filter((t) => tokenPresent(textFolded, t)).length;

    const identityHits = placeInUrl + placeInText + raceInUrl + raceInText;
    if (identityHits === 0) continue;

    let score = 0;
    score += placeInUrl * 12 + placeInText * 7;
    score += raceInUrl * 6 + raceInText * 4;

    if (urlSeasons.some((s) => seasonMatchesDate(s, race.date))) score += 10;
    else if (urlYears.includes(raceYear)) score += 6;
    else if (extractSeasonRanges(textFolded).some((s) => seasonMatchesDate(s, race.date))) score += 5;
    else if (extractStandaloneYears(textFolded).includes(raceYear)) score += 3;

    const depth = resolved.pathname.split("/").filter(Boolean).length;
    if (depth > hubDepth) score += 4;

    if (/\b(?:calendar|kalendar|event|race|round|etapa|zavod|propozice|info|detail)\b/i.test(pathFolded)) {
      score += 2;
    }
    if (NON_DETAIL_PATH_SEGMENT.test(pathFolded)) {
      score -= 8;
    }
    if (HUB_PATH_PATTERN.test(resolved.pathname)) {
      score -= 10;
    }

    if (score <= 0) continue;
    const prev = scored.get(canonical);
    if (prev === undefined || score > prev) {
      scored.set(canonical, score);
    }
  }

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]))
    .map(([url]) => url);
}

/**
 * Verify that a fetched candidate page is genuinely the official detail page
 * for THIS race, THIS place/municipality, and THIS edition/date.
 */
export function verifyOfficialDetailPage(
  candidateUrl: string,
  pageText: string,
  race: DetailSourceRace,
): DetailVerification {
  if (!pageText || !pageText.trim()) {
    return { ok: false, reason: "empty_page" };
  }
  const parsed = parseHttpUrl(candidateUrl);
  if (!parsed) {
    return { ok: false, reason: "invalid_url" };
  }

  const raceYear = Number(race.date.slice(0, 4));
  const pathFolded = fold(decodedUrl(parsed.pathname + " " + parsed.search));

  // 0. Reject generic calendar/series hub paths (e.g. /en/calendar or /en/regulations-en)
  // so resolveDetailSources follows links to the specific round detail page.
  if (CALENDAR_HUB_PATH.test(parsed.pathname) && !parsed.search) {
    return { ok: false, reason: "calendar_overview_not_detail" };
  }

  // 1. Reject URLs explicitly belonging to a different season or edition year.
  const urlSeasons = extractSeasonRanges(pathFolded);
  if (urlSeasons.length > 0 && !urlSeasons.some((s) => seasonMatchesDate(s, race.date))) {
    return { ok: false, reason: "wrong_edition_season" };
  }
  const urlYears = extractStandaloneYears(pathFolded);
  if (urlYears.length > 0 && !urlYears.includes(raceYear) && !urlSeasons.some((s) => seasonMatchesDate(s, race.date))) {
    return { ok: false, reason: "wrong_edition_year" };
  }

  // 2. Reject multi-round calendar/overview pages listing many distinct race dates.
  const allDates = allFullDatesIn(pageText);
  const otherDatesSameSeason = [...allDates].filter((d) => {
    if (d === race.date || (race.end_date && d >= race.date && d <= race.end_date)) return false;
    const dy = Number(d.slice(0, 4));
    return Math.abs(dy - raceYear) <= 1;
  });
  if (otherDatesSameSeason.length > 4) {
    return { ok: false, reason: "calendar_overview_not_detail" };
  }

  // 3. Require this race's date (or end_date) in the page text.
  const dateMatched =
    quoteContainsDate(pageText, race.date) ||
    allDates.has(race.date) ||
    Boolean(race.end_date && (quoteContainsDate(pageText, race.end_date) || allDates.has(race.end_date)));
  if (!dateMatched) {
    return { ok: false, reason: "date_mismatch" };
  }

  // 4. Require edition year support and reject pages tied only to a conflicting season.
  const head = pageText.slice(0, 2400);
  const headSeasons = extractSeasonRanges(head);
  if (
    headSeasons.length > 0 &&
    !headSeasons.some((s) => seasonMatchesDate(s, race.date)) &&
    !allDates.has(race.date)
  ) {
    return { ok: false, reason: "wrong_edition_season" };
  }
  if (!editionYearSupported(pageText, raceYear) && !fileStatesEdition(candidateUrl, raceYear)) {
    return { ok: false, reason: "wrong_edition_year" };
  }
  // If full dates appear in the document and none are from this race's year, reject.
  if (allDates.size > 0 && ![...allDates].some((d) => d.startsWith(`${raceYear}-`))) {
    return { ok: false, reason: "wrong_edition_year" };
  }

  // 5. Verify place/municipality in the opening content or URL slug.
  const pTokens = placeTokens(race);
  const headFolded = fold(head);
  if (pTokens.length > 0) {
    const placeMatch = pTokens.some((t) => tokenPresent(headFolded, t) || tokenPresent(pathFolded, t));
    if (!placeMatch) {
      return { ok: false, reason: "place_mismatch" };
    }
  }

  // 6. Verify race identity (distinctive name tokens or place already matched).
  const rTokens = distinctiveRaceTokens(race);
  const fullFolded = fold(pageText);
  if (rTokens.length > 0) {
    const needed = pTokens.length > 0 ? 1 : Math.min(2, rTokens.length);
    const matched = rTokens.filter((t) => tokenPresent(fullFolded, t) || tokenPresent(pathFolded, t)).length;
    if (matched < needed) {
      return { ok: false, reason: "race_identity_mismatch" };
    }
  }

  return { ok: true };
}

function looksLikeHubOrOverviewUrl(url: string, race: DetailSourceRace): boolean {
  const parsed = parseHttpUrl(url);
  if (!parsed) return false;
  if (HUB_PATH_PATTERN.test(parsed.pathname)) return true;
  const pathFolded = fold(decodedUrl(parsed.pathname));
  const pTokens = placeTokens(race);
  if (pTokens.length > 0 && pTokens.some((t) => tokenPresent(pathFolded, t))) {
    return false;
  }
  return true;
}

/**
 * Resolve the official detail URL for a race from its allowed official URLs
 * (such as regulations_url, website_url, or official sources).
 */
export async function resolveDetailSources(
  race: DetailSourceRace,
  options: {
    fetchPage: (url: string) => Promise<DetailPageSnapshot | null>;
    allowedUrls?: (string | null | undefined)[];
    previousMissingReason?: string | null;
    maxCandidates?: number;
  },
): Promise<ResolvedDetailSources> {
  const maxCandidates = Math.max(1, options.maxCandidates ?? 5);
  const baseUrls = [
    ...new Set(
      (options.allowedUrls ?? [])
        .map((u) => parseHttpUrl(u))
        .filter((u): u is URL => Boolean(u))
        .map((u) => u.href),
    ),
  ];

  const previousMissingReason = options.previousMissingReason ?? null;

  if (!baseUrls.length) {
    return {
      urls: [],
      officialDetailUrl: null,
      missingDetailReason: "official_detail_missing_in_allowed_sources: no allowed official URLs provided",
      previousMissingReason,
    };
  }

  const fetchedUrls = new Set<string>();
  const failureReasons: string[] = [];
  const tryCandidates = async (candidates: string[]): Promise<ResolvedDetailSources | null> => {
    for (const candidate of candidates.slice(0, maxCandidates)) {
      const key = normalizeUrl(new URL(candidate));
      if (fetchedUrls.has(key)) continue;
      fetchedUrls.add(key);

      const snapshot = await options.fetchPage(candidate).catch(() => null);
      if (!snapshot) {
        failureReasons.push("fetch_failed");
        continue;
      }
      const effectiveUrl = snapshot.url || candidate;
      if (!isVerifiedDetailUrlForHub(effectiveUrl, baseUrls)) {
        failureReasons.push("off_host_redirect");
        continue;
      }

      const check = verifyOfficialDetailPage(effectiveUrl, snapshot.text, race);
      if (check.ok) {
        const urls = [...new Set([effectiveUrl, ...baseUrls])];
        return {
          urls,
          officialDetailUrl: effectiveUrl,
          missingDetailReason: null,
          previousMissingReason,
        };
      }
      if (check.reason) failureReasons.push(check.reason);
    }
    return null;
  };

  // Inspect allowed URLs in priority order (regulations_url, website_url, then sources).
  // When an official hub/calendar page yields candidate round links on the same host,
  // verify those official round links before falling back to lower-priority third-party sources.
  for (const allowedUrl of baseUrls.slice(0, maxCandidates)) {
    const normalizedAllowed = normalizeUrl(new URL(allowedUrl));
    if (fetchedUrls.has(normalizedAllowed)) continue;
    fetchedUrls.add(normalizedAllowed);

    const snapshot = await options.fetchPage(allowedUrl).catch(() => null);
    if (!snapshot) continue;

    const effectiveUrl = snapshot.url || allowedUrl;
    const directCheck = verifyOfficialDetailPage(effectiveUrl, snapshot.text, race);
    if (directCheck.ok) {
      const urls = [...new Set([effectiveUrl, ...baseUrls])];
      return {
        urls,
        officialDetailUrl: effectiveUrl,
        missingDetailReason: null,
        previousMissingReason,
      };
    }

    if (looksLikeHubOrOverviewUrl(effectiveUrl, race) || directCheck.reason === "calendar_overview_not_detail") {
      const candidates = extractOfficialDetailCandidates(effectiveUrl, snapshot.links ?? [], race);
      const resolved = await tryCandidates(candidates);
      if (resolved) return resolved;
    }
  }

  const uniqueReasons = [...new Set(failureReasons)];
  const missingDetailReason = uniqueReasons.length
    ? `official_detail_missing_in_allowed_sources: candidates rejected (${uniqueReasons.join(", ")})`
    : "official_detail_missing_in_allowed_sources: no matching edition detail link found on allowed official pages";

  return {
    urls: baseUrls,
    officialDetailUrl: null,
    missingDetailReason,
    previousMissingReason,
  };
}
