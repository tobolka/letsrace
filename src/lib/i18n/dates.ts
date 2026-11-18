import { format, parseISO } from "date-fns";
import { cs } from "date-fns/locale/cs";
import { enUS } from "date-fns/locale/en-US";
import { pl } from "date-fns/locale/pl";
import { sk } from "date-fns/locale/sk";
import { de } from "date-fns/locale/de";
import { asLocale, type Locale } from "@/lib/i18n/messages";

export const DATE_FNS_LOCALES = { en: enUS, cs, pl, sk, de } as const;

export function dateFnsLocale(locale: string) {
  return DATE_FNS_LOCALES[asLocale(locale)];
}

export type DateFnsLocale = (typeof DATE_FNS_LOCALES)[Locale];

export function planRaceDates(
  { startDate, endDate }: { startDate: string; endDate: string | null },
  locale: string,
  width: "short" | "long",
) {
  const formatter = new Intl.DateTimeFormat(asLocale(locale), {
    weekday: width, day: "numeric", month: width,
  });
  const start = parseISO(startDate);
  return endDate && endDate > startDate
    ? formatter.formatRange(start, parseISO(endDate))
    : formatter.format(start);
}

/**
 * "18 May", or "18 May 2025" for a race outside the current year — without the
 * year, a race from last spring in an any-date list read as one still to come.
 */
export function compactRaceDates(
  event: { startDate: string; endDate?: string | null },
  locale: string,
  now = new Date(),
) {
  const date = (value: string) => format(parseISO(value), "d MMM", { locale: dateFnsLocale(locale) });
  const last = event.endDate && event.endDate !== event.startDate ? event.endDate : event.startDate;
  const range = date(event.startDate) + (last !== event.startDate ? `–${date(last)}` : "");
  return otherYear(last, now) ? `${range} ${last.slice(0, 4)}` : range;
}

/** Whether a date falls outside the current calendar year. */
export function otherYear(isoDate: string, now = new Date()): boolean {
  return Number(isoDate.slice(0, 4)) !== now.getFullYear();
}

/** A race whose last day is before today. */
export function raceIsPast(event: { startDate: string; endDate?: string | null }, now = new Date()): boolean {
  const last = event.endDate && event.endDate > event.startDate ? event.endDate : event.startDate;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return last < today;
}
