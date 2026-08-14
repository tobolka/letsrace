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
  const host = hostOf(url);
  if (!host) return false;
  return AGGREGATOR_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
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
    if (isAggregatorUrl(u)) continue;
    if (HUB_OR_LOGIN.test(u)) continue;
    return u;
  }
  return null;
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
  seriesWebsiteUrl?: string | null;
  sourceUrls?: (string | null | undefined)[];
}): {
  websiteUrl: string | null;
  registrationUrl: string | null;
  listingUrl: string | null;
} {
  const sources = input.sourceUrls ?? [];
  const websiteUrl = publicRaceUrl(
    input.websiteUrl,
    input.seriesWebsiteUrl,
    ...sources,
  );
  const registrationUrl = publicRaceUrl(input.registrationUrl);
  const listingUrl = websiteUrl ? null : calendarListingUrl(...sources);
  return { websiteUrl, registrationUrl, listingUrl };
}
