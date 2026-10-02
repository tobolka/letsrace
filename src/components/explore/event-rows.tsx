"use client";

import { memo } from "react";
import { CircleHelp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Item, ItemContent, ItemTitle } from "@/components/ui/item";
import type { EventListItem } from "@/lib/events";
import { messagesFor } from "@/lib/i18n/messages";
import { disciplineLabel } from "@/lib/i18n/taxonomy";
import { UCI_CLASS_LABELS, type UciClass } from "@/lib/taxonomy";
import { formatDistanceKm } from "@/lib/geo/distance";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { disciplineColor } from "@/lib/map-visuals";
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
}: {
  event: EventListItem;
  locale: string;
  distanceKm?: number | null;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const t = messagesFor(locale);
  const discLabel = event.disciplines.map((d) => disciplineLabel(d, locale)).filter(Boolean).join(", ");
  const distanceLabel = km != null ? formatDistanceKm(km, locale) : "";
  const df = dateFnsLocale(locale);
  const dateLabel =
    format(parseISO(event.startDate), "d MMM", { locale: df }) +
    (event.endDate && event.endDate !== event.startDate
      ? `–${format(parseISO(event.endDate), "d MMM", { locale: df })}`
      : "");
  const placeLabel = [event.location?.municipality || event.location?.name || "—", event.location?.countryCode].filter(Boolean).join(" · ");
  // The UCI class is what a licensed rider looks for first: "C1", "1.2".
  const uciLabel = event.uciClass ? `UCI ${UCI_CLASS_LABELS[event.uciClass as UciClass] ?? event.uciClass.toUpperCase()}` : null;
  const extraLabel = [uciLabel, discLabel, event.series?.name].filter(Boolean).join(" · ");
  const metadataLabel = [placeLabel, extraLabel].filter(Boolean).join(" · ");

  return (
    <Item
      asChild
      size="sm"
      // The dividing line lives on the listitem wrapper now — inside it this
      // button is always the last child, so `last:` here would never not match.
      className={cn(
        // `active:` is the press itself. On a phone there is no hover, and a
        // row that does nothing until the card slides up feels like a miss.
        "rounded-none border-0 px-4 py-3 max-md:py-1.5 active:bg-accent [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent/50",
        // `muted/50` over a near-white ground was a shade nobody could see. The
        // race you picked is the one thing on this list worth finding again
        // after you look away from it.
        active && "bg-muted dark:bg-muted [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted",
      )}
    >
      <button
        type="button"
        data-event-id={event.id}
        aria-pressed={active}
        onClick={() => onSelect(event.id)}
        className="relative w-full scroll-my-2 text-left touch-manipulation"
      >
        {/*
          The discipline used to be a coloured dot beside the date, which on a
          white list reads as an unread badge — something to clear rather than
          something to tell races apart by. The same colour runs down the edge
          of both lines instead, saying as much without asking to be dismissed.
        */}
        <span
          aria-hidden
          className="absolute inset-y-2.5 left-1.5 w-[3px] rounded-full"
          style={{ background: disciplineColor(event.disciplines) }}
        />
        {/* Without this a flex child refuses to shrink below its content, and
            `truncate` on the rows inside does nothing but overflow. */}
        <ItemContent className="min-w-0 gap-0.5 max-md:gap-0">
          {/*
            One line, cut with an ellipsis. The list is rebuilt when the map
            settles on its real bounds, and cards that change height as their
            names change length drag everything below them — which was the
            whole of this page’s layout shift.
          */}
          <ItemTitle
            // ItemTitle ships `w-fit`, which sizes it to its text and defeats
            // any truncation inside it.
            className="w-full min-w-0 text-sm leading-snug"
          >
            <span className="block min-w-0 truncate">{event.name}</span>
          </ItemTitle>
          <span className="flex min-w-0 items-center gap-2 whitespace-nowrap text-xs leading-relaxed max-md:leading-snug">
            <time dateTime={event.startDate} className="shrink-0 font-medium tabular-nums">{dateLabel}</time>
            {event.ageMatch === "possible" ? <UnconfirmedAges locale={locale} /> : null}
            <span className="truncate text-muted-foreground" title={metadataLabel}>{metadataLabel}</span>
            {distanceLabel && <span className="ms-auto shrink-0 text-muted-foreground tabular-nums" title={t.distanceFromOrigin}>↗ {distanceLabel}<span className="sr-only"> · {t.distanceFromOrigin}</span></span>}
          </span>
        </ItemContent>
      </button>
    </Item>
  );
});

/**
 * Shown while a category filter is on, on a race that is in the list only
 * because we cannot rule it out: the organiser never said who may start.
 */
export function UnconfirmedAges({ locale, className }: { locale: string; className?: string }) {
  const t = messagesFor(locale);
  return (
    <span
      title={t.ageUnconfirmedHelp}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed px-1.5 text-[10px] leading-4 text-muted-foreground",
        className,
      )}
    >
      <CircleHelp className="size-3" aria-hidden />
      {t.ageUnconfirmed}
    </span>
  );
}
