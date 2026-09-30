"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CalendarPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { disciplineLabel } from "@/lib/i18n/taxonomy";
import { formatDistanceKm } from "@/lib/geo/distance";
import { eventMapPath } from "@/lib/event-url";
import { disciplineColor } from "@/lib/map-visuals";
import { cn } from "@/lib/utils";

export type RaceItemData = {
  id: string;
  slug: string;
  name: string;
  startDate: string;
  endDate?: string | null;
  place?: string | null;
  countryCode?: string | null;
  disciplines?: string[];
  distanceKm?: number | null;
};

/**
 * One race, the way every list outside the map shows it.
 *
 * Discover had three lists and each drew a race its own way — a date tile in
 * one, a bare line of text in the next, a grey card in the third — so the same
 * race looked like three different things. This is the one shape: a date
 * tile edged in the discipline's colour, the name, one line of facts in a
 * fixed order (place · country · discipline · distance), optional badges for
 * why it is here, and one action on the right.
 *
 * `leading` replaces the date tile for rows that are not a single race — a
 * series, say — so they still line up with the races around them.
 */
export function RaceItem({
  race,
  locale,
  tags,
  action,
  leading,
  title,
  meta,
  className,
}: {
  race?: RaceItemData;
  locale: string;
  /** Badges after the facts: why this race is being shown. */
  tags?: ReactNode;
  /** One control on the right — usually `AddToPlanButton`. */
  action?: ReactNode;
  /** Instead of the date tile, for rows that are not one race. */
  leading?: ReactNode;
  /** Instead of the race's name link. */
  title?: ReactNode;
  /** Instead of the line of facts. */
  meta?: ReactNode;
  className?: string;
}) {
  const df = dateFnsLocale(locale);
  const start = race ? parseISO(race.startDate) : null;
  const facts = race
    ? [
        race.place,
        race.countryCode,
        race.disciplines?.map((d) => disciplineLabel(d, locale)).filter(Boolean).slice(0, 2).join(", "),
        race.distanceKm != null ? formatDistanceKm(race.distanceKm, locale) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50",
        className,
      )}
    >
      {leading ??
        (race && start ? (
          <time
            dateTime={race.startDate}
            className="flex w-11 shrink-0 flex-col items-center rounded-md border border-l-[3px] bg-background py-1.5 text-center"
            style={{ borderLeftColor: disciplineColor(race.disciplines) }}
          >
            <span className="text-base leading-none font-semibold tabular-nums">{format(start, "d")}</span>
            <span className="mt-0.5 text-[10px] font-medium text-muted-foreground uppercase">
              {format(start, "LLL", { locale: df })}
            </span>
          </time>
        ) : null)}

      <div className="min-w-0 flex-1">
        {title ??
          (race ? (
            <Link
              href={eventMapPath(locale, { slug: race.slug, startDate: race.startDate, endDate: race.endDate ?? null })}
              className="block truncate text-sm font-medium hover:underline"
            >
              {race.name}
            </Link>
          ) : null)}
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {tags}
          <span className="truncate">{meta ?? facts}</span>
        </div>
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** "Add to plan", as an icon, with the same three states everywhere. */
export function AddToPlanButton({
  locale,
  raceName,
  added,
  onAdd,
}: {
  locale: string;
  raceName: string;
  added: boolean;
  onAdd: () => Promise<unknown> | unknown;
}) {
  const t = messagesFor(locale);
  const [busy, setBusy] = useState(false);
  const label = added ? t.suggestAdded : t.suggestAdd;
  return (
    <Button
      type="button"
      size="icon-sm"
      variant={added ? "ghost" : "secondary"}
      disabled={added || busy}
      aria-label={`${label} — ${raceName}`}
      title={label}
      onClick={async () => {
        setBusy(true);
        try {
          await onAdd();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Spinner /> : added ? <Check /> : <CalendarPlus />}
    </Button>
  );
}
