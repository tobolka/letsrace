"use client";

import { useEffect, useMemo, type RefObject } from "react";
import type { MapBounds } from "@/components/map/types";
import type { EventListItem } from "@/lib/events";
import { sortEvents, type EventSort } from "@/lib/geo/distance";

/**
 * What is on screen, not what is in memory.
 *
 * The map asks for a box padded on every side so races are already loaded
 * when they scroll into frame. That padding is a buffer, not a promise —
 * leaving it in the list meant zooming in or panning changed the view and not
 * the count, and the list kept naming races you could no longer see. Clipping
 * costs no round trip, so the count answers the camera at once.
 *
 * A name search, a series or a country is a find rather than a window, and
 * those are meant to reach outside the frame.
 */
export function visibleRaces(opts: {
  events: EventListItem[];
  /** The box the camera shows; none until it has settled. */
  box: MapBounds | null;
  /** A distance filter already cut the answer to a circle. */
  withinRadius: boolean;
  series: string;
  countries: string[];
  q: string;
  /** The text of a search that flew the map to a place rather than finding a race. */
  placedQuery: string;
  selectedId: string | null;
}): EventListItem[] {
  const { events, box, withinRadius, series, countries, q, placedQuery, selectedId } = opts;
  if (withinRadius || !box || series || countries.length) return events;
  if (q.trim() && !placedQuery) return events;
  return events.filter((e) => {
    // The race you opened stays in the list even when the map has carried it
    // off the edge — losing the row you are reading is worse than a row you
    // cannot see.
    if (e.id === selectedId) return true;
    const lat = Number(e.location?.lat);
    const lng = Number(e.location?.lng);
    // A race we could not place is never hidden by a box it has no point in.
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;
    return lat >= box.south && lat <= box.north && lng >= box.west && lng <= box.east;
  });
}

/**
 * The races the list names, in the order it names them, and the scroll that
 * keeps the one you opened in view.
 */
export function useMapList({
  radiusEvents,
  radiusArea,
  cameraBounds,
  placedQuery,
  selectedId,
  filters,
  distanceOrigin,
  listSettled,
  listRef,
  mobileListRef,
}: {
  radiusEvents: EventListItem[];
  radiusArea: unknown;
  cameraBounds: MapBounds | null;
  placedQuery: string;
  selectedId: string | null;
  filters: { sort: string; series: string; country: string[]; q: string };
  distanceOrigin: { lat: number; lng: number } | null;
  listSettled: boolean;
  listRef: RefObject<HTMLDivElement | null>;
  mobileListRef: RefObject<HTMLDivElement | null>;
}) {
  // Date is the default and distance is opt-in. Sorting by distance the moment
  // a location arrived reshuffled the list under whoever was reading it, and it
  // only ever made sense to someone who asked for it.
  const listSort: EventSort =
    filters.sort === "distance" && distanceOrigin != null ? "distance" : "date";

  const visibleEvents = useMemo(
    () =>
      visibleRaces({
        events: radiusEvents,
        box: cameraBounds,
        withinRadius: Boolean(radiusArea),
        series: filters.series,
        countries: filters.country,
        q: filters.q,
        placedQuery,
        selectedId,
      }),
    [radiusEvents, radiusArea, cameraBounds, placedQuery, selectedId, filters.series, filters.country, filters.q],
  );

  const sortedEvents = useMemo(
    () => sortEvents(visibleEvents, listSort, distanceOrigin),
    [visibleEvents, listSort, distanceOrigin],
  );

  /**
   * Keep the selected race in view in the list.
   *
   * On a phone the list is unmounted while a race card is open, so there is
   * nothing to scroll at the moment the race is picked off the map. This runs
   * again when the list comes back, on the frame after it mounts — otherwise
   * closing the card dropped you at the top of the list with no sign of the
   * race you had just been reading about.
   */
  useEffect(() => {
    if (!selectedId) return;
    const selector = `[data-event-id="${CSS.escape(selectedId)}"]`;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const raf = requestAnimationFrame(() => {
      for (const root of [listRef.current, mobileListRef.current]) {
        if (!root || root.offsetHeight === 0) continue;
        const el = root.querySelector<HTMLElement>(selector);
        if (!el) continue;
        el.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: reduce ? "auto" : "smooth",
        });
        break;
      }
    });
    return () => cancelAnimationFrame(raf);
    // `listSettled`: the rows exist only once the list has.
  }, [selectedId, listSettled, listRef, mobileListRef]);

  return { listSort, visibleEvents, sortedEvents };
}
