"use client";

import { addDays, format, parseISO } from "date-fns";
import { PlanRow } from "@/components/account/plan-row";
import { WeekendStrip, type BlockedWeekend } from "@/components/account/weekend-board";
import { Badge } from "@/components/ui/badge";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { asLocale, messagesFor } from "@/lib/i18n/messages";
import { pluralize } from "@/lib/i18n/plural";
import {
  weekendSpread,
  type EventPlan,
  type PlanMemberStatus,
  type PlannerMember,
  type WeekendBucket,
} from "@/lib/planner";

/**
 * The season, and then the races in it.
 *
 * The strip and the list used to be two things — a board of weekends, and,
 * behind a calendar/list switch, a table sorted by date with weekend headings
 * of its own. They were the same season told twice. Here the strip is the
 * index and the list below it is the same weekends opened up, so scrolling
 * down from a tile lands on its race.
 */
export function PlanSeason({
  locale,
  weekends,
  past,
  members,
  busyWeekdays,
  blocked,
  currentSaturday,
  freeCount,
  selected,
  busyId,
  onSelectWeekend,
  onBlock,
  onUnblock,
  onStatusChange,
  onDiscard,
}: {
  locale: string;
  weekends: WeekendBucket[];
  past: EventPlan[];
  members: PlannerMember[];
  busyWeekdays: number[];
  blocked: Record<string, BlockedWeekend>;
  currentSaturday: string;
  freeCount: number;
  selected: string | null;
  busyId: string | null;
  onSelectWeekend: (weekend: WeekendBucket) => void;
  onBlock: (saturday: string, note: string) => Promise<void> | void;
  onUnblock: (saturday: string) => Promise<void> | void;
  onStatusChange: (eventId: string, memberId: string, status: PlanMemberStatus) => void;
  onDiscard: (eventId: string) => void;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const booked = weekends.filter((w) => w.plans.length > 0);

  return (
    <section aria-labelledby="plan-season" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="plan-season" className="text-sm font-semibold">
          {t.weekendBoardTitle}
        </h2>
        <p className="text-xs tabular-nums text-muted-foreground">
          {pluralize(freeCount, asLocale(locale), {
            one: t.countFreeOne,
            few: t.countFreeFew,
            many: t.countFreeMany,
          })}
        </p>
      </div>

      <WeekendStrip
        locale={locale}
        weekends={weekends}
        busyWeekdays={busyWeekdays}
        blocked={blocked}
        selected={selected}
        onSelect={onSelectWeekend}
        onBlock={onBlock}
        onUnblock={onUnblock}
      />

      {booked.length > 0 ? (
        <div className="divide-y rounded-xl border bg-card">
          {booked.map((w) => (
            <div key={w.saturday}>
              <div className="flex flex-wrap items-center gap-2 bg-muted/40 px-4 py-1.5 text-xs font-medium">
                <span className="tabular-nums">
                  {format(parseISO(w.saturday), "d. M.", { locale: df })}–
                  {format(addDays(parseISO(w.saturday), 1), "d. M.", { locale: df })}
                </span>
                {w.saturday === currentSaturday ? <Badge>{t.thisWeekend}</Badge> : null}
                <SpreadBadge locale={locale} plans={w.plans} />
              </div>
              <div className="divide-y">
                {w.plans.map((plan) => (
                  <PlanRow
                    key={plan.event.id}
                    locale={locale}
                    plan={plan}
                    members={members}
                    busy={busyId === plan.event.id}
                    onStatusChange={(memberId, status) =>
                      onStatusChange(plan.event.id, memberId, status)
                    }
                    onDiscard={() => onDiscard(plan.event.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {past.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer list-none text-xs text-muted-foreground underline-offset-4 hover:underline">
            {t.planPast} · <span className="tabular-nums">{past.length}</span>
          </summary>
          <div className="mt-2 divide-y rounded-xl border bg-card">
            {past.map((plan) => (
              <PlanRow
                key={plan.event.id}
                locale={locale}
                plan={plan}
                members={members}
                muted
                busy={busyId === plan.event.id}
                onStatusChange={(memberId, status) =>
                  onStatusChange(plan.event.id, memberId, status)
                }
                onDiscard={() => onDiscard(plan.event.id)}
              />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function SpreadBadge({ locale, plans }: { locale: string; plans: EventPlan[] }) {
  const t = messagesFor(locale);
  const spread = weekendSpread(plans);
  if (spread === "single") return null;
  return (
    <Badge variant={spread === "same-day" ? "outline" : "secondary"}>
      {spread === "same-day" ? t.planSameDay : t.planBothDays}
    </Badge>
  );
}
