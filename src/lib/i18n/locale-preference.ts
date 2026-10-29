import { locales, type Locale } from "@/lib/i18n/messages";

export const LOCALE_COOKIE = "letsrace_locale";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function savedLocale(value: string | undefined): Locale | null {
  return locales.includes(value as Locale) ? value as Locale : null;
}

/** Save only an explicit choice, so opening a shared link does not replace it. */
export function rememberLocale(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
}
