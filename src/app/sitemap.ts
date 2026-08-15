import type { MetadataRoute } from "next";
import { defaultLocale, locales } from "@/lib/i18n/messages";
import { listSitemapEvents } from "@/lib/events";
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
