"use client";

import { useEffect, useRef, useState } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { boxAround } from "@/hooks/use-user-origin";
import { eventDistanceKm } from "@/lib/geo/distance";
import type { EventListItem } from "@/lib/events";
import { buildEventsQuery, type EventsQuery } from "@/lib/events-query";
import { filterCatalogue } from "@/lib/filter-catalogue";
import { loadCatalogue } from "@/lib/load-catalogue";

export type Near = { origin: { lat: number; lng: number }; km: number };

export type FeedQuery = EventsQuery;

function toParams(query: FeedQuery, near: Near | null): string {
  // Rounded, so a position that wobbles in the fifth decimal is one address.
  const round = (v: number) => Number(v.toFixed(4));
  const box = near ? boxAround(near.origin, near.km) : null;
  const { shared, params } = buildEventsQuery(
    query,
    box && { west: round(box.west), south: round(box.south), east: round(box.east), north: round(box.north) },
  );
  if (shared) params.set("catalogue", "1");
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
export function useRaceFeed(query: FeedQuery, enabled: boolean, near: Near | null = null) {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [settled, setSettled] = useState(false);
  // The request the last answer was for; a different current one means loading.
  const [answeredKey, setAnsweredKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // A plain string, so the effect below re-runs exactly when the query does.
  const qs = toParams(query, near);
  const nearKey = near ? `${near.origin.lat},${near.origin.lng},${near.km}` : "";
  const requestKey = `${qs}|${nearKey}`;
  const isClient = useIsClient();
  const first = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    // The first request goes out at once; later ones wait for typing to stop.
    const delay = first.current ? 0 : 250;
    first.current = false;
    const timer = window.setTimeout(() => {
      const shared = qs.includes("catalogue=1");
      const loaded = shared
        ? loadCatalogue()
        : fetch(`/api/events?${qs}`, { signal: ac.signal }).then(async (res) => {
            if (!res.ok) throw new Error(`events ${res.status}`);
            return (await res.json()) as EventListItem[];
          });
      void loaded
        .then((data) => {
          if (ac.signal.aborted) return;
          const filtered = shared
            ? filterCatalogue(data, {
                categories: query.categories,
                disciplines: query.disciplines,
                levels: query.levels,
                country: query.country,
                dateFrom: query.dateFrom,
                dateTo: query.dateTo,
              })
            : data;
          setEvents(
            near
              ? filtered.filter((e) => {
                  const km = eventDistanceKm(e, near.origin);
                  return km != null && km <= near.km;
                })
              : filtered,
          );
          setFailed(false);
          setSettled(true);
          setAnsweredKey(requestKey);
        })
        .catch((err: unknown) => {
          if (ac.signal.aborted) return;
          if ((err as { name?: string })?.name === "AbortError") return;
          setFailed(true);
          setSettled(true);
          setAnsweredKey(requestKey);
        });
    }, delay);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
    // `near` is read inside; `nearKey` is its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, enabled, nearKey, requestKey]);

  // Not "loading" in the server's HTML: the request only starts in the browser.
  const loading = isClient && enabled && answeredKey !== requestKey;
  return { events, settled, loading, failed };
}
