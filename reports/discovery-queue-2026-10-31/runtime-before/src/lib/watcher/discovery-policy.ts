/** Archives can enrich a known race, but are not new independent race leads. */
export function isArchiveDiscoveryUrl(raw: string, year = new Date().getUTCFullYear()): boolean {
  try {
    const url = new URL(raw);
    const path = decodeURIComponent(url.pathname).toLowerCase();
    if (/\/(?:tag|category|ergebnisse|results|meldelisten)(?:[\/_-]|\.|$)|presseinformation|ergebnisse-.*online/.test(path)) return true;
    // Legacy calendars encode the season as ?2002|0, not in the pathname.
    const queryYears = [...decodeURIComponent(url.search).matchAll(/(?:^|[?&=|])(20\d{2})(?=[|&]|$)/g)].map(m => Number(m[1]));
    const years = [...path.matchAll(/\b20\d{2}\b/g)].map(m => Number(m[0])).concat(queryYears);
    return years.length > 0 && Math.max(...years) < year;
  } catch { return true; }
}
