/**
 * Detect registration / timing platforms so scraped source URLs can become enter links.
 */

const REGISTRATION_HOSTS = [
  "raceresult.com",
  "my.raceresult.com",
  "datasport.com",
  "datasport.de",
  "datasport.com",
  "racemap.com",
  "chronorace.be",
  "sportsoft.cz",
  "sporsek.cz",
  "time-and-voice.com",
  "runtix.com",
  "njuko.com",
  "nazavody.cz",
  "sportt.cz",
  "eztiming.eu",
  "entrywall.com",
  "raceid.com",
  "athlinks.com",
  "sportity.com",
  "tapio.events",
  "liveheats.com",
  "webscorer.com",
  "sportmaniacs.com",
  "endu.net",
  "mylaps.com",
  "racesonline.com",
  "anmeldeservice",
];

const REGISTRATION_PATH =
  /\/(anmeldung|anmelden|registration|register|inscription|inschrijven|prihlask|prihlas|zapisy|entry|entries|signup|sign-up|registrace)(\/|$|\?)/i;

/** Series-wide entry hubs — not a race page, don't steal the primary outbound link. */
export function isSeriesRegistrationHubUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return (
      (host === "iprimacup.cz" && path === "/prihlaseni") ||
      (host === "enduroserie.cz" && path === "/registrace")
    );
  } catch {
    return false;
  }
}

export function hostOfUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Start lists / bib PDFs — not an enter link. */
/**
 * Account and mailing-list pages dressed up as an entry link.
 *
 * A sign-in form is not a race entry: seven iXS Downhill Cup rounds pointed at
 * `/en/login`, and nine Austrian races at the federation's
 * `#newsletter-anmeldung` anchor. Both render as a working "Register" button on
 * the card and send the rider nowhere. Missing is better than misleading.
 */
const ACCOUNT_OR_NEWSLETTER =
  /\/(login|signin|sign-in|anmelden|prihlaseni|prihlasenie|logowanie|accedi|connexion|account|my-?account|user\/login|wp-login)(\/|\?|$)|newsletter|mailchimp\.com|\/subscribe(\/|\?|$)/i;

/** True for sign-in and mailing-list URLs, which are never a race's own link. */
export function isAccountOrNewsletterUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return ACCOUNT_OR_NEWSLETTER.test(url);
}

export function isStartListUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /startovk|startlist|startovn[ií][\s_-]?cas/i.test(url);
}

export function isRegistrationPlatformUrl(url: string | null | undefined): boolean {
  if (isSeriesRegistrationHubUrl(url) || isStartListUrl(url)) return false;
  const host = hostOfUrl(url);
  if (!host) return false;
  if (REGISTRATION_HOSTS.some((h) => host === h || host.endsWith(`.${h}`) || host.includes(h))) {
    return true;
  }
  try {
    const u = new URL(url!);
    if (REGISTRATION_PATH.test(`${u.pathname}${u.search}`)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Best registration URL from an explicit field + scraped sources. */
export function pickRegistrationUrl(
  explicit: string | null | undefined,
  ...sources: (string | null | undefined)[]
): string | null {
  const candidates = [explicit, ...sources]
    .map((u) => (u || "").trim())
    .filter((u) => /^https?:\/\//i.test(u))
    .filter(
      (u) =>
        !isSeriesRegistrationHubUrl(u) &&
        !isStartListUrl(u) &&
        !isAccountOrNewsletterUrl(u),
    );
  for (const u of candidates) {
    if (isRegistrationPlatformUrl(u)) return u;
  }
  if (
    explicit &&
    /^https?:\/\//i.test(explicit.trim()) &&
    !isSeriesRegistrationHubUrl(explicit)
  ) {
    return explicit.trim();
  }
  return null;
}
