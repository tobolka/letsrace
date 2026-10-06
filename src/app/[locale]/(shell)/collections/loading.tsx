import { BrowseHeaderSkeleton, PageIntroSkeleton, RaceListSkeleton } from "@/components/browse/browse-ui";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-full bg-background">
      <BrowseHeaderSkeleton depth={3} />
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-4 sm:px-6">
        <PageIntroSkeleton button={false} />
        <Skeleton className="mt-4 h-4 w-52" />
        <div className="mt-6 flex gap-2">{[1, 2, 3].map((key) => <Skeleton key={key} className="h-8 w-24 rounded-md" />)}</div>
        <RaceListSkeleton className="mt-8" />
      </div>
    </main>
  );
}
