"use client";

import { memo } from "react";
import { useSavedRaceIds } from "@/hooks/use-saved-races";
import { PlannedRaceMarker, PLANNED_RACE_SURFACE, PLANNED_RACE_SELECTED } from "@/components/race/planned-race-marker";
import { EVENT_ROW_CLASS, EventRowBody } from "@/components/explore/event-row-body";
import { Item } from "@/components/ui/item";
import type { EventListItem } from "@/lib/events";
import { RACE_LEVEL_LABELS, type RaceLevel } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

/**
 * The level a class label merely names, if it does.
 *
 * Many sources file a race's class as "Local" or "Regional", which is the level
 * column again in English. Shown as-is it put "Local" under the name and
 * "Místní" beside it; a class label that is only a level becomes that level.
 */
export function levelFromClassLabel(label: string | null): RaceLevel | null {
  if (!label) return null;
  const folded = label.trim().toLowerCase();
  for (const [id, name] of Object.entries(RACE_LEVEL_LABELS)) {
    if (name.toLowerCase() === folded || id === folded) return id as RaceLevel;
  }
  return null;
}

/**
 * One race in the list.
 *
 * Memoised because the shell re-renders for reasons that have nothing to do
 * with any race in it — the sheet moving, the map settling — and without this
 * every visible card was rebuilt each time, in the middle of an animation.
 */
export const EventCard = memo(function EventCard({
  event,
  locale,
  distanceKm: km,
  active,
  onSelect,
  onHover,
  wrapName = false,
}: {
  event: EventListItem;
  locale: string;
  distanceKm?: number | null;
  active: boolean;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
  /** Let a long name take a second line (see `EventRowBody`). */
  wrapName?: boolean;
}) {
  const planned = useSavedRaceIds().has(event.id);
  return (
    <Item
      asChild
      size="sm"
      // The dividing line lives on the listitem wrapper now — inside it this
      // button is always the last child, so `last:` here would never not match.
      className={cn(
        // `active:` is the press itself. On a phone there is no hover, and a
        // row that does nothing until the card slides up feels like a miss.
        EVENT_ROW_CLASS,
        // `muted/50` over a near-white ground was a shade nobody could see. The
        // race you picked is the one thing on this list worth finding again
        // after you look away from it.
        planned && PLANNED_RACE_SURFACE,
        planned && "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-blue-100/70 dark:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-blue-950/50",
        active && !planned && "bg-muted dark:bg-muted [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted",
        active && planned && PLANNED_RACE_SELECTED,
      )}
    >
      <button
        type="button"
        data-event-id={event.id}
        data-planned={planned || undefined}
        aria-pressed={active}
        onClick={() => onSelect(event.id)}
        onMouseEnter={() => onHover?.(event.id)}
        onMouseLeave={() => onHover?.(null)}
        onFocus={() => onHover?.(event.id)}
        onBlur={() => onHover?.(null)}
        className="relative w-full scroll-my-2 text-left touch-manipulation"
      >
        <EventRowBody event={event} locale={locale} distanceKm={km} wrapName={wrapName} />
        {planned ? <PlannedRaceMarker locale={locale} /> : null}
      </button>
    </Item>
  );
});

export { UnconfirmedAges } from "@/components/explore/event-row-body";
