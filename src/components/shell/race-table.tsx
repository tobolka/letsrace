"use client";

import { memo } from "react";
import { format, parseISO } from "date-fns";
import { levelFromClassLabel, UnconfirmedAges } from "@/components/explore/event-rows";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EventListItem } from "@/lib/events";
import { countryDisplayName } from "@/lib/geo/europe";
import { eventDistanceKm, formatDistanceKm } from "@/lib/geo/distance";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { ageCategoryLabel, disciplineLabel, raceLevelLabel } from "@/lib/i18n/taxonomy";
import type { ListColumn } from "@/lib/list-columns";
import { disciplineColor } from "@/lib/map-visuals";
import { cn } from "@/lib/utils";

/** How wide each column is. The name takes whatever is left. */
const WIDTH: Record<ListColumn, string> = {
  date: "w-36",
  name: "w-auto min-w-64",
  place: "w-48",
  country: "w-36",
  discipline: "w-40",
  level: "w-36",
  categories: "w-48",
  series: "w-56",
  distance: "w-24 text-right",
};

function cellText(col: ListColumn, event: EventListItem, locale: string, origin: { lat: number; lng: number } | null): string {
  const df = dateFnsLocale(locale);
  switch (col) {
    case "date": {
      const start = parseISO(event.startDate);
      const day = format(start, "EEEEEE", { locale: df });
      if (!event.endDate || event.endDate === event.startDate) return `${day} ${format(start, "d. M.")}`;
      const end = parseISO(event.endDate);
      // "so 3.–4. 10." within a month; both months only when it crosses one.
      return start.getMonth() === end.getMonth()
        ? `${day} ${format(start, "d.")}–${format(end, "d. M.")}`
        : `${day} ${format(start, "d. M.")} – ${format(end, "d. M.")}`;
    }
    case "name":
      return event.name;
    case "place":
      return event.location?.municipality || event.location?.name || "—";
    case "country":
      return event.location?.countryCode ? countryDisplayName(event.location.countryCode, locale) : "";
    case "discipline":
      return event.disciplines.map((d) => disciplineLabel(d, locale)).filter(Boolean).join(", ");
    case "level": {
      const classLevel = levelFromClassLabel(event.classLabel);
      const id = event.level ?? classLevel;
      return [id ? raceLevelLabel(id, locale) : "", classLevel ? "" : event.classLabel].filter(Boolean).join(" · ");
    }
    case "categories":
      return event.ageCategories.map((a) => ageCategoryLabel(a, locale)).join(", ");
    case "series":
      return event.series?.name ?? "";
    case "distance": {
      const km = eventDistanceKm(event, origin);
      return km != null ? formatDistanceKm(km, locale) : "";
    }
  }
}

/**
 * The races as a table, one line each.
 *
 * Every cell is a single truncated line — the full text is in its tooltip and
 * in the race card — so a screen holds three times as many races as the
 * two-line rows did, and the columns are the ones this person chose.
 */
export function RaceTable({
  events,
  columns,
  labels,
  locale,
  origin,
  selectedId,
  onSelect,
}: {
  events: EventListItem[];
  columns: ListColumn[];
  labels: Record<ListColumn, string>;
  locale: string;
  origin: { lat: number; lng: number } | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Table className="table-fixed">
      <TableHeader className="sticky top-0 z-10 bg-card">
        <TableRow className="hover:bg-transparent">
          {columns.map((col, i) => (
            <TableHead
              key={col}
              className={cn(
                "h-9 text-xs font-medium text-muted-foreground",
                WIDTH[col],
                i === 0 && "pl-6",
                i === columns.length - 1 && "pr-6",
              )}
            >
              {labels[col]}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <Row
            key={event.id}
            event={event}
            columns={columns}
            locale={locale}
            origin={origin}
            active={event.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </TableBody>
    </Table>
  );
}

const Row = memo(function Row({
  event,
  columns,
  locale,
  origin,
  active,
  onSelect,
}: {
  event: EventListItem;
  columns: ListColumn[];
  locale: string;
  origin: { lat: number; lng: number } | null;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <TableRow
      data-event-id={event.id}
      data-state={active ? "selected" : undefined}
      tabIndex={0}
      aria-selected={active}
      onClick={() => onSelect(event.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(event.id);
        }
      }}
      className="cursor-pointer border-border/60 outline-none focus-visible:bg-muted"
    >
      {columns.map((col, i) => {
        const text = cellText(col, event, locale, origin);
        return (
          <TableCell
            key={col}
            title={text}
            className={cn(
              "relative h-10 truncate py-0",
              WIDTH[col],
              i === 0 && "pl-6",
              i === columns.length - 1 && "pr-6",
              col === "name" ? "font-medium" : "text-muted-foreground",
              (col === "date" || col === "distance") && "tabular-nums",
              col === "date" && "text-foreground",
            )}
          >
            {i === 0 ? (
              <span
                aria-hidden
                className="absolute inset-y-2 left-2.5 w-[3px] rounded-full"
                style={{ background: disciplineColor(event.disciplines) }}
              />
            ) : null}
            {text}
            {col === "name" && event.ageMatch === "possible" ? (
              <UnconfirmedAges locale={locale} className="ml-2 align-middle" />
            ) : null}
          </TableCell>
        );
      })}
    </TableRow>
  );
});
