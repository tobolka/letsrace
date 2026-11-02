import { locales, type Locale } from "@/lib/i18n/messages";

/**
 * The sitemap is split so Search Console reports each part on its own row:
 * one file of hub pages (home, lists, countries, collections, series) in every
 * language, and one file of race pages per language. A single 9,500-URL file
 * only ever said "2 indexed, 10,000 discovered" without saying of what.
 */
export const SITEMAP_HUBS = "hubs";
export const raceSitemapId = (locale: Locale) => `races-${locale}`;

export const SITEMAP_IDS = [SITEMAP_HUBS, ...locales.map(raceSitemapId)];

/**
 * Race sitemaps the index announces. Google indexed almost nothing from the
 * full catalogue at once, so it starts with the hubs and the Czech and English
 * races; the other languages join once those are being crawled. Their files
 * still exist and the pages are still linked through hreflang.
 */
export const ANNOUNCED_RACE_LOCALES: readonly Locale[] = ["cs", "en"];

export const sitemapPath = (id: string) => `/sitemaps/sitemap/${id}.xml`;
