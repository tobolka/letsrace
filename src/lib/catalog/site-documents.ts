import { distinctiveWords } from "@/lib/catalog/race-completeness";
import { isAggregatorUrl, isCalendarPage, isDumpListingUrl } from "@/lib/watcher/public-url";

/**
 * A site can list its own documents. WordPress, which more than half of the race sites we measured
 * run on, answers with every PDF it holds, including ones no page links and no search engine has found.
 * Measured on 44 race sites without regulations: 18 listed PDFs this way, 9 linked one from the front page.
 */
export type SiteDocument = { url: string; date?: string };

const folded = (text: string) => { let t = text; try { t = decodeURIComponent(text); } catch { /* as written */ } return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); };
const NOT_FOR_RACE = /certifi|privacy|gdpr|beitritt|aufnahme|satzung|stanovy|statut|menu|magazin|ergebnis|vysledk|wyniki|risultati|classifica|startlist|meldeliste|rechnung|faktur|idoneita|scan\d|logo|sponzor|sponsor|plakat|poster|flyer|letak/;
const REGULATIONS = /propoz|rozpis|regulamin|regolament|reglement|ausschreib|pokyn|race[-_ ]?guide|technical[-_ ]?guide|guida|informator|organizac/;

/** The PDFs in a page's code: links, embeds, viewers and script strings alike. */
export function pdfsInCode(html: string, base: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(/(?:https?:)?(?:\\?\/){2}[^"'\s<>()]+?\.pdf(?:\?[^"'\s<>()]*)?|(?<=["'=])\/?[^"'\s<>():]+?\.pdf(?:\?[^"'\s<>()]*)?/gi)) {
    try { found.add(new URL(match[0].replace(/\\\//g, "/"), base).toString()); } catch { /* not an address */ }
  }
  return [...found];
}

/** The files likely to be this race's regulations, best first. Another year's or a form never is. */
export function regulationsCandidates(documents: SiteDocument[], race: { name: string; start_date: string }, max = 5): string[] {
  const year = race.start_date.slice(0, 4), words = distinctiveWords(race.name.split(/[—–]/).at(-1)!);
  const score = (url: string) => {
    const file = folded(url.split(/[?#]/)[0]!.split("/").pop() ?? "");
    if (NOT_FOR_RACE.test(file)) return -1;
    const years: string[] = file.match(/(?<!\d)20\d{2}(?!\d)/g) ?? [];
    if (years.length && !years.includes(year)) return -1;
    return (REGULATIONS.test(file) ? 4 : 0) + words.filter(word => file.replace(/[^a-z0-9]/g, "").includes(word)).length * 3 + (years.includes(year) ? 2 : 0);
  };
  return documents.map(document => ({ url: document.url, score: score(document.url) })).filter(document => document.score > 0).sort((a, b) => b.score - a.score).slice(0, max).map(document => document.url);
}

/** A race's own site, as far as we can tell: not a calendar or entry platform. */
export function siteOf(website: string | null | undefined): string | null {
  if (!website || isCalendarPage(website) || isAggregatorUrl(website) || isDumpListingUrl(website)) return null;
  try { return new URL(website).origin; } catch { return null; }
}

const get = (url: string) => fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; LetsRace race calendar)", accept: "*/*" }, signal: AbortSignal.timeout(15_000) }).catch(() => null);

/** Everything a site offers about its files. An error is simply fewer documents. */
export async function siteDocuments(origin: string, pages: string[] = []): Promise<SiteDocument[]> {
  const documents = new Map<string, SiteDocument>();
  const response = await get(`${origin}/wp-json/wp/v2/media?mime_type=application/pdf&per_page=100&_fields=source_url,date`);
  if (response?.ok) {
    const list = await response.json().catch(() => null) as { source_url?: string; date?: string }[] | null;
    if (Array.isArray(list)) for (const item of list) if (item.source_url) documents.set(item.source_url, { url: item.source_url, date: item.date });
  }
  for (const page of [...new Set([origin, ...pages])]) {
    const html = await get(page).then(result => result?.ok ? result.text() : "").catch(() => "");
    for (const url of pdfsInCode(html, page)) if (!documents.has(url)) documents.set(url, { url });
  }
  return [...documents.values()];
}
