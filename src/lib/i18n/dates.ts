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

export function compactRaceDates(event: { startDate: string; endDate?: string | null }, locale: string) {
  const date = (value: string) => format(parseISO(value), "d MMM", { locale: dateFnsLocale(locale) });
  return date(event.startDate) + (event.endDate && event.endDate !== event.startDate ? `–${date(event.endDate)}` : "");
}
