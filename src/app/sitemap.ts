import type { MetadataRoute } from "next";
import { locales, type Locale } from "@/lib/i18n/messages";
import { listSitemapEvents, listSitemapSeries } from "@/lib/events";
import { listQualifyingHubs } from "@/lib/discipline-hubs";
import { PUBLIC_COUNTRY_CODES } from "@/lib/geo/europe";
import { absoluteUrl, localeAlternates } from "@/lib/seo";
import { listCollectionSummaries } from "@/lib/race-collection-data";
import { MIN_COLLECTION_RACES } from "@/lib/race-collections";
import { collectionPath, hubPath, localePath } from "@/lib/localized-paths";

// Built at most once an hour and served from the cache: a crawler never waits on the
// database, which a cold start could make slow enough for it to give up.
export const revalidate = 3600;

type Freq = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  /**
   * Every language of a page as an entry of its own, each naming the others.
   * Only the English address used to be listed, with the rest as alternates:
   * the Czech, Polish and Slovak pages — the ones people here search in — were
   * left for Google to find by itself, and the queries it showed us were all
   * English.
   */
  const add = (path: string | ((l: Locale) => string), lastModified: Date | undefined, changeFrequency: Freq, priority: number) => {
    const languages = localeAlternates(path);
    for (const l of locales) {
      // A string is an internal path (`e/slug`), translated for each language.
      const url = typeof path === "function" ? absoluteUrl(`/${l}/${path(l)}`) : absoluteUrl(localePath(l, path));
      entries.push({
        url,
        lastModified,
        changeFrequency,
        priority,
        alternates: { languages },
      });
    }
  };

  // The bare domain is not listed: it redirects to a language.
  add("", now, "hourly", 1);

  add((l) => hubPath(l), now, "daily", 0.9);
  add("about", new Date("2026-10-10"), "monthly", 0.5);
  for (const code of PUBLIC_COUNTRY_CODES) add((l) => hubPath(l, code), now, "daily", 0.8);

  try {
    for (const collection of await listCollectionSummaries()) {
      if (collection.count < MIN_COLLECTION_RACES) continue;
      // No invented modification timestamp: membership changes with dates and
      // source updates, independently of when this sitemap is requested.
      add((l) => collectionPath(l, collection.slug, collection.countryCode), undefined, "daily", 0.75);
    }
  } catch {
    // Collection counts must not take the existing catalogue sitemap down.
  }

  try {
    // Only combinations that clear the race threshold — a thin hub in the
    // sitemap asks Google to index a page competing with its own parent.
    for (const hub of await listQualifyingHubs([...PUBLIC_COUNTRY_CODES])) {
      add((l) => hubPath(l, hub.countryCode, hub.discipline), now, "daily", 0.75);
    }
  } catch {
    // Hub outage must not take the rest of the sitemap down.
  }

  try {
    for (const s of await listSitemapSeries()) {
      add(`series/${s.slug}`, s.updatedAt ? new Date(s.updatedAt) : now, "weekly", 0.7);
    }
  } catch {
    // A series outage must not take the event URLs down with it.
  }

  try {
    for (const event of await listSitemapEvents()) {
      const lastModified = event.updatedAt ? new Date(event.updatedAt) : new Date(event.startDate);
      add(`e/${event.slug}`, lastModified, "weekly", 0.6);
    }
  } catch {
    // Sitemap should still ship locale hubs if DB is briefly unavailable.
  }

  return entries;
}
