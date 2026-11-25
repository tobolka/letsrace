import { distinctiveWords } from "@/lib/catalog/race-completeness";
import { isAggregatorUrl, isCalendarPage, isDumpListingUrl } from "@/lib/watcher/public-url";

/**
 * A site can list its own documents: PDFs (via WordPress media or links/embeds)
 * and HTML regulations pages (like `/propozice/`, `/ausschreibung/`, or the
 * race's own page when it embeds its Propozice + Kategorie sections directly).
 */
export type SiteDocument = { url: string; date?: string; label?: string };

const folded = (text: string) => { let t = text; try { t = decodeURIComponent(text); } catch { /* as written */ } return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); };
const NOT_FOR_RACE = /depesche|newsletter|rundbrief|vereinszeitung|zpravodaj|certifi|privacy|gdpr|beitritt|aufnahme|satzung|stanovy|statut|menu|magazin|ergebnis|vysledk|wyniki|risultati|classifica|startlist|meldeliste|rechnung|faktur|idoneita|scan\d|logo|sponzor|sponsor|plakat|poster|flyer|letak|praktikum|stellenangebot|karriere/;
const REGULATIONS = /propoz|rozpis|razpis|regulamin|regolament|reglament|reglement|ausschreib|teilnahmebeding|renninfo|pokyn|pravilnik|versenykiir|szabalyzat|regulations|race[-_ ]?guide|technical[-_ ]?guide|guida[-_ ]?tecnica|guida|informator|organizac/;
const SELF_REGULATIONS_HEADING = /<h[1-6][^>]*>[^<]*(?:propozic|propozíci|rozpis|razpis|regulamin|regolament|reglament|règlement|reglement|ausschreib|pravilnik|versenykiír|regulations|race\s*guide|technical\s*guide)[^<]*<\/h[1-6]>/i;
const MEDIA_EXT = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|mp4|mp3|zip|gpx|kml)(?:$|\?)/i;

const bareHost = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };

/** The PDFs in a page's code: links, embeds, viewers and script strings alike. */
export function pdfsInCode(html: string, base: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(/(?:https?:)?(?:\\?\/){2}[^"'\s<>()]+?\.pdf(?:\?[^"'\s<>()]*)?|(?<=["'=])\/?[^"'\s<>():]+?\.pdf(?:\?[^"'\s<>()]*)?/gi)) {
    try { found.add(new URL(match[0].replace(/\\\//g, "/"), base).toString()); } catch { /* not an address */ }
  }
  return [...found];
}

/**
 * Same-site HTML pages that look like regulations (by URL path such as `/propozice/`
 * or anchor text such as `"Schuter cup – Propozice"`), plus the page itself when it
 * directly contains a regulations heading (e.g. an inline Propozice accordion).
 */
export function htmlRegulationsInCode(html: string, base: string): SiteDocument[] {
  const host = bareHost(base);
  if (!host) return [];
  const found = new Map<string, SiteDocument>();
  if (SELF_REGULATIONS_HEADING.test(html)) {
    try {
      const self = new URL(base);
      self.hash = "";
      if (self.pathname !== "/") found.set(self.toString(), { url: self.toString(), label: "propozice" });
    } catch { /* ignore */ }
  }
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi)) {
    const rawHref = (match[1] ?? match[2] ?? "").trim();
    if (!rawHref || /^(?:mailto:|tel:|javascript:|#)/i.test(rawHref) || /\.pdf(?:$|\?)/i.test(rawHref) || MEDIA_EXT.test(rawHref)) continue;
    let resolved: URL;
    try { resolved = new URL(rawHref, base); } catch { continue; }
    if (!/^https?:$/.test(resolved.protocol) || bareHost(resolved.toString()) !== host) continue;
    resolved.hash = "";
    const label = match[3]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const pathText = folded(resolved.pathname);
    const labelText = folded(label);
    if (NOT_FOR_RACE.test(pathText) || NOT_FOR_RACE.test(labelText)) continue;
    if (!REGULATIONS.test(pathText) && !REGULATIONS.test(labelText)) continue;
    const url = resolved.toString();
    if (!found.has(url)) found.set(url, { url, label: label || undefined });
  }
  return [...found.values()];
}

/** The files or pages likely to be this race's regulations, best first. Another year's or a form never is. */
export function regulationsCandidates(documents: SiteDocument[], race: { name: string; start_date: string }, max = 5): string[] {
  const year = race.start_date.slice(0, 4), words = distinctiveWords(race.name.split(/[—–]/).at(-1)!);
  const score = (document: SiteDocument) => {
    const cleanUrl = document.url.split(/[?#]/)[0]!.replace(/\/+$/, "");
    const tail = folded(cleanUrl.split("/").pop() ?? "");
    const path = folded(cleanUrl.replace(/^https?:\/\/[^/]+/, ""));
    const label = folded(document.label ?? "");
    const haystack = `${path} ${label}`;
    if (NOT_FOR_RACE.test(tail) || NOT_FOR_RACE.test(label)) return -1;
    const years: string[] = haystack.match(/(?<!\d)20\d{2}(?!\d)/g) ?? [];
    if (years.length && !years.includes(year)) return -1;
    const compact = haystack.replace(/[^a-z0-9]/g, "");
    const isPdf = /\.pdf$/i.test(cleanUrl);
    return (REGULATIONS.test(haystack) ? 4 : 0) + words.filter(word => compact.includes(word)).length * 3 + (years.includes(year) ? 2 : 0) + (isPdf ? 1 : 0);
  };
  return documents.map(document => ({ url: document.url, score: score(document) })).filter(document => document.score > 0).sort((a, b) => b.score - a.score).slice(0, max).map(document => document.url);
}

/** A race's own site, as far as we can tell: not a calendar or entry platform. */
export function siteOf(website: string | null | undefined): string | null {
  if (!website || isCalendarPage(website) || isAggregatorUrl(website) || isDumpListingUrl(website)) return null;
  try { return new URL(website).origin; } catch { return null; }
}

const get = (url: string) => fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; LetsRace race calendar)", accept: "*/*" }, signal: AbortSignal.timeout(8_000) }).catch(() => null);

/** Common regulations paths to probe when a site's homepage HTML links none (e.g. JS-rendered navigation). */
export function fallbackRegulationPaths(origin: string): string[] {
  const host = bareHost(origin);
  if (/\.cz$/.test(host)) return ["/propozice/", "/rozpis/"];
  if (/\.sk$/.test(host)) return ["/propozicie/", "/propozice/"];
  if (/\.(?:de|at|ch)$/.test(host)) return ["/ausschreibung/", "/reglement/"];
  if (/\.pl$/.test(host)) return ["/regulamin/"];
  if (/\.it$/.test(host)) return ["/regolamento/"];
  if (/\.(?:fr|be|nl)$/.test(host)) return ["/reglement/"];
  if (/\.es$/.test(host)) return ["/reglamento/"];
  if (/\.hu$/.test(host)) return ["/versenykiiras/"];
  if (/\.si$/.test(host)) return ["/razpis/"];
  if (/\.hr$/.test(host)) return ["/propozicije/", "/pravilnik/"];
  return ["/propozice/", "/regulations/", "/reglement/"];
}

/** Everything a site offers about its files and regulations pages. An error is simply fewer documents. */
export async function siteDocuments(origin: string, pages: string[] = []): Promise<SiteDocument[]> {
  const documents = new Map<string, SiteDocument>();
  const uniquePages = [...new Set([origin, ...pages])];
  const [wpRes, ...pageRes] = await Promise.all([
    get(`${origin}/wp-json/wp/v2/media?mime_type=application/pdf&per_page=100&_fields=source_url,date`),
    ...uniquePages.map(page => get(page)),
  ]);
  if (wpRes?.ok) {
    const list = await wpRes.json().catch(() => null) as { source_url?: string; date?: string }[] | null;
    if (Array.isArray(list)) for (const item of list) if (item.source_url) documents.set(item.source_url, { url: item.source_url, date: item.date });
  }
  for (let i = 0; i < uniquePages.length; i++) {
    const res = pageRes[i];
    const html = res?.ok ? await res.text().catch(() => "") : "";
    if (!html) continue;
    const base = res?.url || uniquePages[i]!;
    for (const url of pdfsInCode(html, base)) if (!documents.has(url)) documents.set(url, { url });
    for (const doc of htmlRegulationsInCode(html, base)) if (!documents.has(doc.url)) documents.set(doc.url, doc);
  }
  if (!documents.size) {
    for (const path of fallbackRegulationPaths(origin)) {
      const probe = `${origin}${path}`;
      const res = await get(probe);
      if (!res?.ok) continue;
      const finalUrl = res.url || probe;
      const finalPath = folded(new URL(finalUrl).pathname);
      if (!REGULATIONS.test(finalPath)) continue;
      documents.set(finalUrl, { url: finalUrl, label: path.replace(/\//g, "") });
      break;
    }
  }
  return [...documents.values()];
}
