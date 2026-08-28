import type { EventListItem } from "@/lib/events";
import { absoluteUrl } from "@/lib/seo";

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

export function EventJsonLd({
  event,
  locale,
}: {
  event: EventListItem;
  locale: string;
}) {
  const placeName =
    event.location?.municipality || event.location?.name || undefined;
  const pageUrl = absoluteUrl(`/${locale}/e/${event.slug}`);
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
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  };

  if (event.endDate) data.endDate = event.endDate;
  if (sameAs.length) data.sameAs = sameAs;
  if (event.series) {
    data.organizer = { "@type": "Organization", name: event.series.name };
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

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
