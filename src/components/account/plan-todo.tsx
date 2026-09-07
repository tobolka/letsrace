"use client";

import { CircleCheck } from "lucide-react";
import { PlanRow } from "@/components/account/plan-row";
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

  if (actions.length === 0) {
    return (
      <section aria-labelledby="plan-todo" className="flex flex-col gap-2">
        <h2 id="plan-todo" className="text-sm font-semibold">
          {t.planTodoTitle}
        </h2>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck className="size-4 shrink-0" aria-hidden />
          {t.planTodoEmpty}
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="plan-todo" className="flex flex-col gap-2">
      <h2 id="plan-todo" className="flex items-center gap-2 text-sm font-semibold">
        {t.planTodoTitle}
        <span className="rounded-full bg-brand/10 px-1.5 text-xs tabular-nums text-brand">
          {actions.length}
        </span>
      </h2>
      <div className="divide-y rounded-xl border bg-card">
        {actions.map((action) => (
          <PlanRow
            key={action.plan.event.id}
            locale={locale}
            plan={action.plan}
            members={members}
            busy={busyId === action.plan.event.id}
            note={label[action.kind]}
            onStatusChange={(memberId, status) =>
              onStatusChange(action.plan.event.id, memberId, status)
            }
            onDiscard={() => onDiscard(action.plan.event.id)}
          />
        ))}
      </div>
    </section>
  );
}
