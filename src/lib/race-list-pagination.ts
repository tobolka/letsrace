/** Keep rendered race lists below crawler HTML limits, including hydration data. */
export const RACE_LIST_PAGE_SIZE = 50;

export function paginateRaces<T>(events: T[], rawPage?: string | string[]) {
  const requested = typeof rawPage === "string" && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : 1;
  const pages = Math.max(1, Math.ceil(events.length / RACE_LIST_PAGE_SIZE));
  const page = Number.isSafeInteger(requested) ? Math.min(requested, pages) : 1;
  return { events: events.slice((page - 1) * RACE_LIST_PAGE_SIZE, page * RACE_LIST_PAGE_SIZE), page, pages };
}

export function raceListPagePath(path: string, rawPage?: string | string[]) {
  const page = typeof rawPage === "string" && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : 1;
  return Number.isSafeInteger(page) && page > 1 ? `${path}?page=${page}` : path;
}

/** Prefer the visible month group; otherwise navigate to its first list page. */
export function raceMonthHref(events: { startDate: string }[], month: string, path: string, currentPage: number) {
  const first = events.findIndex(event => event.startDate.startsWith(month));
  if (first < 0) return null;
  const visible = events.slice((currentPage - 1) * RACE_LIST_PAGE_SIZE, currentPage * RACE_LIST_PAGE_SIZE);
  const page = visible.some(event => event.startDate.startsWith(month)) ? currentPage : Math.floor(first / RACE_LIST_PAGE_SIZE) + 1;
  return `${page === currentPage ? "" : raceListPagePath(path, String(page))}#month-${month}`;
}
