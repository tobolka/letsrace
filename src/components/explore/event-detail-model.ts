import type { EventListItem } from "@/lib/events";
import type { messagesFor } from "@/lib/i18n/messages";
import {
  RACE_LEVEL_LABELS,
  AGE_CATEGORIES,
  UCI_CLASS_LABELS,
  formatEventCategoryLabel,
  type RaceLevel,
  type UciClass,
} from "@/lib/taxonomy";
import { eventTrustLevel, lastCheckedLabel, trustLabel } from "@/lib/trust";
import { ageCategoryHelp, ageCategoryLabel, disciplineLabel, raceLevelLabel, uciClassHelp } from "@/lib/i18n/taxonomy";
import { birthYears } from "@/lib/birth-years";

export type DetailLink = { href: string; label: string; kind: string };

const BORN_IN: Record<string, string> = { cs: "ročníky {years}", sk: "ročníky {years}", pl: "roczniki {years}", de: "Jahrgänge {years}", en: "born {years}" };

/**
 * Google Maps directions to a race, from wherever the person is. Without an
 * origin Maps asks for the current location itself — on a phone and in a
 * browser alike — and plans the drive; the coordinates are the race's own,
 * the place's name only when there are none.
 */
export function googleDirectionsUrl(
  location: { lat: number | null; lng: number | null } | null | undefined,
  placeLabel: string,
): string | null {
  const destination =
    location?.lat != null && location?.lng != null
      ? `${location.lat},${location.lng}`
      : placeLabel.trim()
        ? placeLabel.trim()
        : null;
  if (!destination) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

/**
 * Everything the race card says about a race, worked out from the race alone:
 * which chips, which links in which order, what the trust line reads. The
 * card (and its phone sheet) only lay it out.
 */
export function buildDetailModel(
  event: EventListItem,
  locale: string,
  t: ReturnType<typeof messagesFor>,
) {
  const levelKey = (event.level || "local") as RaceLevel;
  const levelLabel =
    (event.uciClass
      ? UCI_CLASS_LABELS[event.uciClass as UciClass] || event.uciClass.toUpperCase()
      : null) ||
    (event.classLabel && event.classLabel !== RACE_LEVEL_LABELS[levelKey] ? event.classLabel : raceLevelLabel(levelKey, locale));
  const whoLabel = formatEventCategoryLabel(
    event,
    { kids: t.kids, youth: t.youth, adults: t.adults },
    (id) => ageCategoryLabel(id, locale),
  );
  const whoChips = whoLabel ? whoLabel.split(" · ").filter(Boolean) : [];
  // The ages a chip stands for, by its label: "Junior" → "17–18 let".
  // Birth years beside the ages, as on the race page — only for the organiser's own categories.
  const showYears = event.ageConfidence === "explicit" || event.ageConfidence === "previous";
  const ageHintFor = (label: string) => {
    const id = AGE_CATEGORIES.find((c) => ageCategoryLabel(c, locale) === label);
    if (!id) return "";
    const years = showYears ? birthYears(id, event.startDate, event.disciplines, locale) : null;
    const born = years ? (BORN_IN[locale] ?? BORN_IN.en).replace("{years}", years) : null;
    return [ageCategoryHelp(id, locale), born].filter(Boolean).join(" · ");
  };
  const levelHelp = event.uciClass ? uciClassHelp(event.uciClass, locale) : "";
  const discChips = event.disciplines
    .slice(0, 4)
    .map((d) => disciplineLabel(d, locale))
    .filter(Boolean);

  const registerUrl = event.registrationUrl;
  const websiteUrl = event.websiteUrl;
  const listingUrl =
    event.listingUrl &&
    event.listingUrl !== websiteUrl &&
    event.listingUrl !== registerUrl
      ? event.listingUrl
      : null;
  // The organiser's own page leads; the entry form is one click further, in the
  // list of links. (When the two are the same address it is the entry.)
  const websiteFirst = Boolean(websiteUrl && websiteUrl !== registerUrl);
  const primaryEnter = websiteFirst ? websiteUrl : registerUrl || websiteUrl || listingUrl;
  const primaryEnterLabel = websiteFirst
    ? t.openWebsite
    : registerUrl
      ? t.register
      : websiteUrl
        ? t.openWebsite
        : listingUrl
          ? t.calendarListing
          : null;

  const extraLinks: DetailLink[] = [];
  if (websiteFirst && registerUrl) {
    extraLinks.push({ href: registerUrl, label: t.register, kind: "register" });
  }
  if (
    event.regulationsUrl &&
    event.regulationsUrl !== registerUrl &&
    event.regulationsUrl !== websiteUrl &&
    event.regulationsUrl !== listingUrl
  ) {
    extraLinks.push({
      href: event.regulationsUrl,
      label: t.regulations,
      kind: "regulations",
    });
  }
  if (
    event.resultsUrl &&
    event.resultsUrl !== registerUrl &&
    event.resultsUrl !== websiteUrl &&
    event.resultsUrl !== listingUrl &&
    event.resultsUrl !== event.regulationsUrl
  ) {
    extraLinks.push({
      href: event.resultsUrl,
      label: t.results,
      kind: "results",
    });
  }

  const trust = eventTrustLevel(event);
  const trustText = trustLabel(trust, t);
  const checkedText = lastCheckedLabel(event.lastSeenAt, locale, t.trustChecked);
  const placeLabel = [
    event.location?.municipality || event.location?.name,
    event.location?.countryCode,
  ]
    .filter(Boolean)
    .join(" · ");
  const directionsUrl = googleDirectionsUrl(event.location, placeLabel);

  const primaryHref = primaryEnter || event.regulationsUrl;
  const primaryLabel = primaryEnterLabel ?? (event.regulationsUrl ? t.regulations : null);
  const primaryKind = websiteFirst
    ? "website"
    : registerUrl
      ? "register"
      : websiteUrl
        ? "website"
      : listingUrl
        ? "listing"
        : "regulations";
  const secondaryLinks = extraLinks.filter((link) => link.href !== primaryHref);
  const actionLinks = [
    ...(primaryHref && primaryLabel
      ? [{ href: primaryHref, label: primaryLabel, kind: primaryKind }]
      : []),
    ...secondaryLinks,
  ];

  // Registration / website already have their own buttons — repeating
  // "Registration link available" in the footer just cluttered the card.
  const showTrustLabel = trust === "calendar" || trust === "low";

  return {
    levelLabel,
    whoChips,
    ageHintFor,
    levelHelp,
    discChips,
    placeLabel,
    directionsUrl,
    primary: primaryHref && primaryLabel ? { href: primaryHref, label: primaryLabel, kind: primaryKind } : null,
    secondaryLinks,
    actionLinks,
    trust,
    trustText: showTrustLabel ? trustText : null,
    checkedText,
  };
}
