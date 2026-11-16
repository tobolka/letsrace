"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the site can be put on the phone's home screen, and how.
 *
 * Chrome and Edge on Android announce it once, early, with
 * `beforeinstallprompt`; the event is kept here from the moment this module
 * loads (the tab bar imports it on every page), so the More sheet can offer
 * the browser's own install dialog later. Safari never announces it — there
 * the sheet explains the Share menu instead. Opened from the home screen
 * already, there is nothing to offer.
 */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export type InstallState = "installed" | "prompt" | "manual";

let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

function standalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function snapshot(): InstallState {
  if (installed || standalone()) return "installed";
  return deferred ? "prompt" : "manual";
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The browser's install dialog; false when there is none to show. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") installed = true;
  notify();
  return true;
}

/** "installed" on the server too, so nothing about installing is rendered before the browser can say. */
export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, snapshot, () => "installed");
}
