"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { MapBounds, BoundsChangeReason } from "@/components/map/types";
import type { ExploreFilters, RadiusArea } from "@/components/explore/use-map-feed";
import type { EventListItem } from "@/lib/events";
import { todayIso } from "@/lib/date-presets";
import { expandViewport, viewportNeedsFetch } from "@/lib/geo/viewport";

type Refetch = (overrides?: Record<string, unknown>) => Promise<EventListItem[] | null>;

/**
 * What the map's search box and its camera ask of the list.
 *
 * Typing in the box is a race name first and a place second; a camera that
 * settles somewhere new asks for the races there; a flight to a place that
 * was just searched for must not be mistaken for the reader moving the map.
 * `handleBoundsChange` is the one place those rules meet: the first settle
 * loads the list, a settle that ends a flight only records the box, and a
 * settle by the reader or by GPS schedules a viewport search.
 */
export function useMapViewport({
  filters,
  setFilters,
  radiusArea,
  refetch,
  area,
  placed,
  setBounds,
  setCameraBounds,
  flyTo,
}: {
  filters: ExploreFilters;
  setFilters: (patch: Record<string, unknown>) => Promise<unknown>;
  radiusArea: RadiusArea;
  refetch: Refetch;
  area: { get: () => MapBounds | null; set: (box: MapBounds | null) => void };
  placed: { get: () => string; set: (q: string) => void };
  setBounds: (b: MapBounds) => void;
  setCameraBounds: (b: MapBounds) => void;
  flyTo: (box: MapBounds) => void;
}) {
  const initialBoundsFetchDone = useRef(false);
  const destFlyingRef = useRef(false);
  const placeAbortRef = useRef<AbortController | null>(null);
  const searchTimerRef = useRef(0);
  const searchGen = useRef(0);
  const areaTimerRef = useRef(0);
  const searchViewportRef = useRef<(b: MapBounds) => void>(() => {});

  async function flyToPlace(q: string, gen: number): Promise<boolean> {
    placeAbortRef.current?.abort();
    const ac = new AbortController();
    placeAbortRef.current = ac;
    try {
      const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`, { signal: ac.signal });
      if (!res.ok) return false;
      const data = (await res.json()) as { bounds: MapBounds };
      if (!data.bounds || gen !== searchGen.current) return false;
      placed.set(q);
      destFlyingRef.current = true;
      window.clearTimeout(areaTimerRef.current);
      area.set(data.bounds);
      setBounds(data.bounds);
      flyTo(data.bounds);
      void setFilters({
        west: String(data.bounds.west),
        south: String(data.bounds.south),
        east: String(data.bounds.east),
        north: String(data.bounds.north),
        country: [],
      });
      refetch({
        q: "",
        country: [],
        bounds: data.bounds,
        forceBounds: true,
      });
      return true;
    } catch {
      return false;
    }
  }

  async function runSearch(q: string) {
    const gen = ++searchGen.current;
    const trimmed = q.trim();
    if (!trimmed) {
      placed.set("");
      void refetch({ q: "" });
      return;
    }

    // Typed text is a race name first. Half the race names in this catalogue
    // are also places — Sudety, Vysočina, Beskydy — and geocoding those threw
    // away the query, flew the map somewhere, and reported nothing found for a
    // race that is in the catalogue. Only when no race matches is the text
    // treated as a place to go to.
    placed.set("");
    // A search is a find, not a filter: the date window widens to upcoming, so
    // a race in October is not missing just because the bar still said "this
    // weekend". Any date stays one click away for looking back.
    const upcoming = todayIso();
    void setFilters({ dateFrom: upcoming, dateTo: "" });
    const hits = await refetch({
      q: trimmed,
      dateFrom: upcoming,
      dateTo: "",
      skipBounds: true,
      fitMap: true,
    });
    if (gen !== searchGen.current) return;
    if (hits === null || hits.length > 0) return;

    if (trimmed.length >= 3) {
      const ok = await flyToPlace(trimmed, gen);
      if (gen !== searchGen.current) return;
      if (ok) return;
    }
  }

  function handleSearchChange(q: string) {
    void setFilters({ q });
    window.clearTimeout(searchTimerRef.current);
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      placed.set("");
      searchGen.current += 1;
      placeAbortRef.current?.abort();
      void refetch({ q: trimmed });
      return;
    }
    searchTimerRef.current = window.setTimeout(() => {
      void runSearch(q);
    }, 400);
  }

  function handleSearchSubmit() {
    window.clearTimeout(searchTimerRef.current);
    void runSearch(filters.q);
  }

  // The latest filters, for a timer that fires after they have changed.
  useLayoutEffect(() => {
    searchViewportRef.current = (b) => {
      if (filters.series || filters.country.length) return;
      // A name search is a find, not a filter on the current window: let the map
      // move without quietly dropping matches that sit outside it.
      if (filters.q.trim() && !placed.get()) return;
      const last = area.get();
      if (last && !viewportNeedsFetch(last, b)) return;
      const query = expandViewport(b);
      area.set(query);
      void setFilters({
        west: String(query.west),
        south: String(query.south),
        east: String(query.east),
        north: String(query.north),
      });
      refetch({ bounds: query, forceBounds: true });
  
    };
  });

  function scheduleSearchViewport(b: MapBounds, immediate = false) {
    window.clearTimeout(areaTimerRef.current);
    if (immediate) {
      searchViewportRef.current(b);
      return;
    }
    areaTimerRef.current = window.setTimeout(() => {
      searchViewportRef.current(b);
    }, 160);
  }

  useEffect(() => {
    return () => {
      window.clearTimeout(searchTimerRef.current);
      window.clearTimeout(areaTimerRef.current);
      placeAbortRef.current?.abort();
    };
  }, []);

  function handleBoundsChange(b: MapBounds, reason: BoundsChangeReason, camera: MapBounds) {
    setBounds(b);
    // The padded box decides when to fetch; the camera box decides
    // what the list shows. If a pin is on the map it belongs in the
    // list beside it.
    setCameraBounds(camera);
    if (radiusArea) { initialBoundsFetchDone.current = true; return; }
    // First camera settle → load races for this viewport (padded query box)
    if (!initialBoundsFetchDone.current) {
      initialBoundsFetchDone.current = true;
      if (filters.q.trim().length >= 3) {
        void runSearch(filters.q);
        return;
      }
      if (filters.series || filters.country.length) {
        area.set(expandViewport(b));
        refetch({ skipBounds: true, fitMap: true });
      } else {
        const query = expandViewport(b);
        area.set(query);
        refetch({ bounds: query, forceBounds: true });
      }
      return;
    }
    if (destFlyingRef.current) {
      destFlyingRef.current = false;
      area.set(expandViewport(b));
      return;
    }
    if (reason === "user" || reason === "sync") {
      scheduleSearchViewport(b);
      return;
    }
    if (reason === "gps" || reason === "locate") {
      scheduleSearchViewport(b, true);
    }
  }

  return { handleBoundsChange, handleSearchChange, handleSearchSubmit };
}
