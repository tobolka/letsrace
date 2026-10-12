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
