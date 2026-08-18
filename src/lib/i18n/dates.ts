import { cs } from "date-fns/locale/cs";
import { enUS } from "date-fns/locale/en-US";
import { pl } from "date-fns/locale/pl";
import { sk } from "date-fns/locale/sk";
import { asLocale, type Locale } from "@/lib/i18n/messages";

export const DATE_FNS_LOCALES = { en: enUS, cs, pl, sk } as const;

export function dateFnsLocale(locale: string) {
  return DATE_FNS_LOCALES[asLocale(locale)];
}

export type DateFnsLocale = (typeof DATE_FNS_LOCALES)[Locale];
