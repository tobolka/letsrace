"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { inferParserType } from "nuqs";
import type { MapBounds } from "@/components/map/types";
import { foldPlaceQuery } from "@/lib/coverage";
import { buildEventsQuery } from "@/lib/events-query";
import type { EventListItem } from "@/lib/events";
import { exploreSearchParams } from "@/lib/explore-params";
import { filterCatalogue } from "@/lib/filter-catalogue";
import { boxAround } from "@/hooks/use-user-origin";
import { expandViewport } from "@/lib/geo/viewport";
import { loadCatalogue } from "@/lib/load-catalogue";
import { reuseUnchanged } from "@/lib/reuse-unchanged";

export type ExploreFilters = inferParserType<typeof exploreSearchParams>;
export type RadiusArea = { lat: number; lng: number; km: number } | null;

/**
 * The races the map's panel and pins are made from.
 *
 * Holds the list, whether it is loading and whether it has ever settled, and
 * the one way to ask for it again: `refetch`, with the filters as they are
 * plus whatever the caller is about to change (the address updates a frame
 * later than the click). It fetches the padded viewport box and remembers
 * that it did (`area`), keeps the row objects it already had, and a
 * stale answer never overwrites a newer one.
 *
 * The map is what asks for the list, so if it never reports bounds — no
 * WebGL, a blocked tile host, a thrown error — nothing would ever be
 * requested and the list would stay empty for good; a timer asks without
 * bounds instead, but only when nothing has been asked for at all.
 */
export function useMapFeed({
  initialEvents,
  filters,
  radiusArea,
  bounds,
  flyTo,
}: {
  initialEvents: EventListItem[];
  filters: ExploreFilters;
  radiusArea: RadiusArea;
  bounds: MapBounds | null;
  flyTo: (box: MapBounds) => void;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [listLoading, setListLoading] = useState(false);
  /**
   * The rows are placeholders until the map settles on its bounds and the list
   * is fetched for them. Nothing is rendered before that: the server used to
   * send a guess, and swapping it for the real set lifted the rows by five
   * cards' worth — the whole of this page's layout shift.
   */
  const [listSettled, setListSettled] = useState(false);
  const [fitSeq, setFitSeq] = useState(0);
  const fetchStartedRef = useRef(false);
  const eventsFetchGen = useRef(0);
  const lastAreaRef = useRef<MapBounds | null>(null);
  const getLastArea = useCallback(() => lastAreaRef.current, []);
  const setLastArea = useCallback((box: MapBounds | null) => {
    lastAreaRef.current = box;
  }, []);
  /**
   * The place name the map was flown to, which is then not a text search. A
   * ref for the code that needs the answer this instant, state for the render
   * that has to follow it.
   */
  const placedRef = useRef("");
  const [placedQuery, setPlacedState] = useState("");
  const getPlacedQuery = useCallback(() => placedRef.current, []);
  const setPlacedQuery = useCallback((q: string) => {
    placedRef.current = q;
    setPlacedState(q);
  }, []);

  /**
   * Returns what was fetched, so a caller that needs to know whether the
   * search found anything can wait for it. Superseded fetches resolve to null.
   */
  function refetch(overrides: Record<string, unknown> = {}): Promise<EventListItem[] | null> {
    const gen = ++eventsFetchGen.current;
    fetchStartedRef.current = true;
    setListLoading(true);
    return (async () => {
      const qRaw = (overrides.q as string) ?? filters.q;
      const placed = placedRef.current;
      const q =
        placed && foldPlaceQuery(qRaw) === foldPlaceQuery(placed) ? "" : qRaw;
      const categories = (overrides.categories as string[]) ?? filters.categories;
      const disciplines = (overrides.disciplines as string[]) ?? filters.disciplines;
      const levels = (overrides.levels as string[]) ?? filters.levels;
      const series = (overrides.series as string) ?? filters.series;
      const country = (overrides.country as string[]) ?? filters.country;
      const dateFrom = (overrides.dateFrom as string) ?? filters.dateFrom;
      const dateTo = (overrides.dateTo as string) ?? filters.dateTo;
      const skipBounds =
        overrides.skipBounds === true ||
        (Boolean(series || country.length) && overrides.forceBounds !== true);
      /*
       * Fetch the padded box, and remember that we did.
       *
       * A viewport fetch asks for a box grown on every side, so races load just
       * before they enter the frame, and records that box as what it holds. A
       * filter change used to ask for the bare camera box instead while leaving
       * the record alone — so after changing the date we held races for what
       * was on screen but still claimed the padded ring around it. Zoom out a
       * little and nothing refetched, because we believed we already had that
       * ground; the ring came up empty.
       */
      const explicit = overrides.bounds as typeof bounds | undefined;
      const near = overrides.clearRadius ? null : radiusArea;
      const b = near ? boxAround(near, near.km) : skipBounds ? null : (explicit ?? (bounds ? expandViewport(bounds) : null));
      if (b) lastAreaRef.current = b;
      const { shared, params } = buildEventsQuery(
        { q, series, dateFrom, dateTo, categories, disciplines, levels, country },
        b,
      );
      try {
        const data = shared
          ? filterCatalogue(await loadCatalogue(), {
              categories,
              disciplines,
              levels,
              country,
              dateFrom,
              dateTo,
              west: b?.west,
              south: b?.south,
              east: b?.east,
              north: b?.north,
            })
          : ((await (await fetch(`/api/events?${params.toString()}`)).json()) as EventListItem[]);
        if (gen !== eventsFetchGen.current) return null;
        const focusSlug = filters.e;
        setEvents((prev) => {
          const next = reuseUnchanged(prev, data);
          // A series or country is a find, and a race outside it has no place
          // in the answer — a German kids' cup was sitting under Dětský MTB Cup
          // because it had been open when the filter was picked.
          if (!focusSlug || series || country.length) return next;
          const kept =
            next.find((e) => e.slug === focusSlug) ?? prev.find((e) => e.slug === focusSlug);
          if (!kept || next.some((e) => e.id === kept.id)) return next;
          return [kept, ...next];
        });
        if (overrides.fitMap) setFitSeq((n) => n + 1);
        return data;
      } catch {
        return null;
      } finally {
        if (gen === eventsFetchGen.current) {
          setListLoading(false);
          setListSettled(true);
        }
      }
    })();
  }


  const lastRadiusQuery = useRef("");
  useEffect(() => {
    if (!radiusArea) {
      if (lastRadiusQuery.current) {
        lastRadiusQuery.current = "";
        void refetch({ clearRadius: true });
      }
      return;
    }
    const key = `${radiusArea.lat}:${radiusArea.lng}:${radiusArea.km}`;
    if (key === lastRadiusQuery.current) return;
    lastRadiusQuery.current = key;
    const area = boxAround(radiusArea, radiusArea.km);
    void refetch({ bounds: area, forceBounds: true });
    flyTo(area);
    // Radius/center define this query; camera movement does not change it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusArea]);


  useEffect(() => {
    if (listSettled) return;
    // The map is what asks for the list, so if it never reports bounds — no
    // WebGL, a blocked tile host, a thrown error — nothing would ever be
    // requested and the list would stay empty for good. Ask without bounds
    // instead, which is the whole date range: the same set the server used to
    // render. A timeout that fired while a request was already in flight would
    // show one list and then replace it, which is the shift this exists to
    // prevent, so it only acts when nothing has been asked for at all.
    const t = window.setTimeout(() => {
      if (!fetchStartedRef.current) void refetch({ skipBounds: true });
    }, 2500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listSettled]);


  return {
    events,
    listLoading,
    listSettled,
    fitSeq,
    refetch,
    area: { get: getLastArea, set: setLastArea },
    placed: { query: placedQuery, get: getPlacedQuery, set: setPlacedQuery },
  };
}
