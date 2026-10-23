/** Archives can enrich a known race, but are not new independent race leads. */
export function isArchiveDiscoveryUrl(raw: string, year = new Date().getUTCFullYear()): boolean {
  try {
    const path = decodeURIComponent(new URL(raw).pathname).toLowerCase();
    if (/\/(?:tag|category|ergebnisse|results|meldelisten)(?:[\/_-]|\.|$)|presseinformation|ergebnisse-.*online/.test(path)) return true;
    const years = [...path.matchAll(/\b20\d{2}\b/g)].map(m => Number(m[0]));
    return years.length > 0 && Math.max(...years) < year;
  } catch { return true; }
}
