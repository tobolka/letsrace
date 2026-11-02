import { getSiteUrl } from "@/lib/seo";
import { ANNOUNCED_RACE_LOCALES, SITEMAP_HUBS, raceSitemapId, sitemapPath } from "@/lib/sitemap-sections";

/**
 * Sitemap index at the address Search Console and robots.txt already know.
 * It names the hub file and the race files of the languages Google is asked to
 * crawl first; see ANNOUNCED_RACE_LOCALES.
 */
export function GET() {
  const base = getSiteUrl();
  const ids = [SITEMAP_HUBS, ...ANNOUNCED_RACE_LOCALES.map(raceSitemapId)];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...ids.map((id) => `<sitemap><loc>${base}${sitemapPath(id)}</loc></sitemap>`),
    "</sitemapindex>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
