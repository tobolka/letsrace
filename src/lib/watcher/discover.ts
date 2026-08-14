import * as cheerio from "cheerio";

const RACE_HINT =
  /zavod|závod|race|cup|maraton|marathon|kalendar|kalendář|event|xc|xcm|gravel|casovka|časovka|wh\/|junior|talent/i;

/** Sumator filter fragments like /xc,dh,event,road — not real race pages */
function isJunkSumatorUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/sumator\.cz|jihoceskymtbpohar\.cz/i.test(u.hostname)) return false;
    const path = u.pathname.replace(/\/$/, "") || "/";
    if (path === "/") return false;
    if (path.startsWith("/race/")) return false;
    if (path.startsWith("/races/")) return false;
    if (path.startsWith("/cup/")) return false;
    // filter toggle URLs: /xc,dh,event,...
    if (/^\/[a-z0-9,]+$/i.test(path) && path.includes(",")) return true;
    if (/race_type_filter=/.test(u.search) && !path.startsWith("/race/")) return true;
    return false;
  } catch {
    return false;
  }
}

export function discoverChildLinks(baseUrl: string, html: string): string[] {
  const $ = cheerio.load(html);
  const origin = new URL(baseUrl).origin;
  const host = new URL(baseUrl).hostname.replace(/^www\./, "");
  const found = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
    let absolute: string;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch {
      return;
    }
    if (!absolute.startsWith("http")) return;
    absolute = absolute.split("#")[0].replace(/\/$/, "") || absolute;
    if (isJunkSumatorUrl(absolute)) return;

    // Sumator: follow cup/series calendars, not every /race detail
    if (host.includes("sumator.cz") || host.includes("jihoceskymtbpohar.cz")) {
      try {
        const path = new URL(absolute).pathname;
        if (path.startsWith("/cup/")) {
          found.add(absolute.split("?")[0]);
        }
      } catch {
        /* ignore */
      }
      return;
    }

    // MTBS: calendar article pages
    if (host.includes("mtbs.cz")) {
      try {
        const path = new URL(absolute).pathname;
        if (!path.startsWith("/clanek/")) return;
      } catch {
        return;
      }
      found.add(absolute.split("?")[0]);
      return;
    }

    // Hynek: queue series filter pages (?serialosss=tc → Talent Cup races)
    if (host.includes("hynekmusil.cz")) {
      try {
        const u = new URL(absolute);
        const code = u.searchParams.get("serialosss");
        if (code && code.trim()) {
          found.add(`https://hynekmusil.cz/?serialosss=${encodeURIComponent(code)}`);
        }
      } catch {
        /* ignore */
      }
      return;
    }

    const label = $(el).text();
    if (RACE_HINT.test(absolute) || RACE_HINT.test(label)) {
      if (absolute.startsWith(origin) || RACE_HINT.test(absolute)) {
        found.add(absolute);
      }
    }
  });

  return [...found].filter((u) => u !== baseUrl.replace(/\/$/, "")).slice(0, 40);
}
