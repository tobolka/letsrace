"use client";

import { useCallback, useEffect, useState } from "react";

type Origin = { lat: number; lng: number };
export type OriginStatus = "idle" | "locating" | "ready" | "denied";

const KEY = "letsrace.origin.v1";

function readCached(): Origin | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Origin;
    return Number.isFinite(v?.lat) && Number.isFinite(v?.lng) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Where the visitor is, asked for only when something needs it.
 *
 * Nothing prompts for location on arrival: the distance filter and the
 * distance sort ask when they are chosen. A fix is kept for the tab's session,
 * so moving between the list and the calendar does not ask again.
 */
export function useUserOrigin() {
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [status, setStatus] = useState<OriginStatus>("idle");

  useEffect(() => {
    const cached = readCached();
    if (cached) {
      setOrigin(cached);
      setStatus("ready");
    }
  }, []);

  const locate = useCallback(() => {
    // A fix from earlier in the session answers without asking again.
    const cached = readCached();
    if (cached) {
      setOrigin(cached);
      setStatus("ready");
      return;
    }
    if (!("geolocation" in navigator)) {
      setStatus("denied");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOrigin(next);
        setStatus("ready");
        try {
          window.sessionStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          /* private mode */
        }
      },
      () => setStatus("denied"),
      { maximumAge: 300_000, timeout: 10_000 },
    );
  }, []);

  return { origin, status, locate };
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
