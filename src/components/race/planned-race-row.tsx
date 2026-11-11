"use client";

import { useSavedRaceIds } from "@/hooks/use-saved-races";
import { PLANNED_RACE_SURFACE } from "@/components/race/planned-race-marker";
import { cn } from "@/lib/utils";

/** A list row that is tinted the same way wherever it is, once the race is in the plan. */
export function PlannedRaceRow({
  eventId,
  inPlan,
  className,
  children,
}: {
  eventId: string;
  inPlan?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const saved = useSavedRaceIds().has(eventId);
  const planned = inPlan || saved;
  return (
    <div role="listitem" data-planned={planned || undefined} className={cn(className, planned && PLANNED_RACE_SURFACE)}>
      {children}
    </div>
  );
}
