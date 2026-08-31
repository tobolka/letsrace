import { absoluteUrl, SITE_NAME } from "@/lib/seo";

/**
 * Structured data for the country and series hubs.
 *
 * The race pages carry `SportsEvent`, but the listings that link to them carried
 * nothing — so a page holding forty races looked, to a crawler, like prose with
 * links. `ItemList` states what the page is a list *of*, and `BreadcrumbList`
 * gives the hub a place in the hierarchy instead of leaving every URL a
 * top-level orphan.
 *
 * Rendered server-side and escaped: race names come from scraped third-party
 * pages, and one containing `</script>` would otherwise break out of the block.
 */
function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export type HubEvent = {
  name: string;
  slug: string;
  startDate: string;
  place?: string | null;
};

export function HubJsonLd({
  locale,
  title,
  description,
  path,
  events,
  breadcrumb,
}: {
  locale: string;
  title: string;
  description: string;
  /** Hub path without the locale, e.g. `c/cz` or `series/cesky-pohar-mtb`. */
  path: string;
  events: HubEvent[];
  /** Trail after the site root; the hub itself is appended automatically. */
  breadcrumb?: { name: string; path: string }[];
}) {
  const url = absoluteUrl(`/${locale}/${path}`);

  const itemList = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl(`/${locale}`) },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: events.length,
      itemListElement: events.slice(0, 50).map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "SportsEvent",
          name: e.name,
          startDate: e.startDate,
          url: absoluteUrl(`/${locale}/e/${e.slug}`),
          ...(e.place ? { location: { "@type": "Place", name: e.place } } : {}),
        },
      })),
    },
  };

  const trail = [
    { name: SITE_NAME, path: "" },
    ...(breadcrumb ?? []),
    { name: title, path },
  ];
  const breadcrumbList = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path ? `/${locale}/${c.path}` : `/${locale}`),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(itemList) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(breadcrumbList) }}
      />
    </>
  );
}
