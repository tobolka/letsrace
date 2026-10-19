import { localePath } from "@/lib/localized-paths";

/** Map deep-link for a race (`?e=` + dates so the pin is in range). */
export function eventMapPath(
  locale: string,
  event: { slug: string; startDate: string; endDate?: string | null },
  options: { anyDate?: boolean } = {},
) {
  const params = new URLSearchParams();
  params.set("e", event.slug);
  // Empty dates are the map's "any date" filter; absent ones fall back to this weekend.
  params.set("dateFrom", options.anyDate ? "" : event.startDate);
  params.set("dateTo", options.anyDate ? "" : event.endDate || event.startDate);
  return `/${locale}?${params.toString()}`;
}

export function eventPagePath(locale: string, slug: string) {
  return localePath(locale, `e/${slug}`);
}
