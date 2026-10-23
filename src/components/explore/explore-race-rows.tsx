import { EventCard } from "@/components/explore/event-rows";
import { ListSkeleton } from "@/components/explore/list-skeleton";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { eventDistanceKm } from "@/lib/geo/distance";
import type { EventListItem } from "@/lib/events";
import type { Messages } from "@/lib/i18n/messages";
import type { ListViewState } from "@/lib/list-view-state";

/**
 * What the map's race list shows: placeholders, the rows, or the way out of an
 * empty answer. The side panel and the phone's sheet draw the same thing; the
 * panel has room to also offer "a race is missing".
 */
export function ExploreRaceRows({
  variant,
  view,
  locale,
  events,
  selectedId,
  distanceOrigin,
  messages,
  groupClassName,
  onSelect,
  onHover,
  onClearFilters,
  onMissingRace,
}: {
  variant: "panel" | "sheet";
  view: ListViewState;
  locale: string;
  events: EventListItem[];
  selectedId: string | null;
  distanceOrigin: { lat: number; lng: number } | null;
  messages: Messages;
  groupClassName?: string;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onClearFilters: () => void;
  /** Panel only: tells us about a race the catalogue does not have. */
  onMissingRace?: () => void;
}) {
  if (view === "empty") {
    const clear = (
      <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
        {messages.clearFilters}
      </Button>
    );
    return (
      <Empty className={variant === "panel" ? "border-0 p-6 md:p-8" : "border-0 p-6"}>
        <EmptyHeader>
          <EmptyTitle>{messages.noResults}</EmptyTitle>
          <EmptyDescription>{messages.weekendNearYou}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {variant === "panel" ? (
            <div className="flex flex-wrap justify-center gap-2">
              {clear}
              <Button type="button" variant="secondary" size="sm" onClick={onMissingRace}>
                {messages.missingRace}
              </Button>
            </div>
          ) : (
            clear
          )}
        </EmptyContent>
      </Empty>
    );
  }
  return (
    <ItemGroup className={groupClassName}>
      {view === "skeleton" ? <ListSkeleton rows={8} /> : null}
      {view === "rows"
        ? events.map((event) => (
            <div role="listitem" key={event.id} className="border-b border-border/50 last:border-b-0">
              <EventCard
                event={event}
                locale={locale}
                distanceKm={eventDistanceKm(event, distanceOrigin)}
                active={event.id === selectedId}
                onSelect={onSelect}
                onHover={onHover}
              />
            </div>
          ))
        : null}
    </ItemGroup>
  );
}
