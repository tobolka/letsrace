/**
 * The furniture the plan's views share — column heading, month band, gutter —
 * so the races, the sheet and the calendar read as one page, not three.
 */

/** A column heading: one height, one weight, stuck to the top of the scrollport. */
export const PLAN_COLHEAD = "sticky top-0 z-10 h-9 border-b bg-background text-xs font-medium text-muted-foreground";

/** The band a month's rows sit under. */
export const PLAN_MONTH_BAND =
  "border-b bg-muted/50 px-4 py-2 text-xs font-semibold tracking-wide first-letter:uppercase md:px-6";
