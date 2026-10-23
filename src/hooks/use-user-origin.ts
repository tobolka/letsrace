"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { distanceKm } from "@/lib/geo/distance";
import { isInEuropeMap } from "@/lib/geo/europe";

type Origin = { lat: number; lng: number };
/** `outside`: located, but beyond the Europe we cover, so no distance applies. */
export type OriginStatus = "idle" | "locating" | "ready" | "denied" | "outside";

const KEY = "letsrace.origin.v1";

function parseOrigin(raw: string | null): Origin | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Origin;
    return Number.isFinite(v?.lat) && Number.isFinite(v?.lng) && isInEuropeMap(v.lat, v.lng) ? v : null;
  } catch {
    return null;
  }
}

function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// sessionStorage tells nobody when it changes inside this tab.
const listeners = new Set<() => void>();
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function remember(origin: Origin) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(origin));
  } catch {
    /* private mode */
  }
  listeners.forEach((notify) => notify());
}

/**
 * Where the visitor is, asked for only when something needs it.
 *
 * Nothing prompts for location on arrival: the distance filter and the
 * distance sort ask when they are chosen. A fix is kept for the tab's session,
 * so moving between the list and the calendar does not ask again.
 */
export function useUserOrigin() {
  // The server has no session storage, so it and the first client render see
  // no fix; the stored one arrives with the next render.
  const cachedRaw = useSyncExternalStore(subscribe, readRaw, () => null);
  const cached = useMemo(() => parseOrigin(cachedRaw), [cachedRaw]);
  const [fix, setFix] = useState<Origin | null>(null);
  const [attempt, setAttempt] = useState<OriginStatus>("idle");

  const origin = fix ?? cached;
  const status: OriginStatus = attempt !== "idle" ? attempt : cached ? "ready" : "idle";

  const acceptOrigin = useCallback((next: Origin) => {
    if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;
    // A radius around a point in the US would send the map somewhere it has
    // no tiles and no races; keep the European view instead.
    if (!isInEuropeMap(next.lat, next.lng)) {
      setAttempt("outside");
      return;
    }
    setFix((prev) => (prev && distanceKm(prev, next) < 0.3 ? prev : next));
    setAttempt("ready");
    remember(next);
  }, []);

  const locate = useCallback(() => {
    // A fix from earlier in the session answers without asking again.
    const earlier = parseOrigin(readRaw());
    if (earlier) {
      setFix(earlier);
      setAttempt("ready");
      return;
    }
    if (!("geolocation" in navigator)) {
      setAttempt("denied");
      return;
    }
    setAttempt("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => acceptOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setAttempt("denied"),
      { maximumAge: 300_000, timeout: 10_000 },
    );
  }, [acceptOrigin]);

  return { origin, status, locate, acceptOrigin };
}

/** A box around a point that holds every place within `km` of it. */
export function boxAround(origin: Origin, km: number) {
  const dLat = km / 111;
  const dLng = km / (111 * Math.max(0.2, Math.cos((origin.lat * Math.PI) / 180)));
  return {
    west: origin.lng - dLng,
    east: origin.lng + dLng,
    south: origin.lat - dLat,
    north: origin.lat + dLat,
  };
}
