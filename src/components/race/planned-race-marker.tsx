import { CalendarCheck } from "lucide-react";
import { messagesFor } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/** A quiet surface shared by race rows and calendar entries. */
export const PLANNED_RACE_SURFACE =
  "bg-blue-50/80 hover:bg-blue-100/70 active:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 dark:active:bg-blue-950/60";

export const PLANNED_RACE_SELECTED =
  "bg-blue-100 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-950/60";

/** A visible calendar check in full race rows, with a text label for screen readers. */
export function PlannedRaceMarker({ locale, iconClassName }: { locale: string; iconClassName?: string }) {
  return (
    <>
      {iconClassName ? <CalendarCheck className={cn("size-4 shrink-0 text-primary", iconClassName)} aria-hidden /> : null}
      <span className="sr-only">{messagesFor(locale).suggestAdded}</span>
    </>
  );
}
