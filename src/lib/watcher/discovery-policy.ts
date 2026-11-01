/** These links can enrich a known race, but must not become independent sources. */
export function isAuxiliaryDiscoveryUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const path = decodeURIComponent(url.pathname).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/\.(?:jpe?g|png|gif|webp|avif|svg|ico|gpx|kml|kmz|zip|mp4|mp3)(?:$|\/)/.test(path)) return true;
    // Match whole path segments, not race names such as Tour de Zeleňák.
    if (/(?:^|\/)(?:vysledky|ergebnisse|results|startovni-listina|startovni-listiny|startlist|startliste|meldeliste|galerie|fotogalerie|historie|archiv|archive|sponzoring|sponzorsky-program|podminky|kontakt|contact|impressum|datenschutz|o-nas|team)(?:[\/._-]|$)/.test(path)) return true;
    if (/informace-o-zpracovani-osobnich-udaju/.test(path)) return true;
    // Explicit entry/list endpoints, rather than generic race entry hubs which
    // sometimes contain the only regulations and dates (e.g. /zapisy).
    if (/\/(?:startlist|registration)\.aspx$|\/(?:reg_form|list_reg)[\w-]*\.php$|\/(?:anmeldung|rfc_registrace)\.php$|\/prihlaseni-na-zavod\//.test(path)) return true;
    return false;
  } catch { return true; }
}

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
