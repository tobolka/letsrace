import type { EventListItem } from "@/lib/events";
import { absoluteUrl } from "@/lib/seo";
import { localePath } from "@/lib/localized-paths";

/**
 * Race names come from scraped third-party pages, so a name containing
 * `</script>` would break out of the JSON-LD block. JSON.stringify does not
 * escape `<`; escape it (plus the JS-invalid line separators) before inlining.
 */
function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * What the race's status means to a search engine.
 *
 * This was the string "EventScheduled", written on every race page whatever
 * the row said — so the fifteen cancelled races in the catalogue were
 * published to Google as going ahead, and a postponed one as keeping its
 * original date. That is the one field in this block a reader might act on.
 */
function schemaEventStatus(status: string | null | undefined): string {
  switch (status) {
    case "cancelled":
      return "https://schema.org/EventCancelled";
    case "postponed":
      return "https://schema.org/EventPostponed";
    default:
      return "https://schema.org/EventScheduled";
  }
}

export function EventJsonLd({
  event,
  locale,
  description,
  breadcrumb,
}: {
  event: EventListItem;
  locale: string;
  /** The page's written account of the race. */
  description?: string;
  /** From the site down to this race, for search results' breadcrumb trail. */
  breadcrumb?: { name: string; path: string }[];
}) {
  const placeName =
    event.location?.municipality || event.location?.name || undefined;
  const pageUrl = absoluteUrl(localePath(locale, `e/${event.slug}`));
  const sameAs = [
    event.websiteUrl,
    event.registrationUrl,
    event.regulationsUrl,
    event.resultsUrl,
  ].filter((u): u is string => Boolean(u));

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: event.name,
    url: pageUrl,
    startDate: event.startDate,
    eventStatus: schemaEventStatus(event.status),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  };

  // No end date stored means a one-day race, as everywhere else in the app.
  data.endDate = event.endDate ?? event.startDate;
  if (sameAs.length) data.sameAs = sameAs;
  if (description) data.description = description;
  data.sport = "Cycling";
  data.image = [absoluteUrl(localePath(locale, `e/${event.slug}/opengraph-image`))];
  // The series is the event this race is a round of — not its organiser,
  // which is what this block used to call it.
  if (event.series) {
    data.superEvent = {
      "@type": "EventSeries",
      name: event.series.name,
      url: absoluteUrl(localePath(locale, `series/${event.series.slug}`)),
    };
  }
  if (event.registrationUrl) {
    const offer: Record<string, unknown> = {
      "@type": "Offer",
      url: event.registrationUrl,
      availability: "https://schema.org/InStock",
    };
    if (event.registrationClosesAt) offer.validThrough = event.registrationClosesAt;
    data.offers = offer;
  }
  if (placeName || event.location?.lat != null) {
    const location: Record<string, unknown> = {
      "@type": "Place",
      name: placeName || event.name,
    };
    if (event.location?.countryCode) {
      location.address = {
        "@type": "PostalAddress",
        addressCountry: event.location.countryCode,
        addressLocality: placeName,
      };
    }
    if (event.location?.lat != null && event.location?.lng != null) {
      location.geo = {
        "@type": "GeoCoordinates",
        latitude: event.location.lat,
        longitude: event.location.lng,
      };
    }
    data.location = location;
  }

  const crumbs = breadcrumb?.length
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumb.map((b, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: b.name,
          item: absoluteUrl(localePath(locale, b.path)),
        })),
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
      />
      {crumbs ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(crumbs) }}
        />
      ) : null}
    </>
  );
}
