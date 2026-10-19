import { todayIso } from "@/lib/date-presets";
import { localePath } from "@/lib/localized-paths";

/** Map deep-link for a race (`?e=` + dates so the pin is in range). */
export function eventMapPath(
  locale: string,
  event: { slug: string; startDate: string; endDate?: string | null },
  options: { upcoming?: boolean } = {},
) {
  const params = new URLSearchParams();
  params.set("e", event.slug);
  // "Upcoming" is today onwards with no end; absent dates fall back to this weekend.
  params.set("dateFrom", options.upcoming ? todayIso() : event.startDate);
  params.set("dateTo", options.upcoming ? "" : event.endDate || event.startDate);
  return `/${locale}?${params.toString()}`;
}

export function eventPagePath(locale: string, slug: string) {
  return localePath(locale, `e/${slug}`);
}
