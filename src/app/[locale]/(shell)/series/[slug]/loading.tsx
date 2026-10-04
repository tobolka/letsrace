import { BrowseHeaderSkeleton, PageIntroSkeleton, RaceListSkeleton } from "@/components/browse/browse-ui";
import { Skeleton } from "@/components/ui/skeleton";

/** A series: its name, what it is, then its rounds by month. */
export default function Loading() {
  return (
    <main className="min-h-full bg-background">
      <BrowseHeaderSkeleton depth={4} />
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-4 sm:px-6">
        <PageIntroSkeleton branded />
        <Skeleton className="mt-8 mb-3 h-5 w-44" />
        <RaceListSkeleton rows={4} />
        <RaceListSkeleton rows={4} className="mt-6" />
      </div>
    </main>
  );
}
