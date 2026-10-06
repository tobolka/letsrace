import { BrowseHeaderSkeleton, PageIntroSkeleton, TileGridSkeleton } from "@/components/browse/browse-ui";

/** The countries: the bar, the trail, the heading and a grid of country cards. */
export default function Loading() {
  return (
    <main className="min-h-full bg-background">
      <BrowseHeaderSkeleton depth={1} />
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-4 sm:px-6">
        <PageIntroSkeleton button={false} branded />
        <TileGridSkeleton count={5} className="mt-8" />
        <TileGridSkeleton count={6} className="mt-8" />
      </div>
    </main>
  );
}
