import { BrandMark } from "@/components/brand-mark";

/**
 * The logo bar at the top of the race views — map, list, calendar, browse —
 * the same height, padding and mark in each, so it does not move between them.
 */
export function BrandBar({ href, sticky = false, children }: { href: string; sticky?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`${sticky ? "sticky top-0" : "relative"} z-10 flex h-12 shrink-0 items-center border-b bg-background px-4`}>
      <BrandMark href={href} size="xs" />
      {children}
    </div>
  );
}

/**
 * The top of a page in the frame. The race views (list, calendar) lead with
 * the same logo bar as the map; the profile's pages say where you are.
 */
export function SectionHeader({
  title,
  meta,
  actions,
  children,
  brandHref,
}: {
  title: string;
  /** Small text beside the title: a count, a month. */
  meta?: React.ReactNode;
  /** Controls at the right end of the title row. */
  actions?: React.ReactNode;
  /** A row of controls under the title — the filters. */
  children?: React.ReactNode;
  /**
   * The race views lead with the logo bar the map has, the title then only
   * for screen readers; the profile's pages keep their visible title.
   */
  brandHref?: string;
}) {
  if (brandHref) {
    // On a phone the logo bar was a row of a small screen spent saying where
    // you already are — the map dropped it long ago, and the tab bar names the
    // view. The filter row is the whole header there, with its own gutter.
    return (
      <header className="shrink-0 border-b">
        <div className="max-md:hidden">
          <BrandBar href={brandHref} />
        </div>
        <h1 className="sr-only">{title}</h1>
        {children ? <div className="md:px-6 md:py-3">{children}</div> : null}
      </header>
    );
  }
  return (
    <header className="shrink-0 border-b">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {meta ? <div className="min-w-0 text-sm text-muted-foreground">{meta}</div> : null}
        {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="px-4 pb-3 md:px-6">{children}</div> : null}
    </header>
  );
}
