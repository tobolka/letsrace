import type { EventListItem } from "@/lib/events";

export type TrustLevel = "official" | "series" | "calendar" | "low";

export function eventTrustLevel(event: EventListItem): TrustLevel {
  if (event.registrationUrl) return "official";
  if (event.websiteUrl && event.sourceKind !== "scraped") return "official";
  if (event.websiteUrl) return "series";
  if (event.listingUrl) return "calendar";
  return "low";
}

export function trustLabel(
  level: TrustLevel,
  messages: { trustOfficial: string; trustSeries: string; trustCalendar: string; trustLow: string },
): string {
  switch (level) {
    case "official":
      return messages.trustOfficial;
    case "series":
      return messages.trustSeries;
    case "calendar":
      return messages.trustCalendar;
    default:
      return messages.trustLow;
  }
}

/** Soft-hide from dense map views: junk names already handled; low = no usable outbound. */
export function isLowConfidencePublicEvent(event: EventListItem): boolean {
  return eventTrustLevel(event) === "low" && !event.location?.lat;
}
