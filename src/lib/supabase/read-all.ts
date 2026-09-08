/**
 * Read every row, not the first thousand.
 *
 * PostgREST answers a select with at most a thousand rows however many there
 * are, and says nothing about the ones it left out. That has already cost this
 * catalogue twice: 798 of an aggregator's races were invisible to the watcher,
 * and the admin's source list has been showing 1000 of 1290 watched URLs
 * without saying so.
 *
 * The order matters as much as the paging. A range query with no ORDER BY, or
 * one ordered by a column with ties, lets Postgres answer each range in a
 * different order — so pages overlap and rows between them are never read.
 * Every caller passes an order ending in a unique column.
 */
export async function readAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  opts?: { pageSize?: number; max?: number },
): Promise<T[]> {
  const size = opts?.pageSize ?? 1000;
  const max = opts?.max ?? 100_000;
  const rows: T[] = [];
  for (let from = 0; from < max; from += size) {
    const { data, error } = await page(from, from + size - 1);
    const batch = data ?? [];
    rows.push(...batch);
    if (error || batch.length < size) break;
  }
  return rows;
}
