"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import type { EventListItem } from "@/lib/events";
import { loadCatalogue } from "@/lib/load-catalogue";

/**
 * The open race, kept in the address as `?e=slug` on every race view.
 *
 * Opening a race adds a history entry, so the phone's back gesture closes the
 * card instead of leaving the page; switching to another race while one is
 * open replaces it, so back does not walk through every pin you tapped. A
 * card closed by its own cross steps back over the entry it added, leaving
 * history as it was. A link that arrives with `?e=` opens the race directly,
 * and closing it then just drops the parameter — there is nothing to go back to.
 */
export function useRaceParam() {
  const [slug, setSlug] = useQueryState("e", parseAsString.withDefault(""));
  const pushed = useRef(false);

  // Back already took the entry away; nothing is left to step over.
  useEffect(() => {
    if (!slug) pushed.current = false;
  }, [slug]);

  const open = useCallback(
    (next: string) => {
      if (next === slug) return;
      const push = !slug;
      if (push) pushed.current = true;
      void setSlug(next, { history: push ? "push" : "replace" });
    },
    [slug, setSlug],
  );

  const close = useCallback(() => {
    if (!slug) return;
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
      return;
    }
    void setSlug(null);
  }, [slug, setSlug]);

  /** Closes in place, for a card that hands over to something else (a series). */
  const drop = useCallback(() => {
    pushed.current = false;
    void setSlug(null);
  }, [setSlug]);

  return { slug, open, close, drop };
}

/**
 * The race a `?e=` names, from the races on screen or, for a link to one the
 * filters leave out, from the shared catalogue of upcoming races.
 */
export function useLinkedRace(slug: string, events: EventListItem[]): EventListItem | null {
  const inView = slug ? (events.find((e) => e.slug === slug) ?? null) : null;
  const [linked, setLinked] = useState<EventListItem | null>(null);
  useEffect(() => {
    if (!slug || inView) return;
    let alive = true;
    void loadCatalogue()
      .then((all) => {
        if (alive) setLinked(all.find((e) => e.slug === slug) ?? null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [slug, inView]);
  return inView ?? (linked?.slug === slug ? linked : null);
}
