import { BrowseHeaderSkeleton, PageIntroSkeleton, TileGridSkeleton } from "@/components/browse/browse-ui";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * A country or one of its disciplines: tiles to go deeper.
 * The same shell as the page — the map's skeleton would flash a full-screen
 * map ground and then swap it for a document.
 */
export function HubSkeleton() {
  return (
    <article className="min-h-full bg-background">
      <BrowseHeaderSkeleton depth={3} />
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-4 sm:px-6">
        <PageIntroSkeleton branded />
        <Skeleton className="mt-8 mb-3 h-5 w-28" />
        <TileGridSkeleton count={6} />
      </div>
    </article>
  );
}
