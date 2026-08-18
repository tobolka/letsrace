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
    return host === "iprimacup.cz" && path === "/prihlaseni";
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

export function isRegistrationPlatformUrl(url: string | null | undefined): boolean {
  if (isSeriesRegistrationHubUrl(url)) return false;
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
    .filter((u) => !isSeriesRegistrationHubUrl(u));
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
