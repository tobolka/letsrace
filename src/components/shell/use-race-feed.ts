"use client";

import { useEffect, useRef, useState } from "react";
import type { EventListItem } from "@/lib/events";

export type FeedQuery = {
  q: string;
  categories: string[];
  disciplines: string[];
  levels: string[];
  series: string;
  country: string;
  dateFrom: string;
  dateTo: string;
};

function toParams(query: FeedQuery): string {
  const params = new URLSearchParams();
  if (query.q.trim()) params.set("q", query.q.trim());
  if (query.series) params.set("series", query.series);
  if (query.country) params.set("country", query.country);
  if (query.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query.dateTo) params.set("dateTo", query.dateTo);
  if (!query.dateFrom && !query.dateTo) params.set("anyDate", "1");
  query.categories.forEach((v) => params.append("categories", v));
  query.disciplines.forEach((v) => params.append("disciplines", v));
  query.levels.forEach((v) => params.append("levels", v));
  return params.toString();
}

/**
 * The races behind the list and the schedule.
 *
 * No camera here, so no bounding box: the query is the filters and nothing
 * else, and a change to any of them is a new request. Requests are debounced
 * and the one in flight is aborted, so typing in the search box or clicking
 * through several chips settles on the last answer instead of racing to it.
 */
export function useRaceFeed(query: FeedQuery, enabled: boolean) {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [settled, setSettled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // A plain string, so the effect below re-runs exactly when the query does.
  const qs = toParams(query);
  const first = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    // The first request goes out at once; later ones wait for typing to stop.
    const delay = first.current ? 0 : 250;
    first.current = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void fetch(`/api/events?${qs}`, { signal: ac.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`events ${res.status}`);
          return (await res.json()) as EventListItem[];
        })
        .then((data) => {
          setEvents(data);
          setFailed(false);
          setSettled(true);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name === "AbortError") return;
          setFailed(true);
          setSettled(true);
          setLoading(false);
        });
    }, delay);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [qs, enabled]);

  return { events, settled, loading, failed };
}
