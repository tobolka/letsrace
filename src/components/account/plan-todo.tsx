"use client";

import { format, parseISO } from "date-fns";
import { CircleCheck } from "lucide-react";
import { PlanRow } from "@/components/account/plan-row";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { Panel } from "@/components/account/panel";
import { messagesFor } from "@/lib/i18n/messages";
import type { PlanAction, PlanActionKind } from "@/lib/plan-actions";
import type { PlanMemberStatus, PlannerMember } from "@/lib/planner";

/**
 * The jobs, in the order they fall due.
 *
 * This used to be a filter on the plan — press "needs action" and the same
 * list comes back shorter — which meant the answer to "is there anything I
 * have to do tonight" was a click away and looked exactly like the answer to
 * "what are we riding this year". It is a section of its own now, it says what
 * each race is waiting for, and when there is nothing it says that too, once,
 * in a line.
 */
export function PlanTodo({
  locale,
  actions,
  members,
  busyId,
  onStatusChange,
  onDiscard,
}: {
  locale: string;
  actions: PlanAction[];
  members: PlannerMember[];
  busyId: string | null;
  onStatusChange: (eventId: string, memberId: string, status: PlanMemberStatus) => void;
  onDiscard: (eventId: string) => void;
}) {
  const t = messagesFor(locale);
  const label: Record<PlanActionKind, string> = {
    who: t.planActionWho,
    enter: t.planActionEnter,
    pay: t.planActionPay,
  };
  // "Enter" is a job with no date on it; "entries close Friday" is a job you
  // can miss. When the source states the deadline, that is what the row says.
  const noteFor = (action: PlanAction) =>
    action.closesAt
      ? `${label[action.kind]} · ${t.planEntryCloses.replace(
          "{date}",
          format(parseISO(action.closesAt), "d. M.", { locale: dateFnsLocale(locale) }),
        )}`
      : label[action.kind];

  if (actions.length === 0) {
    return (
      <Panel title={t.planTodoTitle}>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck className="size-4 shrink-0" aria-hidden />
          {t.planTodoEmpty}
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title={t.planTodoTitle}
      bodyClassName="p-0"
      actions={
        <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-xs tabular-nums text-brand">
          {actions.length}
        </span>
      }
    >
      <div className="divide-y">
        {actions.map((action) => (
          <PlanRow
            key={action.plan.event.id}
            locale={locale}
            plan={action.plan}
            members={members}
            busy={busyId === action.plan.event.id}
            note={noteFor(action)}
            onStatusChange={(memberId, status) =>
              onStatusChange(action.plan.event.id, memberId, status)
            }
            onDiscard={() => onDiscard(action.plan.event.id)}
          />
        ))}
      </div>
    </Panel>
  );
}
