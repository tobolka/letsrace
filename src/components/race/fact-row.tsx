import type { ReactNode } from "react";
import { Building2, Clock, Coins, Info, ListOrdered, MapPinned, ParkingSquare, Route } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The practical facts of a race, each with the same icon wherever it is read:
 * on the map's race card and on the race's own page.
 */
export const FACT_ICONS = {
  schedule: <Clock />,
  fees: <Coins />,
  categories: <ListOrdered />,
  routes: <Route />,
  venue: <MapPinned />,
  organizer: <Building2 />,
  parking: <ParkingSquare />,
  about: <Info />,
} satisfies Record<string, ReactNode>;

/**
 * One practical fact: an icon in the margin, a small label, then the fact.
 * The race card and the race page lay their facts out with it, so the two
 * read as the short and the long version of the same thing.
 */
export function FactRow({
  icon,
  label,
  children,
  className,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] gap-x-3 py-3 text-sm leading-snug", className)}>
      <span className="mt-px flex size-4 items-center justify-center text-muted-foreground [&_svg]:size-4" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <h3 className="mb-2 text-[13px] font-semibold text-foreground">{label}</h3>
        {children}
      </div>
    </div>
  );
}

export type FactListRow = { key: string | number; label: ReactNode; value?: ReactNode; lead?: ReactNode };

/** A list inside a fact: a time or the name on the left, its figure on the right. */
export function FactList({ rows }: { rows: FactListRow[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <li key={row.key} className="flex min-w-0 items-baseline gap-3">
          {row.lead ? <span className="shrink-0 font-medium tabular-nums">{row.lead}</span> : null}
          <span className="min-w-0 flex-1 break-words">{row.label}</span>
          {row.value ? <span className="shrink-0 text-right tabular-nums text-muted-foreground">{row.value}</span> : null}
        </li>
      ))}
    </ul>
  );
}
