import type { ComponentProps } from "react";
import { RaceCount } from "@/components/shell/race-count";
import { SortMenu } from "@/components/shell/active-filters";
import type { EventSort } from "@/lib/geo/distance";
import type { Messages } from "@/lib/i18n/messages";

export function ListToolbar({
  count,
  dates,
  pending,
  sort,
  distanceEnabled,
  locale,
  onSort,
}: {
  count: number | null;
  dates?: ComponentProps<typeof RaceCount>["dates"];
  pending: boolean;
  sort: EventSort;
  distanceEnabled: boolean;
  messages: Messages;
  locale: string;
  onSort: (sort: EventSort) => void;
}) {
  return (
    // A bottom border inside its 44px, like the list page's row, so the races
    // start on the same line in both.
    <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b px-4">
      <RaceCount count={count} dates={dates} locale={locale} loading={pending} />
      <SortMenu locale={locale} sort={sort} onSort={onSort} distanceEnabled={distanceEnabled} className="-mr-2.5" />
    </div>
  );
}
