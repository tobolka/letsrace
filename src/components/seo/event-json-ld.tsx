import type { EventListItem } from "@/lib/events";
import { absoluteUrl, raceOgImagePath } from "@/lib/seo";
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
  // The town alone, and the venue-and-town string for the Place's name.
  const town = event.location?.municipality || undefined;
  const placeLabel = event.location?.name || town;
  const pageUrl = absoluteUrl(localePath(locale, `e/${event.slug}`));
  // Pages about this race. The entry form is not one — it goes in `offers`.
  const sameAs = [
    event.websiteUrl,
    event.regulationsUrl,
    event.resultsUrl,
  ].filter((u): u is string => Boolean(u) && u !== event.registrationUrl);

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: event.name,
    url: pageUrl,
    startDate: event.startDate,
    eventStatus: schemaEventStatus(event.status),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    inLanguage: locale,
  };

  // No end date stored means a one-day race, as everywhere else in the app.
  data.endDate = event.endDate ?? event.startDate;
  if (sameAs.length) data.sameAs = sameAs;
  if (description) data.description = description;
  data.sport = "Cycling";
  data.image = [absoluteUrl(raceOgImagePath(locale, event.slug))];
  // The series is the event this race is a round of — not its organiser,
  // which is what this block used to call it.
  if (event.series) {
    data.superEvent = {
      "@type": "EventSeries",
      name: event.series.name,
      url: absoluteUrl(localePath(locale, `series/${event.series.slug}`)),
    };
  }
  // An offer is a claim that entry is open. Every race with an entry link used
  // to carry one marked InStock, including the ones run months ago — so only
  // while the race is still ahead. (No `validThrough`: entry deadlines are not
  // published anywhere on the site.)
  const today = new Date().toISOString().slice(0, 10);
  if (event.registrationUrl && (event.endDate ?? event.startDate) >= today) {
    const offer: Record<string, unknown> = {
      "@type": "Offer",
      url: event.registrationUrl,
      availability: "https://schema.org/InStock",
    };
    data.offers = offer;
  }
  if (placeLabel || event.location?.lat != null) {
    const location: Record<string, unknown> = {
      "@type": "Place",
      name: placeLabel || event.name,
    };
    if (event.location?.countryCode) {
      const address: Record<string, unknown> = {
        "@type": "PostalAddress",
        addressCountry: event.location.countryCode,
      };
      // A town or nothing — not a venue, a country name or "TBC".
      if (town) address.addressLocality = town;
      location.address = address;
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

  // Google requires a location on an Event; without one the block is only an
  // error in Search Console, so the race goes without it.
  return (
    <>
      {data.location ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
        />
      ) : null}
      {crumbs ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(crumbs) }}
        />
      ) : null}
    </>
  );
}
