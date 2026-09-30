import { DOC_WIDTH } from "@/components/account/panel";
import { ListSkeleton } from "@/components/explore/list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What a profile page looks like before its data arrives, drawn to the same
 * measurements as the page itself — so the skeleton and the page line up and
 * nothing jumps when one replaces the other.
 */

/** Discover, Riders, Settings, Your areas: a heading and stacked boxes. */
export function DocPageSkeleton({ boxes = 2, withHeading = true }: { boxes?: number; withHeading?: boolean }) {
  return (
    <div className={withHeading ? DOC_WIDTH : "flex w-full flex-col gap-8"} aria-busy>
      {withHeading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      ) : null}
      {Array.from({ length: boxes }, (_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-xl" />
      ))}
    </div>
  );
}

/**
 * The plan: the section header across the sheet, then race rows — the same
 * frame as the race list, with no page margins.
 */
export function PlanPageSkeleton() {
  return (
    <div className="flex min-h-full flex-col md:absolute md:inset-0" aria-busy>
      <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4 md:px-6">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="ml-auto h-8 w-72 max-w-[50%] rounded-md" />
      </div>
      <div className="h-8 border-b bg-muted/40" />
      <ListSkeleton rows={6} />
    </div>
  );
}
