import Link from "next/link";
import type { EventListItem } from "@/lib/events";
import type { Locale } from "@/lib/i18n/messages";
import { eventPagePath } from "@/lib/event-url";
import { monthHeading, routeSummary } from "@/lib/seo-race-copy";
import { ageCategoryLabel } from "@/lib/i18n/taxonomy";
import { EventRowBody } from "@/components/explore/event-row-body";
import { PlannedRaceRow } from "@/components/race/planned-race-row";
import { SaveRaceButton } from "@/components/race/save-race-button";

/**
 * Races as links a crawler can follow, grouped by month, each row the same as
 * a row of the app's list — the discipline's colour down the edge, the name,
 * then the date and where, what and which series.
 */
export function RaceLinkList({
  events,
  locale,
  groupByMonth = true,
  headingLevel = "h2",
  distances,
  showFacts = false,
  monthAnchors = false,
  seriesSlug,
}: {
  events: EventListItem[];
  locale: Locale;
  groupByMonth?: boolean;
  headingLevel?: "h2" | "h3";
  /** How far each race is from the page's own, by race id. */
  distances?: Map<string, number>;
  showFacts?: boolean;
  monthAnchors?: boolean;
  seriesSlug?: string;
}) {
  if (!events.length) return null;
  const groups = new Map<string, EventListItem[]>();
  for (const e of events) {
    const key = groupByMonth ? e.startDate.slice(0, 7) : "all";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const Heading = headingLevel;
  return (
    <div className="flex flex-col gap-6">
      {[...groups.entries()].map(([key, list]) => (
        <section key={key} id={monthAnchors && groupByMonth ? `month-${key}` : undefined} className={monthAnchors ? "scroll-mt-16" : undefined} aria-label={groupByMonth ? monthHeading(`${key}-01`, locale) : undefined}>
          {groupByMonth ? (
            <Heading className="mb-2 text-sm font-semibold text-muted-foreground">
              {monthHeading(`${key}-01`, locale)}
            </Heading>
          ) : null}
          {/* Short class names from globals.css: these rows are sent twice, as HTML and as page data. */}
          <div role="list" className="race-list">
            {list.map((event) => (
              <PlannedRaceRow eventId={event.id} key={event.id} className="race-row">
                <Link href={eventPagePath(locale, event.slug)} className="race-row-link" data-series-round={seriesSlug}>
                  <EventRowBody event={event} locale={locale} seriesRound={Boolean(seriesSlug)} distanceKm={distances?.get(event.id)} factsLabel={showFacts ? [...routeSummary(event, locale), ...(event.ageConfidence === "explicit" ? event.ageCategories.map(age => ageCategoryLabel(age, locale)) : [])].join(" · ") : undefined} compact />
                </Link>
                {/* Beside the link, not in it: a crawler follows the row, a rider saves it. */}
                <SaveRaceButton eventId={event.id} raceName={event.name} locale={locale} variant="row" />
              </PlannedRaceRow>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
