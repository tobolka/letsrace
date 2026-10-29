"use client";

import { ListFilter, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { messagesFor } from "@/lib/i18n/messages";
import { PLAN_MEMBER_STATUSES, type PlannerMember } from "@/lib/planner";
import type { PlanStatusFilter } from "@/lib/plan-filters";

export function PlanFilters({ locale, members, riderId, status, onRider, onStatus, onClear }: {
  locale: string;
  members: PlannerMember[];
  riderId: string;
  status: PlanStatusFilter;
  onRider: (id: string) => void;
  onStatus: (status: PlanStatusFilter) => void;
  onClear: () => void;
}) {
  const t = messagesFor(locale);
  const labels = { none: t.planNotGoing, going: t.planGoing, registered: t.planRegistered, paid: t.planPaid };
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2" role="group" aria-label={t.filtersButton}>
      <Select value={riderId || "all"} onValueChange={(value) => onRider(value === "all" ? "" : value)}>
        <SelectTrigger size="sm" aria-label={t.planFilterRider} className="min-w-0 max-w-full flex-1 sm:max-w-56 sm:flex-none">
          <Users className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t.planAllRiders}</SelectItem>
          {members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={(value) => onStatus(value as PlanStatusFilter)}>
        <SelectTrigger size="sm" aria-label={t.planFilterStatus} className="min-w-0 max-w-full flex-1 sm:max-w-48 sm:flex-none">
          <ListFilter className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t.planAllStatuses}</SelectItem>
          {PLAN_MEMBER_STATUSES.map((step) => <SelectItem key={step} value={step}>{labels[step]}</SelectItem>)}
        </SelectContent>
      </Select>
      {riderId || status !== "all" ? (
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t.clearFilters} title={t.clearFilters} onClick={onClear}>
          <X className="size-3.5" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
