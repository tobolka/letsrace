/** Aggregator calendars — never show these as the race “Website” link. */
const AGGREGATOR_HOSTS = [
  "sumator.cz",
  "hynekmusil.cz",
  "eventivsport.com",
];

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

/** Prefer an official race URL; drop aggregator calendars. */
export function publicRaceUrl(
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const c of candidates) {
    const u = (c || "").trim();
    if (!u) continue;
    if (isAggregatorUrl(u)) continue;
    if (!/^https?:\/\//i.test(u)) continue;
    return u;
  }
  return null;
}
