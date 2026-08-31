import type { MetadataRoute } from "next";
import { defaultLocale, locales } from "@/lib/i18n/messages";
import { listSitemapEvents, listSitemapSeries } from "@/lib/events";
import { PUBLIC_COUNTRY_CODES } from "@/lib/geo/europe";
import { absoluteUrl, getSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl(`/${defaultLocale}`),
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
      alternates: {
        languages: Object.fromEntries(locales.map((l) => [l, absoluteUrl(`/${l}`)])),
      },
    },
  ];

  // Every covered market, not a hardcoded eight — nineteen of the twenty-seven
  // countries holding upcoming races had no way into the index.
  for (const code of PUBLIC_COUNTRY_CODES) {
    const path = `c/${code.toLowerCase()}`;
    entries.push({
      url: absoluteUrl(`/${defaultLocale}/${path}`),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.75,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [l, absoluteUrl(`/${l}/${path}`)]),
        ),
      },
    });
  }

  try {
    const series = await listSitemapSeries();
    for (const s of series) {
      const path = `series/${s.slug}`;
      entries.push({
        url: absoluteUrl(`/${defaultLocale}/${path}`),
        lastModified: s.updatedAt ? new Date(s.updatedAt) : now,
        changeFrequency: "weekly",
        priority: 0.6,
        alternates: {
          languages: Object.fromEntries(locales.map((l) => [l, absoluteUrl(`/${l}/${path}`)])),
        },
      });
    }
  } catch {
    // A series outage must not take the event URLs down with it.
  }

  try {
    const events = await listSitemapEvents();
    for (const event of events) {
      const lastModified = event.updatedAt ? new Date(event.updatedAt) : new Date(event.startDate);
      entries.push({
        url: absoluteUrl(`/${defaultLocale}/e/${event.slug}`),
        lastModified,
        changeFrequency: "weekly",
        priority: 0.7,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, absoluteUrl(`/${l}/e/${event.slug}`)]),
          ),
        },
      });
    }
  } catch {
    // Sitemap should still ship locale hubs if DB is briefly unavailable.
  }

  return entries;
}
