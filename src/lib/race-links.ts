import type { EventListItem } from "@/lib/events";
import { asLocale, messagesFor } from "@/lib/i18n/messages";
import { DOCUMENT_KINDS } from "@/lib/race-fact-copy";
import { localePath } from "@/lib/localized-paths";
import type { PracticalDetails } from "@/lib/practical-details";

/** A way off a race: the organiser's pages and documents, the series, the forecast. */
export type RaceLinkItem = { href: string; label: string; kind: string; external: boolean };

/**
 * Where the race is held, for directions and "view on map": the venue's own coordinates when the
 * regulations give them, else the race's place. Without a verified venue the place may be only the
 * town, so the regulations always win. A venue carried over from another year is not a confirmation.
 */
export function raceDestination(event: {
  location?: { lat: number | null; lng: number | null } | null;
  practicalDetails?: PracticalDetails | null;
}): { lat: number; lng: number; fromVenue: boolean } | null {
  const venue = event.practicalDetails?.venue;
  if (venue && venue.status !== "inherited" && venue.value.lat != null && venue.value.lng != null) {
    return { lat: venue.value.lat, lng: venue.value.lng, fromVenue: true };
  }
  const here = event.location;
  if (here?.lat != null && here.lng != null && Number.isFinite(here.lat) && Number.isFinite(here.lng)) {
    return { lat: here.lat, lng: here.lng, fromVenue: false };
  }
  return null;
}

/**
 * Every link of a race, in one order with one set of names, for the race page and the map's card
 * alike: the organiser's own page leads, then the entry form, the regulations, the results,
 * Facebook, the regulations' other documents, the series' page and the forecast. Each address once.
 */
export function buildRaceLinks(
  event: EventListItem,
  locale: string,
  options: {
    /** The regulations' other documents, once the whole race is known. */
    documents?: PracticalDetails["documents"] | null;
    /** The forecast, when the race is still to come and has a place. */
    forecast?: { href: string; label: string } | null;
  } = {},
): RaceLinkItem[] {
  const t = messagesFor(locale);
  const kinds = DOCUMENT_KINDS[asLocale(locale)];
  const link = (href: string | null | undefined, label: string, kind: string, external = true) =>
    href ? [{ href, label, kind, external }] : [];
  const noSite = !event.websiteUrl && !event.registrationUrl;
  const all: RaceLinkItem[] = [
    ...link(event.websiteUrl, t.openWebsite, "website"),
    ...link(event.registrationUrl, t.register, "register"),
    ...link(event.regulationsUrl, kinds.regulations, "regulations"),
    ...link(event.resultsUrl, t.results, "results"),
    ...link(event.facebookUrl, "Facebook", "facebook"),
    ...(noSite ? link(event.listingUrl, t.calendarListing, "listing") : []),
    ...(options.documents?.value ?? []).map((doc) => ({ href: doc.url, label: kinds[doc.kind], kind: doc.kind, external: true })),
    ...(event.series ? link(localePath(locale, `series/${event.series.slug}`), event.series.name, "series", false) : []),
    ...(options.forecast ? link(options.forecast.href, options.forecast.label, "weather") : []),
  ];
  return all.filter((l, i) => all.findIndex((x) => x.href === l.href) === i);
}
