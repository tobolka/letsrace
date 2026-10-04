import Link from "next/link";
import type { EventListItem } from "@/lib/events";
import type { Locale } from "@/lib/i18n/messages";
import { eventPagePath } from "@/lib/event-url";
import { disciplineWords, monthHeading, shortDate } from "@/lib/seo-race-copy";
import { Card } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";

/**
 * Races as links a crawler can follow, grouped by month, with the date in the
 * page's language and where and what each one is. Hubs listed forty races in
 * English dates and nothing else; the rest of a country's season had no link
 * to it from anywhere but the sitemap.
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
          <Card className="gap-0 overflow-hidden py-0">
            <ItemGroup>
              {list.map((event) => {
                const place = event.location?.municipality || event.location?.name || null;
                const kind = disciplineWords(event, locale);
                return (
                  <Item key={event.id} asChild size="sm" className="rounded-none border-x-0 border-t-0">
                    <Link href={eventPagePath(locale, event.slug)}>
                      <ItemContent>
                        <ItemTitle>{event.name}</ItemTitle>
                        {place || kind ? (
                          <ItemDescription>{[place, kind].filter(Boolean).join(" · ")}</ItemDescription>
                        ) : null}
                      </ItemContent>
                      <ItemActions>
                        <time className="tabular text-sm text-muted-foreground" dateTime={event.startDate}>
                          {shortDate(event.startDate, locale)}
                        </time>
                      </ItemActions>
                    </Link>
                  </Item>
                );
              })}
            </ItemGroup>
          </Card>
        </section>
      ))}
    </div>
  );
}
