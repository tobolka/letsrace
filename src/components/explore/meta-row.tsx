/**
 * One fact about a race: an icon, then its values as badges. The race card on
 * the map and the race's own page both use it, so a race reads the same way
 * wherever you meet it.
 */
export function MetaRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-2.5">
      {/*
        A fixed 1rem track — not shrink-wrapped flex. Lucide defaults to 24px
        and a bare shrink-0 span let the SVG paint into the badge column, so
        “Silnice” sat on top of the bike.
      */}
      <span
        className="mt-0.5 flex size-4 items-center justify-center text-muted-foreground [&_svg]:size-4"
        aria-hidden
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="sr-only">{label}</span>
        {children}
      </div>
    </div>
  );
}
