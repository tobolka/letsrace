import { load } from "cheerio";
import { discoveryUrl } from "./plan";

const SOCIAL_HOST = /(^|\.)(facebook\.com|instagram\.com|youtube\.com|tiktok\.com|x\.com|twitter\.com|strava\.com)$/i;
const CALENDAR_SUBPAGE = /\/(?:kalendar|kalendář|kalendarz|kalender|calendario|calendar|zavody|závody|preteky|termine|wyscigi|wyścigi|gare|akce|events?|propozice|ausschreibung|regulamin)(?:[/?#.-]|$)/i;

/**
 * Extract high-value follow-up URLs from a discovered page:
 * 1) Bikepoint's explicit organiser block.
 * 2) Same-host calendar/race subpages on club and organiser websites so a homepage
 *    automatically leads discovery to `/kalendar`, `/zavody`, `/termine`, etc.
 */
export function organizerLinks(html: string, sourceUrl: string): string[] {
  const source = discoveryUrl(sourceUrl);
  if (!source) return [];
  const parsed = new URL(source);
  const sourceHost = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const $ = load(html);
  const urls = new Set<string>();

  if (/^bikepoint\.sk$/i.test(sourceHost) && /^\/kalendar\/[^/]+\/\d{2}-\d{2}-\d{4}\/[^/]+\/?$/.test(parsed.pathname)) {
    $(".organizator a[href]").each((_, element) => {
      const link = $(element), href = link.attr("href")?.trim();
      if (!href || href.startsWith("#")) return;
      // An explicit role label matters: the same page has registration/sponsor links.
      if (!/^organizátor\s*:/i.test(link.closest(".organizator").find("strong").first().text().trim())) return;
      let url: string | null;
      try { url = discoveryUrl(new URL(href, source).toString()); } catch { return; }
      if (!url) return;
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (host === "bikepoint.sk" || SOCIAL_HOST.test(host)) return;
      urls.add(url);
    });
    return [...urls].slice(0, 2);
  }

  // On organiser / club sites, follow at most 3 same-host calendar/race subpages.
  $("a[href]").each((_, element) => {
    if (urls.size >= 3) return;
    const href = $(element).attr("href")?.trim();
    if (!href || href.startsWith("#") || /^(?:mailto:|tel:|javascript:)/i.test(href)) return;
    let url: string | null;
    try { url = discoveryUrl(new URL(href, source).toString()); } catch { return; }
    if (!url || url === source) return;
    const target = new URL(url);
    const host = target.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== sourceHost || SOCIAL_HOST.test(host)) return;
    if (CALENDAR_SUBPAGE.test(target.pathname)) urls.add(url);
  });
  return [...urls];
}
