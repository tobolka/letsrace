"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { messagesFor } from "@/lib/i18n/messages";
import {
  PLAN_MEMBER_STATUSES,
  type PlanMemberStatus,
} from "@/lib/planner";
import { cn } from "@/lib/utils";

export function planStatusLabel(status: PlanMemberStatus, t: ReturnType<typeof messagesFor>) {
  if (status === "going") return t.planGoing;
  if (status === "registered") return t.planRegistered;
  if (status === "paid") return t.planPaid;
  return t.planNotGoing;
}

export function PlanStatusMenu({
  locale,
  value,
  disabled,
  labelledBy,
  onChange,
}: {
  locale: string;
  value: PlanMemberStatus;
  disabled?: boolean;
  labelledBy: string;
  onChange: (next: PlanMemberStatus) => void;
}) {
  const t = messagesFor(locale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={value === "none" ? "ghost" : value === "paid" ? "default" : "outline"}
          size="sm"
          disabled={disabled}
          aria-label={labelledBy}
          className={cn("min-w-24 justify-between", value === "none" && "text-muted-foreground")}
        >
          {value === "none" ? "—" : planStatusLabel(value, t)}
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next as PlanMemberStatus)}
        >
          {PLAN_MEMBER_STATUSES.map((status) => (
            <DropdownMenuRadioItem key={status} value={status}>
              {planStatusLabel(status, t)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
