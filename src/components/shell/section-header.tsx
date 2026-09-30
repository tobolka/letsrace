/**
 * The top of a page in the frame: the name of the section. The logo is the
 * map's alone — every other page says where you are instead of who we are —
 * and the account lives at the foot of the sidebar.
 */
export function SectionHeader({
  title,
  meta,
  actions,
  children,
}: {
  title: string;
  /** Small text beside the title: a count, a month. */
  meta?: React.ReactNode;
  /** Controls at the right end of the title row. */
  actions?: React.ReactNode;
  /** A row of controls under the title — the filters. */
  children?: React.ReactNode;
}) {
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
