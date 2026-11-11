import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { SeriesCard } from "@/components/browse/browse-ui";
import type { EventListItem } from "@/lib/events";
import type { Locale } from "@/lib/i18n/messages";
import { localePath } from "@/lib/localized-paths";
import { counted } from "@/lib/seo";
import { fill, raceCopy, seriesIn, shortDate } from "@/lib/seo-race-copy";
import { cn } from "@/lib/utils";

const INITIAL_COUNT = 6;
const disclosure = {
  cs: { more: "Zobrazit další seriály", less: "Zobrazit méně" },
  en: { more: "Show more series", less: "Show fewer" },
  sk: { more: "Zobraziť ďalšie série", less: "Zobraziť menej" },
  pl: { more: "Pokaż więcej cykli", less: "Pokaż mniej" },
  de: { more: "Mehr Serien anzeigen", less: "Weniger anzeigen" },
};

export function SeriesGrid({ events, locale, title, size = "default", className, extra }: {
  events: EventListItem[];
  locale: Locale;
  title: string;
  size?: "default" | "compact";
  className?: string;
  extra?: ReactNode;
}) {
  const series = seriesIn(events, locale);
  if (!series.length) return null;
  const grid = cn("grid grid-cols-2 sm:grid-cols-3", size === "compact" ? "gap-2" : "gap-3");
  const Heading = size === "compact" ? "h3" : "h2";
  const cards = series.map(({ slug, name, rounds, next }) => (
    <SeriesCard
      key={slug}
      href={localePath(locale, `series/${slug}`)}
      name={name}
      meta={[counted(rounds, "round", locale), next ? fill(raceCopy[locale].nextRound, { date: shortDate(next, locale) }) : null].filter(Boolean).join(" · ")}
      size={size}
    />
  ));

  return (
    <section className={className}>
      <Heading className={size === "compact" ? "mb-2 text-sm font-medium" : "mb-3 text-base font-semibold tracking-tight"}>
        {title}
      </Heading>
      <div className={grid}>{cards.slice(0, INITIAL_COUNT)}{extra}</div>
      {cards.length > INITIAL_COUNT ? (
        <details className="group mt-2">
          <summary className="flex min-h-9 w-fit cursor-pointer list-none items-center gap-1.5 rounded-md px-2 text-sm font-medium hover:bg-accent [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-4 group-open:rotate-180" aria-hidden />
            <span className="group-open:hidden">{disclosure[locale].more}</span>
            <span className="hidden group-open:inline">{disclosure[locale].less}</span>
          </summary>
          <div className={cn(grid, "mt-2 hidden group-open:grid")}>{cards.slice(INITIAL_COUNT)}</div>
        </details>
      ) : null}
    </section>
  );
}
