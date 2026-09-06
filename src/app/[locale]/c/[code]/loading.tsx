import { BrandMark } from "@/components/brand-mark";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The country and discipline hubs are documents, not the map, so they get their
 * own shell — inheriting the map skeleton would flash a full-screen map ground
 * and then replace it with an article.
 */
export default function Loading() {
  return (
    <main className="min-h-[100dvh] bg-background px-4 pb-8 pt-6">
      <div className="mx-auto max-w-2xl py-8">
        <BrandMark size="sm" className="mt-5 block" />
        <Skeleton className="mt-3 h-9 w-64" />
        <Skeleton className="mt-3 h-5 w-48" />
        <Skeleton className="mt-6 h-11 w-40 rounded-md" />

        <div className="mt-6 flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-md" />
          ))}
        </div>

        <Card className="mt-8 gap-0 overflow-hidden py-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 border-b px-4 py-3 last:border-b-0">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-full max-w-sm" />
            </div>
          ))}
        </Card>
      </div>
    </main>
  );
}
