"use client";

import { Check, CreditCard, User } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { messagesFor } from "@/lib/i18n/messages";
import { PLAN_MEMBER_STATUSES, type PlanMemberStatus } from "@/lib/planner";
import { cn } from "@/lib/utils";

/**
 * Where a rider stands on a race, in one dropdown.
 *
 * Three steps of one commitment — going, entered, paid — and each includes
 * the one before it. They were three switches per rider on every row, which
 * on a family of two made twelve buttons per race; a single field per rider
 * reads as a column and says the one thing that matters: how far along they
 * are. The trigger fills in as they get further.
 */
const STEPS = ["none", "going", "registered", "paid"] as const satisfies readonly PlanMemberStatus[];

const RANK: Record<PlanMemberStatus, number> = { none: 0, going: 1, registered: 2, paid: 3 };

export function planStatusRank(status: PlanMemberStatus): number {
  return RANK[status] ?? 0;
}

export function PlanStatusToggle({
  locale,
  value,
  disabled,
  memberName,
  eventName,
  onChange,
  className,
}: {
  locale: string;
  value: PlanMemberStatus;
  disabled?: boolean;
  memberName: string;
  eventName: string;
  onChange: (next: PlanMemberStatus) => void;
  className?: string;
}) {
  const t = messagesFor(locale);
  const label: Record<PlanMemberStatus, string> = {
    none: t.planNotGoing,
    going: t.planGoing,
    registered: t.planRegistered,
    paid: t.planPaid,
  };
  const Icon: Record<PlanMemberStatus, typeof User | null> = {
    none: null,
    going: User,
    registered: Check,
    paid: CreditCard,
  };
  const current = planStatusRank(value);
  const CurrentIcon = Icon[value];

  return (
    <Select value={value} disabled={disabled} onValueChange={(next) => onChange(next as PlanMemberStatus)}>
      <SelectTrigger
        size="sm"
        aria-label={`${memberName} · ${eventName}`}
        className={cn(
          "w-full min-w-0 gap-1.5 font-normal",
          current === 0 && "text-muted-foreground",
          current === 1 && "border-foreground/30 bg-muted text-foreground",
          current === 2 && "border-foreground/60 bg-foreground/10 text-foreground",
          current === 3 && "border-primary bg-primary text-primary-foreground [&_svg]:!text-primary-foreground",
          className,
        )}
      >
        <SelectValue className="min-w-0">
          {CurrentIcon ? <CurrentIcon className="size-3.5" aria-hidden /> : null}
          <span className="truncate">{label[value]}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {STEPS.map((step) => {
          const StepIcon = Icon[step];
          return (
            <SelectItem key={step} value={step}>
              <span className="flex items-center gap-2">
                {StepIcon ? <StepIcon className="size-3.5" aria-hidden /> : <span className="size-3.5" aria-hidden />}
                {label[step]}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/** "2/3 paid" — what the row adds up to, without reading every cell. */
export function planRowSummary(
  statuses: PlanMemberStatus[],
): { paid: number; entered: number; going: number; total: number } {
  const total = statuses.length;
  return {
    total,
    going: statuses.filter((s) => RANK[s] >= 1).length,
    entered: statuses.filter((s) => RANK[s] >= 2).length,
    paid: statuses.filter((s) => RANK[s] >= 3).length,
  };
}

export { PLAN_MEMBER_STATUSES };
