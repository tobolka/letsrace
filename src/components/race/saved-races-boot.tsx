"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasPendingSave, setSavedRacesNavigate, startSavedRaces } from "@/lib/saved-races";

/**
 * Finishes an "add to plan" begun before sign-in on any page the visitor
 * returns to — the confirmation e-mail lands on the plan, not on the race.
 * Does nothing (and loads nothing) when no race is waiting.
 */
export function SavedRacesBoot() {
  const router = useRouter();
  useEffect(() => {
    setSavedRacesNavigate(router.push);
    if (hasPendingSave()) void startSavedRaces();
  }, [router]);
  return null;
}
