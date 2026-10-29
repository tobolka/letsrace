"use client";

import { useSavedRaceIds } from "@/hooks/use-saved-races";
import { PLANNED_RACE_SURFACE } from "@/components/race/planned-race-marker";
import { cn } from "@/lib/utils";

/** A list row that is tinted the same way wherever it is, once the race is in the plan. */
export function PlannedRaceRow({
  eventId,
  className,
  children,
}: {
  eventId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const planned = useSavedRaceIds().has(eventId);
  return (
    <div role="listitem" data-planned={planned || undefined} className={cn(className, planned && PLANNED_RACE_SURFACE)}>
      {children}
    </div>
  );
}
