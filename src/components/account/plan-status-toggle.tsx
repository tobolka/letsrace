"use client";

import { Check, CreditCard, User } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { messagesFor } from "@/lib/i18n/messages";
import { PLAN_MEMBER_STATUSES, type PlanMemberStatus } from "@/lib/planner";
import { cn } from "@/lib/utils";

/**
 * Three steps of one commitment, not three independent switches: entering a
 * race means you are going, and paying means you have entered. The pills fill
 * up to where you are, so a row can be read at a glance instead of opened.
 *
 * Replaces a dropdown that cost two clicks per person per race — six to mark a
 * family paid, on the screen where marking a family paid is the whole point.
 */
const STEPS = ["going", "registered", "paid"] as const satisfies readonly PlanMemberStatus[];

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
}: {
  locale: string;
  value: PlanMemberStatus;
  disabled?: boolean;
  memberName: string;
  eventName: string;
  onChange: (next: PlanMemberStatus) => void;
}) {
  const t = messagesFor(locale);
  const label: Record<(typeof STEPS)[number], string> = {
    going: t.planGoing,
    registered: t.planRegistered,
    paid: t.planPaid,
  };
  const Icon = { going: User, registered: Check, paid: CreditCard };
  const current = planStatusRank(value);

  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      disabled={disabled}
      value={value === "none" ? "" : value}
      onValueChange={(next) => {
        // Pressing the step you are already on steps back off it, which is how
        // you undo "paid" without hunting for a "not going" entry in a menu.
        if (!next) return onChange("none");
        onChange(next as PlanMemberStatus);
      }}
      aria-label={`${memberName} · ${eventName}`}
    >
      {STEPS.map((step) => {
        const StepIcon = Icon[step];
        const reached = current >= RANK[step];
        return (
          <Tooltip key={step}>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value={step}
                aria-label={`${label[step]} — ${memberName}, ${eventName}`}
                aria-pressed={reached}
                className={cn(
                  "px-2",
                  reached && "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                <StepIcon className="size-3.5" aria-hidden />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>{label[step]}</TooltipContent>
          </Tooltip>
        );
      })}
    </ToggleGroup>
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
