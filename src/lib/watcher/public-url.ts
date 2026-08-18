import { pickRegistrationUrl } from "@/lib/watcher/registration-url";
import { isRegulationsUrl } from "@/lib/watcher/regulations-url";

/** Aggregator calendars — never show these as the race “Website” link. */
const AGGREGATOR_HOSTS = [
  "sumator.cz",
  "hynekmusil.cz",
  "eventivsport.com",
  "jihoceskymtbpohar.cz",
  "maraton.cz",
  "mtbs.cz",
  "velokal.de",
  "radsport-events.de",
  "jiskra.potocky.cz",
  "mso.swiss",
];

/** Federation / media dumps — a pin, not an official race page. */
const DUMP_HOSTS = [
  ...AGGREGATOR_HOSTS,
  "cyclingaustria.at",
  "portal.cyclingaustria.at",
  "bikeguideaustria.at",
  "swiss-cycling.ch",
  "cyklistikaszc.sk",
  "federciclismo.it",
  "uci.org",
  "uec.ch",
  "granfondoguide.com",
  "velowire.com",
  "cyclinghero.cc",
  "cyclingstage.com",
  "sportivebreaks.com",
  "domestiquecycling.com",
  "finishers.com",
  "soof.sk",
];

const SOCIAL_HOSTS = ["facebook.com", "instagram.com", "twitter.com", "x.com", "youtube.com"];

const HUB_OR_LOGIN =
  /members\.federciclismo\.it|uci\.org\/competition-details|mijn\.knwu\.nl|kenniscentrum\.knwu\.nl|swiss-cycling\.ch\/.*\/kalender|cyclingaustria\.at\/.*kalender/i;

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function isAggregatorUrl(url: string | null | undefined): boolean {
  return hostMatches(url, AGGREGATOR_HOSTS);
}

export function isDumpListingUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (HUB_OR_LOGIN.test(url)) return true;
  return hostMatches(url, DUMP_HOSTS) || hostMatches(url, SOCIAL_HOSTS);
}

function hostMatches(url: string | null | undefined, hosts: string[]): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return hosts.some((h) => host === h || host.endsWith(`.${h}`));
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** Prefer an official race URL; drop aggregator calendars. Official homepages are allowed. */
export function publicRaceUrl(
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const c of candidates) {
    const u = (c || "").trim();
    if (!u || !isHttpUrl(u)) continue;
    if (isDumpListingUrl(u)) continue;
    return u;
  }
  return null;
}

function officialDepth(url: string): number {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "") || "/";
    if (path === "/") return 1;
    if (
      /^\/(zavody-?\d*|kalendar|kalendare|termine|prihlaseni|prihlasky|anmeldung)$/i.test(
        path,
      )
    ) {
      return 2;
    }
    if (isRegulationsUrl(url)) return 3;
    return 10 + path.split("/").filter(Boolean).length * 8;
  } catch {
    return 0;
  }
}

/** Keep a same-host race page (`/26-hk/`) over a listing, homepage, or /prihlaseni. */
export function preferDeeperOfficialUrl(
  incoming: string | null | undefined,
  existing: string | null | undefined,
): string | null {
  const next = publicRaceUrl(incoming);
  const prev = publicRaceUrl(existing);
  if (!next) return prev;
  if (!prev) return next;
  if (isRegulationsUrl(prev) && !isRegulationsUrl(next)) return next;
  if (isRegulationsUrl(next) && !isRegulationsUrl(prev)) return prev;
  try {
    const a = new URL(next);
    const b = new URL(prev);
    const hostA = a.hostname.replace(/^www\./i, "").toLowerCase();
    const hostB = b.hostname.replace(/^www\./i, "").toLowerCase();
    if (hostA !== hostB) return next;
    return officialDepth(next) >= officialDepth(prev) ? next : prev;
  } catch {
    /* ignore */
  }
  return next;
}

/** Last-resort outbound link (aggregator calendar listing) when no official site exists. */
export function calendarListingUrl(
  ...candidates: (string | null | undefined)[]
): string | null {
  const urls = candidates
    .map((c) => (c || "").trim())
    .filter((u) => u && isHttpUrl(u) && !HUB_OR_LOGIN.test(u));
  if (!urls.length) return null;
  urls.sort((a, b) => scoreListing(b) - scoreListing(a));
  return urls[0] ?? null;
}

function scoreListing(url: string): number {
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/+$/, "").length + u.search.length;
  } catch {
    return 0;
  }
}

export function resolveEventOutboundUrls(input: {
  websiteUrl?: string | null;
  registrationUrl?: string | null;
  regulationsUrl?: string | null;
  seriesWebsiteUrl?: string | null;
  sourceUrls?: (string | null | undefined)[];
}): {
  websiteUrl: string | null;
  registrationUrl: string | null;
  listingUrl: string | null;
  regulationsUrl: string | null;
} {
  const sources = input.sourceUrls ?? [];
  let websiteUrl = publicRaceUrl(input.websiteUrl);
  for (const c of sources) {
    const u = publicRaceUrl(c);
    if (!u) continue;
    websiteUrl = preferDeeperOfficialUrl(u, websiteUrl);
  }
  if (!websiteUrl) websiteUrl = publicRaceUrl(input.seriesWebsiteUrl);
  const registrationUrl = pickRegistrationUrl(input.registrationUrl, ...sources);
  let regulationsUrl = publicRaceUrl(input.regulationsUrl);

  if (websiteUrl && registrationUrl && websiteUrl === registrationUrl) {
    websiteUrl = null;
  }

  if (websiteUrl && isRegulationsUrl(websiteUrl)) {
    regulationsUrl = regulationsUrl || websiteUrl;
    websiteUrl = publicRaceUrl(
      input.seriesWebsiteUrl,
      ...sources.filter((s) => s && s !== websiteUrl && !isRegulationsUrl(s)),
    );
    if (websiteUrl && regulationsUrl && websiteUrl === regulationsUrl) websiteUrl = null;
  }

  if (regulationsUrl && (regulationsUrl === registrationUrl || regulationsUrl === websiteUrl)) {
    if (regulationsUrl === registrationUrl) regulationsUrl = null;
  }

  const websiteClean = websiteUrl;
  const listingUrl =
    websiteClean || registrationUrl ? null : calendarListingUrl(...sources);
  if (regulationsUrl && regulationsUrl === listingUrl) regulationsUrl = null;
  return { websiteUrl: websiteClean, registrationUrl, listingUrl, regulationsUrl };
}
