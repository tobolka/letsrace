import { differenceInCalendarDays } from "date-fns";
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

export function lastCheckedWhen(
  iso: string,
  locale: string,
  now = new Date(),
): string | null {
  const then = new Date(iso);
  if (!Number.isFinite(then.getTime())) return null;
  const days = Math.max(0, differenceInCalendarDays(now, then));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (days < 14) return rtf.format(-days, "day");
  if (days < 60) return rtf.format(-Math.max(1, Math.round(days / 7)), "week");
  return rtf.format(-Math.max(1, Math.round(days / 30)), "month");
}

export function lastCheckedLabel(
  iso: string | null | undefined,
  locale: string,
  template: string,
  now = new Date(),
): string | null {
  if (!iso) return null;
  const when = lastCheckedWhen(iso, locale, now);
  if (!when) return null;
  return template.replace("{when}", when);
}
