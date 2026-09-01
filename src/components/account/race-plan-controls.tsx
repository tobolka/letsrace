"use client";

import Link from "next/link";
import { PlanStatusToggle } from "@/components/account/plan-status-toggle";
import { memberPlanStatus, type PlanMemberStatus, type PlannerMember } from "@/lib/planner";
import { messagesFor, type Messages } from "@/lib/i18n/messages";

export function memberLabel(member: PlannerMember, t: Messages) {
  return member.isSelf ? t.planSelf : member.name;
}

export function RacePlanControls({
  locale,
  members,
  attendance,
  busy,
  onStatusChange,
  addPeopleHref,
}: {
  locale: string;
  members: PlannerMember[];
  attendance: { member_id: string; status: string; registered: boolean; paid: boolean }[];
  busy?: boolean;
  onStatusChange: (memberId: string, status: PlanMemberStatus) => void;
  addPeopleHref?: string;
}) {
  const t = messagesFor(locale);
  const extras = members.filter((m) => !m.isSelf);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">{t.planWhoGoes}</p>
      <div className="flex flex-col gap-2">
        {members.map((m) => {
          const row = attendance.find((a) => a.member_id === m.id);
          const status = memberPlanStatus(row ?? null);
          return (
            <div key={m.id} className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{memberLabel(m, t)}</span>
              <PlanStatusToggle
                locale={locale}
                value={status}
                disabled={busy}
                memberName={memberLabel(m, t)}
                eventName={t.planWhoGoes}
                onChange={(next) => onStatusChange(m.id, next)}
              />
            </div>
          );
        })}
        {extras.length === 0 && addPeopleHref ? (
          <Link
            href={addPeopleHref}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t.planAddPeople}…
          </Link>
        ) : null}
      </div>
    </div>
  );
}
