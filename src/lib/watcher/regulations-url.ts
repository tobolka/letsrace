import * as cheerio from "cheerio";
import { isRegistrationPlatformUrl } from "@/lib/watcher/registration-url";

/** Path / filename looks like race regulations (page or PDF). */
const REGULATIONS_PATH =
  /propozic|ausschreibung|nennung|regulamin|regolamento|reglement|technical[-_/]?guide|race[-_/]?(guide|pack|info|brief)|notice[-_/]?of[-_/]?race|bulletin|pokyny|pravidla|rassegna|rozpis/i;

const REGULATIONS_TEXT =
  /propozic|ausschreibung|nennung|regulamin|regolamento|r[eè]glement|technical\s*guide|race\s*(guide|pack|info)|pokyny|pravidla|rozpis\s+kategori/i;

const SKIP =
  /facebook|instagram|youtube|youtu\.be|vysledk|výsled|fotogal|galerie|prihlask|prihlas|registrac|anmeld|zapisy|entrywall|eztiming|datasport|raceresult|startovk|gdpr|privacy|cookie|osobn[ií]ch.{0,24}[uú]daj|ochrane-osobnich|prohlaseni-o-ochrane|obchodn[ií].{0,12}podm/i;

const AGGREGATOR_HOST =
  /(?:^|\.)(sumator\.cz|hynekmusil\.cz|eventivsport\.com|mtbs\.cz|velokal\.de|radsport-events\.de)$/i;

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function absUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function isPdf(url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(url);
}

function isAggregatorHost(url: string): boolean {
  const host = hostOf(url);
  return Boolean(host && AGGREGATOR_HOST.test(host));
}

export function isRegulationsUrl(url: string | null | undefined): boolean {
  const u = (url || "").trim();
  if (!u || !/^https?:\/\//i.test(u)) return false;
  if (isAggregatorHost(u) || isRegistrationPlatformUrl(u) || SKIP.test(u)) return false;
  return REGULATIONS_PATH.test(u) || isPdf(u);
}

function scoreCandidate(url: string, text: string, pageHost: string): number {
  const blob = `${url} ${text}`;
  if (SKIP.test(blob) || SKIP.test(url)) return -100;
  if (isRegistrationPlatformUrl(url)) return -100;
  if (isAggregatorHost(url)) return -50;
  let s = 0;
  if (REGULATIONS_PATH.test(url)) s += 6;
  if (REGULATIONS_TEXT.test(text)) s += 5;
  if (isPdf(url)) s += 4;
  const host = hostOf(url);
  if (host && host === pageHost) s += 1;
  return s;
}

function sameDocument(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    const path = (p: string) => p.replace(/\/+$/, "") || "/";
    return (
      ua.protocol === ub.protocol &&
      ua.host.replace(/^www\./i, "") === ub.host.replace(/^www\./i, "") &&
      path(ua.pathname) === path(ub.pathname)
    );
  } catch {
    return false;
  }
}

function collectHits(pageUrl: string, html: string): { url: string; score: number }[] {
  const $ = cheerio.load(html);
  const pageHost = hostOf(pageUrl) ?? "";
  const byUrl = new Map<string, number>();

  const consider = (href: string | undefined, text: string) => {
    if (!href) return;
    const abs = absUrl(href, pageUrl);
    if (!abs) return;
    if (sameDocument(abs, pageUrl) && !isPdf(abs) && !REGULATIONS_PATH.test(abs)) return;
    const score = scoreCandidate(abs, text.replace(/\s+/g, " ").trim(), pageHost);
    if (score < 5) return;
    byUrl.set(abs, Math.max(byUrl.get(abs) ?? 0, score));
  };

  $("a[href]").each((_, el) => {
    consider($(el).attr("href"), $(el).text());
  });
  $("iframe[src], embed[src], object[data]").each((_, el) => {
    consider($(el).attr("src") || $(el).attr("data"), "pdf");
  });

  return [...byUrl.entries()]
    .map(([url, score]) => ({ url, score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Best regulations / propozice link on a race page (HTML page or PDF).
 * Returns null on busy calendars with many different documents (ambiguous).
 */
export function findRegulationsUrl(pageUrl: string, html: string): string | null {
  if (isRegulationsUrl(pageUrl)) return pageUrl.split("#")[0] ?? pageUrl;
  const hits = collectHits(pageUrl, html);
  if (!hits.length) return null;
  const urls = [...new Set(hits.map((h) => h.url))];
  if (urls.length > 3) return null;
  return hits[0]?.url ?? null;
}

export function preferRegulationsUrl(
  incoming: string | null | undefined,
  existing: string | null | undefined,
): string | null {
  const a = (incoming || "").trim() || null;
  const b = (existing || "").trim() || null;
  if (!a) return b;
  if (!b) return a;
  if (isPdf(a) && !isPdf(b)) return a;
  return b;
}

export function attachRegulationsUrl<T extends { regulationsUrl?: string }>(
  pageUrl: string,
  html: string,
  events: T[],
): T[] {
  const found = findRegulationsUrl(pageUrl, html);
  if (!found) return events;
  return events.map((e) => (e.regulationsUrl ? e : { ...e, regulationsUrl: found }));
}
