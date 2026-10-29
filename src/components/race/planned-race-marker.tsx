import { CalendarCheck } from "lucide-react";
import { messagesFor } from "@/lib/i18n/messages";

/** A quiet surface shared by race rows and calendar entries. */
export const PLANNED_RACE_SURFACE =
  "bg-blue-50/80 hover:bg-blue-100/70 active:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 dark:active:bg-blue-950/60";

export const PLANNED_RACE_SELECTED =
  "bg-blue-100 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-950/60";

export function PlannedRaceMarker({ locale }: { locale: string }) {
  const label = messagesFor(locale).suggestAdded;
  return (
    <span title={label} className="inline-flex shrink-0 items-center align-middle text-blue-700 dark:text-blue-400">
      <CalendarCheck aria-hidden className="size-3.5" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
