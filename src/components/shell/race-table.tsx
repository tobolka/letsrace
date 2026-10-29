"use client";

import { memo } from "react";
import { useSavedRaceIds } from "@/hooks/use-saved-races";
import { PlannedRaceMarker, PLANNED_RACE_SURFACE } from "@/components/race/planned-race-marker";
import { format, parseISO } from "date-fns";
import { levelFromClassLabel, UnconfirmedAges } from "@/components/explore/event-rows";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EventListItem } from "@/lib/events";
import { countryDisplayName } from "@/lib/geo/europe";
import { eventDistanceKm, formatDistanceKm } from "@/lib/geo/distance";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { ageCategoryLabel, disciplineLabel, raceLevelLabel } from "@/lib/i18n/taxonomy";
import { UCI_CLASS_LABELS, type UciClass } from "@/lib/taxonomy";
import type { ListColumn } from "@/lib/list-columns";
import { disciplineColor } from "@/lib/map-visuals";
import { cn } from "@/lib/utils";

/** How wide each column is. The name takes whatever is left. */
const WIDTH: Record<ListColumn, string> = {
  date: "w-36",
  name: "w-auto",
  place: "w-48",
  country: "w-36",
  discipline: "w-40",
  level: "w-36",
  categories: "w-48",
  series: "w-56",
  distance: "w-24 text-right",
};

/** Pixel widths of the fixed columns (w-36 = 144px …), the name at least 256. */
const MIN_PX: Record<ListColumn, number> = {
  date: 144,
  name: 256,
  place: 192,
  country: 144,
  discipline: 160,
  level: 144,
  categories: 192,
  series: 224,
  distance: 96,
};

function tableMinWidth(columns: ListColumn[]): number {
  return columns.reduce((sum, col) => sum + MIN_PX[col], 0);
}

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
      const uci = event.uciClass ? `UCI ${UCI_CLASS_LABELS[event.uciClass as UciClass] ?? event.uciClass.toUpperCase()}` : "";
      return [uci, id ? raceLevelLabel(id, locale) : "", classLevel ? "" : event.classLabel].filter(Boolean).join(" · ");
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

export type ListSort = { column: ListColumn; direction: "asc" | "desc" };

export function sortTableEvents(events: EventListItem[], sort: ListSort, locale: string, origin: { lat: number; lng: number } | null): EventListItem[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  const values = new Map(events.map((event) => [event.id,
    sort.column === "distance" ? eventDistanceKm(event, origin)
      : sort.column === "date" ? event.startDate
        : cellText(sort.column, event, locale, origin),
  ]));
  return [...events].sort((a, b) => {
    const av = values.get(a.id);
    const bv = values.get(b.id);
    // Missing values stay at the end in both directions.
    if (av == null || av === "" || av === "—") return bv == null || bv === "" || bv === "—" ? 0 : 1;
    if (bv == null || bv === "" || bv === "—") return -1;
    const comparison = typeof av === "number" && typeof bv === "number" ? av - bv : collator.compare(String(av), String(bv));
    return comparison * (sort.direction === "asc" ? 1 : -1);
  });
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
  sort,
  onSort,
}: {
  events: EventListItem[];
  columns: ListColumn[];
  labels: Record<ListColumn, string>;
  locale: string;
  origin: { lat: number; lng: number } | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  sort: ListSort;
  onSort: (column: ListColumn) => void;
}) {
  const plannedIds = useSavedRaceIds();
  return (
    // A fixed layout ignores a column's min-width, so the free column — the
    // race's name — shrank to nothing on a narrow window and its heading
    // drew over the next one. The table itself holds the minimum instead,
    // and scrolls sideways when the window is narrower.
    <Table className="table-fixed" style={{ minWidth: tableMinWidth(columns) }}>
      <TableHeader className="sticky top-0 z-10 bg-card">
        <TableRow className="hover:bg-transparent">
          {columns.map((col, i) => (
            <TableHead
              key={col}
              aria-sort={sort.column === col ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
              className={cn(
                "h-9 text-xs font-medium text-muted-foreground",
                WIDTH[col],
                i === 0 && "pl-4",
                i === columns.length - 1 && "pr-4",
              )}
            >
              <button
                type="button"
                onClick={() => onSort(col)}
                className={cn("flex h-full w-full cursor-pointer items-center gap-1.5 rounded-sm text-left hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring", col === "distance" && "justify-end", sort.column === col && "text-foreground")}
              >
                {labels[col]}
                {sort.column === col ? <span aria-hidden="true">{sort.direction === "asc" ? "↑" : "↓"}</span> : null}
              </button>
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
            planned={plannedIds.has(event.id)}
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
  planned,
  onSelect,
}: {
  event: EventListItem;
  columns: ListColumn[];
  locale: string;
  origin: { lat: number; lng: number } | null;
  active: boolean;
  planned: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <TableRow
      data-event-id={event.id}
      data-planned={planned || undefined}
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
      className={cn(
        "cursor-pointer border-border/60 outline-none focus-visible:bg-muted",
        planned && PLANNED_RACE_SURFACE,
        planned && "focus-visible:bg-blue-100 data-[state=selected]:bg-blue-100 dark:focus-visible:bg-blue-950/60 dark:data-[state=selected]:bg-blue-950/60",
      )}
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
              i === 0 && "pl-4",
              i === columns.length - 1 && "pr-4",
              col === "name" ? "font-medium" : "text-muted-foreground",
              (col === "date" || col === "distance") && "tabular-nums",
              col === "date" && "text-foreground",
            )}
          >
            {i === 0 ? (
              <span
                aria-hidden
                className="absolute inset-y-2 left-1.5 w-[3px] rounded-full"
                style={{ background: disciplineColor(event.disciplines) }}
              />
            ) : null}
            {col === "name" && planned ? <PlannedRaceMarker locale={locale} /> : null}
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
