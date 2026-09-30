"use client";

import dynamic from "next/dynamic";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import type { EventListItem } from "@/lib/events";

const EventDetailPanel = dynamic(() =>
  import("@/components/explore/event-detail-panel").then((m) => ({ default: m.EventDetailPanel })),
);

/**
 * The race you picked: the same floating card the map and the calendar use on
 * a desktop, a sheet from the bottom on a phone.
 */
export function RacePreview({
  event,
  locale,
  onClose,
  onSelectSeries,
}: {
  event: EventListItem | null;
  locale: string;
  onClose: () => void;
  onSelectSeries?: (slug: string) => void;
}) {
  const isMobile = useIsMobile();
  if (!event) return null;

  if (isMobile) {
    return (
      <Drawer open onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="h-[85dvh] max-h-[85dvh]">
          <DrawerTitle className="sr-only">{event.name}</DrawerTitle>
          <DrawerDescription className="sr-only">{event.name}</DrawerDescription>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1 pb-1">
            <EventDetailPanel
              event={event}
              locale={locale}
              embedded
              onClose={onClose}
              onSelectSeries={onSelectSeries}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // The map's own card, floating and draggable, starting against the right
  // edge so it covers the columns you read least rather than the names.
  return (
    <EventDetailPanel
      event={event}
      locale={locale}
      dockRight
      // Below the header, the filters and the sort row, so none of the
      // list's own controls end up under it.
      dockTop={168}
      onClose={onClose}
      onSelectSeries={onSelectSeries}
    />
  );
}
