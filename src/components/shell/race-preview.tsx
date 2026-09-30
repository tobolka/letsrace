"use client";

import dynamic from "next/dynamic";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import type { EventListItem } from "@/lib/events";

const EventDetailPanel = dynamic(() =>
  import("@/components/explore/event-detail-panel").then((m) => ({ default: m.EventDetailPanel })),
);

/**
 * The race you picked, beside the list on a desktop and over it on a phone.
 *
 * On the map the card floats and can be dragged out of the way of the pins.
 * Here there is nothing to uncover, so it is a fixed column: the list keeps its
 * place and the card never covers a row you are reading.
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

  return (
    <aside className="hidden w-[340px] shrink-0 flex-col border-l bg-card md:flex">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <EventDetailPanel
          event={event}
          locale={locale}
          embedded
          onClose={onClose}
          onSelectSeries={onSelectSeries}
        />
      </div>
    </aside>
  );
}
