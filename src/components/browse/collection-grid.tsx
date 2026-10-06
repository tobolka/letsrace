import Link from "next/link";
import { Baby, Bike, CalendarDays, CalendarHeart, ChevronRight, Users } from "lucide-react";
import type { Locale } from "@/lib/i18n/messages";
import { counted } from "@/lib/seo";
import { collectionCopy, collectionPath, COLLECTION_SLUGS } from "@/lib/race-collections";
import { listCollectionSummaries } from "@/lib/race-collection-data";

const ICONS = { kids: Baby, "kids-weekend": CalendarHeart, youth: Users, amateur: Bike, weekend: CalendarDays };

export async function CollectionGrid({ locale, countryCode }: { locale: Locale; countryCode?: string }) {
  const summaries = await listCollectionSummaries().catch(() => []);
  const copy = collectionCopy[locale];
  return (
    <section className="mt-8" aria-labelledby="collection-heading">
      <h2 id="collection-heading" className="mb-3 text-base font-semibold tracking-tight">{copy.heading}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {COLLECTION_SLUGS.map((slug) => {
          const Icon = ICONS[slug];
          const summary = summaries.find((s) => s.slug === slug && s.countryCode === (countryCode ?? null));
          return (
            <Link key={slug} href={`/${locale}/${collectionPath(slug, countryCode)}`} className="browse-tile group flex min-w-0 items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-offset-2 motion-reduce:transition-none">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/70"><Icon className="size-4" aria-hidden /></span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-sm font-semibold leading-tight">{copy.collections[slug].label}</span>
                {summary ? <span className="text-xs tabular-nums text-muted-foreground">{counted(summary.count, "race", locale)}</span> : null}
              </span>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60 group-hover:text-foreground" aria-hidden />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
