import Link from "next/link";
import type { EventListItem } from "@/lib/events";
import type { Locale } from "@/lib/i18n/messages";
import { eventPagePath } from "@/lib/event-url";
import { monthHeading } from "@/lib/seo-race-copy";
import { EVENT_ROW_CLASS, EventRowBody } from "@/components/explore/event-row-body";
import { Item, ItemGroup } from "@/components/ui/item";
import { cn } from "@/lib/utils";
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
}: {
  events: EventListItem[];
  locale: Locale;
  groupByMonth?: boolean;
  headingLevel?: "h2" | "h3";
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
        <section key={key} aria-label={groupByMonth ? monthHeading(`${key}-01`, locale) : undefined}>
          {groupByMonth ? (
            <Heading className="mb-2 text-sm font-semibold text-muted-foreground">
              {monthHeading(`${key}-01`, locale)}
            </Heading>
          ) : null}
          <ItemGroup className="overflow-hidden rounded-xl border">
            {list.map((event) => (
              <PlannedRaceRow eventId={event.id} key={event.id} className="relative border-b border-border/50 last:border-b-0">
                <Item asChild size="sm" className={cn(EVENT_ROW_CLASS, "pr-12 max-md:py-2.5")}>
                  <Link href={eventPagePath(locale, event.slug)} className="relative">
                    <EventRowBody event={event} locale={locale} />
                  </Link>
                </Item>
                {/* Beside the link, not in it: a crawler follows the row, a rider saves it. */}
                <SaveRaceButton eventId={event.id} raceName={event.name} locale={locale} className="absolute right-2 top-1/2 -translate-y-1/2" />
              </PlannedRaceRow>
            ))}
          </ItemGroup>
        </section>
      ))}
    </div>
  );
}
