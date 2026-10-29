"use client";

import { useState } from "react";
import { PlanSeason, PlanViewToggle } from "@/components/account/plan-season";
import { SectionHeader } from "@/components/shell/section-header";
import type { EventPlan, PlannerMember } from "@/lib/planner";

const members: PlannerMember[] = [
  { id: "anna", name: "Anna", relationship: "self", isSelf: true },
  { id: "boris", name: "Boris", relationship: "child", isSelf: false },
];
const plans = [
  ["one", "Ukázkový silniční závod", "2026-11-07", { anna: "going", boris: "paid" }],
  ["two", "Ukázkový cyklokros", "2026-11-14", { anna: "registered" }],
  ["three", "Uložený závod", "2026-11-21", {}],
].map(([id, name, startDate, memberStatus]) => ({
  event: { id, name, startDate, endDate: null, slug: id, disciplines: ["road"], place: "Liberec", countryCode: "CZ" },
  favorited: true, goingMemberIds: Object.keys(memberStatus as object), memberStatus, registered: false, paid: false, feeAmount: null,
})) as EventPlan[];

export default function Preview() {
  const [day, setDay] = useState<string | null>(null);
  return <div className="absolute inset-0 flex flex-col">
    <SectionHeader title="Náš plán · ukázková data" actions={<PlanViewToggle locale="cs" />} />
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PlanSeason locale="cs" plans={plans} past={[]} members={members} busyWeekdays={[]} blocked={{}} selected={day} busyId={null} onSelectDay={setDay} onSetNote={() => {}} onStatusChange={() => {}} onDiscard={() => {}} />
    </div>
  </div>;
}
