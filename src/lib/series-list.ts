import type { SeriesOption } from "@/lib/explore-filters";

const seriesResultCache = new Map<string, SeriesOption[]>();
const seriesInflight = new Map<string, Promise<SeriesOption[]>>();

/** The cups on offer, fetched once per page load and shared by every view. */
export function loadSeriesList(qs: string): Promise<SeriesOption[]> {
  const cached = seriesResultCache.get(qs);
  if (cached) return Promise.resolve(cached);
  const pending = seriesInflight.get(qs);
  if (pending) return pending;
  const p = fetch(`/api/series${qs ? `?${qs}` : ""}`)
    .then(async (res) => {
      if (!res.ok) throw new Error(`series ${res.status}`);
      return res.json() as Promise<SeriesOption[]>;
    })
    .then((data) => {
      seriesResultCache.set(qs, data);
      return data;
    })
    .finally(() => {
      seriesInflight.delete(qs);
    });
  seriesInflight.set(qs, p);
  return p;
}
