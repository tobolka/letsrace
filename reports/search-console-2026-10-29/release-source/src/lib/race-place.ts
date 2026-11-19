import type { EventListItem } from "@/lib/events";
import { splitPlace } from "@/lib/places";

const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const UNKNOWN = new Set(["unknown", "tbc", "tbd", "nezname", "mtb", "cyklokros", "cyclocross", "gravel", "silnice"]);

/** A copied race title or discipline is not evidence of a venue. */
export function racePlace(event: Pick<EventListItem, "name" | "location">): string | null {
  for (const raw of [event.location?.municipality, event.location?.name]) {
    const place = splitPlace(raw).town;
    if (place && fold(place) !== fold(event.name) && !UNKNOWN.has(fold(place))) return place;
  }
  return null;
}
