import { messagesFor } from "@/lib/i18n/messages";

/** A quiet surface shared by race rows and calendar entries. */
export const PLANNED_RACE_SURFACE =
  "bg-blue-50/80 hover:bg-blue-100/70 active:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 dark:active:bg-blue-950/60";

export const PLANNED_RACE_SELECTED =
  "bg-blue-100 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-950/60";

/** The tint says it is planned; this only tells a screen reader, with no icon. */
export function PlannedRaceMarker({ locale }: { locale: string }) {
  return <span className="sr-only">{messagesFor(locale).suggestAdded}</span>;
}
