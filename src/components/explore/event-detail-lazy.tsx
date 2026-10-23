"use client";

import dynamic from "next/dynamic";

/** Starts fetching the race card's code; the shell calls it once the map is idle. */
export const loadEventDetailPanel = () =>
  import("@/components/explore/event-detail-panel").then((m) => ({
    default: m.EventDetailPanel,
  }));

/** The card arrives on first use, so it is not in the map's first download. */
export const EventDetailPanel = dynamic(loadEventDetailPanel);
