"use client";

import { useSyncExternalStore } from "react";
import { getSavedRaces, getServerSavedRaces, subscribeSavedRaces } from "@/lib/saved-races";

/** Reuse the existing plan store; subscribing never adds another request. */
export function useSavedRaceIds() {
  return useSyncExternalStore(subscribeSavedRaces, getSavedRaces, getServerSavedRaces).ids;
}
