import { BrandMark } from "@/components/brand-mark";
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
 * It is a copy of the real layout rather than a spinner: same full-height map
 * ground, same 400px panel at the same inset, so nothing moves when the page
 * itself takes over.
 */
export default function Loading() {
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-stone-100">
      <div className="absolute inset-0 animate-pulse bg-stone-200" aria-hidden />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-end p-3">
        <Skeleton className="size-9 rounded-full" />
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 hidden items-start p-3 md:flex md:gap-3">
        <Card className="flex h-full w-[400px] flex-col gap-0 overflow-hidden py-0 shadow-lg">
          <div className="flex items-center justify-between px-3 py-3">
            <BrandMark size="sm" />
            <Skeleton className="size-7 rounded-md" />
          </div>
          <div className="flex items-center gap-2 border-t px-3 py-2">
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="ml-auto h-8 w-8 rounded-md" />
          </div>
          <div className="flex items-center justify-between border-t px-3 py-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-7 w-32 rounded-md" />
          </div>
          <div className="flex flex-1 flex-col gap-3 overflow-hidden border-t p-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-4 w-full max-w-[17rem]" />
                <Skeleton className="h-3 w-40" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* On a phone the panel is a sheet at the bottom, so the hint sits there. */}
      <div className="absolute inset-x-0 bottom-0 z-20 md:hidden">
        <Card className="mx-3 mb-3 flex flex-col gap-3 rounded-2xl p-3 shadow-lg">
          <div className="mx-auto h-1 w-10 rounded-full bg-stone-200" aria-hidden />
          <div className="flex items-center gap-2">
            <BrandMark size="sm" mark="lr" />
            <Skeleton className="h-8 flex-1 rounded-md" />
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-56" />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
