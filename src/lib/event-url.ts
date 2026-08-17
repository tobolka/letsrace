/** Map deep-link for a race (`?e=` + dates so the pin is in range). */
export function eventMapPath(
  locale: string,
  event: { slug: string; startDate: string; endDate?: string | null },
) {
  const params = new URLSearchParams();
  params.set("e", event.slug);
  params.set("dateFrom", event.startDate);
  params.set("dateTo", event.endDate || event.startDate);
  return `/${locale}?${params.toString()}`;
}

export function eventPagePath(locale: string, slug: string) {
  return `/${locale}/e/${slug}`;
}
