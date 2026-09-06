import { BrandMark } from "@/components/brand-mark";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** One race, as a document. Same measure and rhythm as the page it stands in for. */
export default function Loading() {
  return (
    <main className="relative min-h-[100dvh] bg-background">
      <div className="relative mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-12">
        <header className="mt-5 sm:mt-6">
          <BrandMark size="sm" />
          <Skeleton className="mt-3 h-10 w-full max-w-md" />
          <Skeleton className="mt-2 h-10 w-2/3" />
          <Skeleton className="mt-4 h-5 w-44" />
          <Skeleton className="mt-2 h-5 w-56" />
        </header>

        <Card className="mt-7 gap-0 py-0 sm:mt-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 border-b px-4 py-4 last:border-b-0"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </Card>

        <Skeleton className="mt-4 h-4 w-72" />
        <Skeleton className="mt-8 h-11 w-full rounded-md sm:w-56" />
      </div>
    </main>
  );
}
