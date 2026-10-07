import { format, parseISO } from "date-fns";
import { CircleHelp } from "lucide-react";
import { ItemContent, ItemTitle } from "@/components/ui/item";
import type { EventListItem } from "@/lib/events";
import { messagesFor } from "@/lib/i18n/messages";
import { disciplineLabel } from "@/lib/i18n/taxonomy";
import { UCI_CLASS_LABELS, type UciClass } from "@/lib/taxonomy";
import { formatDistanceKm } from "@/lib/geo/distance";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { disciplineColor } from "@/lib/map-visuals";
import { ExplainedHint } from "@/components/explore/explained-badge";
import { cn } from "@/lib/utils";

/** The row classes of a race in any list — the app's list and the browse pages alike. */
export const EVENT_ROW_CLASS =
  "rounded-none border-0 px-4 py-3 max-md:py-1.5 active:bg-accent [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent/50";

/**
 * What a race row shows: the discipline's colour down the edge, the name on
 * one line, then the date and where, what and which series. One component for
 * every list of races, so a race looks the same in the list, on a country's
 * page and in a series.
 */
export function EventRowBody({
  event,
  locale,
  distanceKm: km,
}: {
  event: EventListItem;
  locale: string;
  distanceKm?: number | null;
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
    <>
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
          \`truncate\` on the rows inside does nothing but overflow. */}
      <ItemContent className="min-w-0 gap-0.5 max-md:gap-0">
        {/*
          One line, cut with an ellipsis. The list is rebuilt when the map
          settles on its real bounds, and cards that change height as their
          names change length drag everything below them — which was the
          whole of this page’s layout shift.
        */}
        <ItemTitle
          // ItemTitle ships \`w-fit\`, which sizes it to its text and defeats
          // any truncation inside it.
          className="w-full min-w-0 text-sm leading-snug"
        >
          <span className="block min-w-0 truncate">{event.name}</span>
        </ItemTitle>
        <span className="flex min-w-0 items-center gap-2 whitespace-nowrap text-xs leading-relaxed max-md:leading-snug">
          <time dateTime={event.startDate} className="shrink-0 font-medium tabular-nums">{dateLabel}</time>
          {event.ageMatch === "possible" ? <UnconfirmedAges locale={locale} /> : null}
          <span className="truncate text-muted-foreground" title={metadataLabel}>{metadataLabel}</span>
          {distanceLabel ? (
            <ExplainedHint explanation={t.distanceFromOrigin} className="ms-auto shrink-0 text-muted-foreground tabular-nums">
              ↗ {distanceLabel}
              <span className="sr-only"> · {t.distanceFromOrigin}</span>
            </ExplainedHint>
          ) : null}
        </span>
      </ItemContent>
    </>
  );
}

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
