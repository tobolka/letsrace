import { BrowseHeaderSkeleton } from "@/components/browse/browse-ui";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** One race: the bar and trail, the name and date, its facts, then the account of it. */
export function RaceSkeleton() {
  return (
    <main className="relative min-h-full bg-background">
      <BrowseHeaderSkeleton depth={4} />
      <div className="relative mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="mt-4 h-5 w-48" />
        <Skeleton className="mt-2 h-5 w-36" />

        <Card className="mt-7 gap-0 py-0 sm:mt-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 border-b px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
              <Skeleton className="h-3 w-20 sm:w-28" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </Card>

        <Skeleton className="mt-3 h-4 w-64" />
        <div className="mt-8 hidden gap-3 sm:flex">
          <Skeleton className="h-10 w-44 rounded-md" />
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>

        <Skeleton className="mt-10 h-6 w-28" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-5/6" />
        <Skeleton className="mt-2 h-4 w-2/3" />
      </div>
    </main>
  );
}
