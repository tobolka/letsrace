import { cn } from "@/lib/utils";

/**
 * The surface the map already uses, on the pages that were not using it.
 *
 * The map is one white card on a stone ground: a hairline bar across the top
 * carrying the name and the controls, then dense rows underneath. The account
 * pages were headings floating on the ground above cards of their own, with
 * bigger type and different padding, and the two halves of the app read as two
 * products. This is that card, so they read as one.
 *
 * The metrics are the map's, to the pixel: `px-4` gutters, a `py-2` bar, 14px
 * titles, 12px meta.
 */
export function Panel({
  title,
  actions,
  description,
  bodyClassName,
  className,
  children,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  description?: React.ReactNode;
  bodyClassName?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // `overflow-clip`, not `overflow-hidden`: hidden makes the card a scroll
    // container, and a sticky table heading inside one sticks to the card —
    // which never scrolls — instead of under the app bar.
    <section className={cn("overflow-clip rounded-xl border bg-card shadow-sm", className)}>
      {title || actions ? (
        <div className="flex min-h-11 items-center justify-between gap-2 border-b px-4 py-2">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {description ? (
        <p className="border-b px-4 py-2 text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className={cn(bodyClassName ?? "p-4")}>{children}</div>
    </section>
  );
}

/** A row on a panel, at the same rhythm as a race on the map's list. */
export function PanelRow({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("px-4 py-2.5", className)}>{children}</div>;
}

/**
 * The top of every account page, in one shape.
 *
 * Each page had its own: a bare heading on the plan, a marketing banner with a
 * gradient on Discover, a heading over a narrow column on riders and settings.
 * Moving between tabs moved the title, the width and the voice. This is the
 * same title, line and action slot everywhere.
 */
export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Sits under the title — tabs, a toolbar. */
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-pretty text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

/** Every account page is this wide, so switching tabs never moves the edges. */
export const PAGE_WIDTH = "mx-auto flex w-full max-w-6xl flex-col gap-6";
