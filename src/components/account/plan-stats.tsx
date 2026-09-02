"use client";

import { CircleAlert } from "lucide-react";
import { asLocale, messagesFor } from "@/lib/i18n/messages";
import { pluralize } from "@/lib/i18n/plural";
import { cn } from "@/lib/utils";

/**
 * The season in one line, under the title.
 *
 * These were three cards the width of the page, each repeating something
 * visible a few hundred pixels below — the count of the list, the count of the
 * board. As a sentence they cost one line and still say it, and the only one
 * that is a job to do is the only one you can press.
 */
export function PlanStats({
  locale,
  upcoming,
  needsAction,
  freeWeekends,
  onShowAction,
}: {
  locale: string;
  upcoming: number;
  needsAction: number;
  freeWeekends: number;
  onShowAction: () => void;
}) {
  const t = messagesFor(locale);
  const loc = asLocale(locale);
  // Czech and Polish decline the noun after a number, so these read through the
  // plural forms rather than lower-casing a column heading.
  const races = pluralize(upcoming, loc, {
    one: t.countRaceOne,
    few: t.countRaceFew,
    many: t.countRaceMany,
  });
  const free = pluralize(freeWeekends, loc, {
    one: t.countFreeOne,
    few: t.countFreeFew,
    many: t.countFreeMany,
  });

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <span className="tabular-nums text-foreground">{races}</span>
      <span aria-hidden>·</span>
      <span className="tabular-nums">{free}</span>
      {needsAction > 0 ? (
        <>
          <span aria-hidden>·</span>
          <button
            type="button"
            onClick={onShowAction}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-brand/40 px-2 py-0.5",
              "text-xs font-medium tabular-nums text-brand transition-colors hover:bg-brand/10",
            )}
          >
            <CircleAlert className="size-3" aria-hidden />
            {needsAction} {t.planStatsAction.toLowerCase()}
          </button>
        </>
      ) : null}
    </p>
  );
}
