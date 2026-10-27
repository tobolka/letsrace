"use client";
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";
export function RacePageView({ raceId, slug, hasRegistration, hasPrimaryOutbound, isPast }: { raceId: string; slug: string; hasRegistration: boolean; hasPrimaryOutbound: boolean; isPast: boolean }) {
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (seen.current === raceId) return;
    const timer = window.setTimeout(() => {
    seen.current = raceId;
    track("race_view", { race_id: raceId, slug, location: "race_page", presentation: "page", has_registration: hasRegistration, has_primary_outbound: hasPrimaryOutbound, is_past: isPast });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [raceId, slug, hasRegistration, hasPrimaryOutbound, isPast]);
  return null;
}
