/**
 * The furniture the plan's views share — column heading, month band, gutter —
 * so the races, the sheet and the calendar read as one page, not three.
 */

/** A column heading: one height, one weight, stuck to the top of the scrollport. */
export const PLAN_COLHEAD = "sticky top-0 z-10 h-9 border-b bg-background text-xs font-medium text-muted-foreground";

/** The band a month's rows sit under. Opaque, because it sticks over the rows. */
export const PLAN_MONTH_BAND =
  "border-b bg-[color-mix(in_oklab,var(--muted)_50%,var(--background))] px-4 py-2 text-xs font-semibold tracking-wide first-letter:uppercase md:px-6";

/**
 * The month band sticks just under the column heading while its rows scroll
 * by; 35px tucks its top line under the heading's bottom line (h-9 = 36px).
 */
export const PLAN_MONTH_STICKY = "md:sticky md:top-[35px] md:z-[5]";
