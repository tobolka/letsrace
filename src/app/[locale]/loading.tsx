import { BrandMark } from "@/components/brand-mark";
import { ListSkeleton } from "@/components/explore/list-skeleton";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The shell, sent before the races are known.
 *
 * The page awaits a list that takes about a second, and until this existed the
 * server sent nothing at all until it had one — a second and a half of white
 * window after you pressed enter. This is what Next streams first, so the app
 * is on screen immediately and the races drop into it when they arrive.
 *
 * Every measurement here is copied from the component it stands in for, not
 * approximated: the same h-12 header, the same md wordmark, the same 400px
 * panel at the same inset, the same 90px list rows. A skeleton that is nearly
 * right is worse than none — the swap becomes a flinch.
 */
export default function Loading() {
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-stone-100">
      <div className="absolute inset-0 animate-pulse bg-stone-200" aria-hidden />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-end p-3">
        <Skeleton className="size-9 rounded-full" />
      </div>

      {/* Desktop: the panel Card, mirroring ExploreShell's own chrome. */}
      <div className="pointer-events-none absolute inset-0 z-20 hidden items-start p-3 md:flex md:gap-3">
        <Card className="flex h-full w-[400px] flex-col gap-0 overflow-hidden py-0 shadow-lg">
          <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
            <BrandMark size="md" />
            <Skeleton className="size-7 rounded-md" />
          </div>
          <div className="relative flex min-h-12 shrink-0 items-center gap-2 px-3 py-2">
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="ml-auto h-8 w-8 rounded-md" />
          </div>
          <div className="flex h-10 shrink-0 items-center justify-between border-y px-3">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-7 w-32 rounded-md" />
          </div>
          <div className="flex flex-1 flex-col overflow-hidden">
            <ListSkeleton rows={8} />
          </div>
        </Card>
      </div>

      {/* Phone: the chrome lives in a bottom sheet, so the shell does too. */}
      <div className="absolute inset-x-0 bottom-0 z-20 md:hidden">
        <div className="rounded-t-2xl bg-card pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(28,25,23,.12)]">
          <div className="mx-auto mt-2 mb-3 h-1 w-10 rounded-full bg-stone-200" aria-hidden />
          <div className="flex items-center gap-2 px-3 pb-2">
            <BrandMark mark="lr" size="sm" className="shrink-0 px-0.5" />
            <Skeleton className="h-8 w-28 shrink-0 rounded-md" />
            <Skeleton className="h-8 w-20 shrink-0 rounded-md" />
            <Skeleton className="ml-auto size-8 shrink-0 rounded-md" />
          </div>
          <ListSkeleton rows={3} compact />
        </div>
      </div>
    </div>
  );
}
