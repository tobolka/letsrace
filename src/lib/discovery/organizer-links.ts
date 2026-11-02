import { load } from "cheerio";
import { discoveryUrl } from "./plan";

/** Bikepoint's event-specific organizer block, never advertisements or the calendar table. */
export function organizerLinks(html: string, sourceUrl: string): string[] {
  const source = discoveryUrl(sourceUrl);
  if (!source) return [];
  const parsed = new URL(source);
  if (!/^(?:www\.)?bikepoint\.sk$/i.test(parsed.hostname) || !/^\/kalendar\/[^/]+\/\d{2}-\d{2}-\d{4}\/[^/]+\/?$/.test(parsed.pathname)) return [];
  const $ = load(html);
  const urls = new Set<string>();
  $(".organizator a[href]").each((_, element) => {
    const link = $(element), href = link.attr("href")?.trim();
    if (!href || href.startsWith("#")) return;
    // An explicit role label matters: the same page has registration/sponsor links.
    if (!/^organizátor\s*:/i.test(link.closest(".organizator").find("strong").first().text().trim())) return;
    let url: string | null;
    try { url = discoveryUrl(new URL(href, source).toString()); } catch { return; }
    if (!url) return;
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "bikepoint.sk" || /(^|\.)(facebook\.com|instagram\.com|youtube\.com|tiktok\.com|x\.com)$/.test(host)) return;
    urls.add(url);
  });
  return [...urls].slice(0, 2);
}
