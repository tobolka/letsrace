import { asLocale, type Locale } from "@/lib/i18n/messages";

/**
 * Windy opened on the race's spot with its hour-by-hour forecast for that
 * point. The path names the point; `?lat,lng,zoom` alone only moves the map,
 * and Windy dropped it for its home page.
 */
export function windyUrl(lat: number, lng: number): string {
  const at = `${lat.toFixed(3)}/${lng.toFixed(3)}`;
  return `https://www.windy.com/${at}?${lat.toFixed(3)},${lng.toFixed(3)},11`;
}

/**
 * The forecast link's name where a race lists its links together:
 * what it is for, not whose site it opens.
 */
export function windyLabel(locale: string): string {
  return FORECAST_LINK[asLocale(locale)];
}
const FORECAST_LINK: Record<Locale, string> = {
  cs: "Předpověď počasí",
  sk: "Predpoveď počasia",
  pl: "Prognoza pogody",
  de: "Wettervorhersage",
  en: "Weather forecast",
};
