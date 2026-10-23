"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MobileRaceModal } from "@/components/explore/mobile-sheets";
import { useIsMobile } from "@/hooks/use-mobile";
import type { EventListItem } from "@/lib/events";
import { messagesFor } from "@/lib/i18n/messages";

const EventDetailPanel = dynamic(() =>
  import("@/components/explore/event-detail-panel").then((m) => ({ default: m.EventDetailPanel })),
);

/**
 * The race you picked: the same floating card the map and the calendar use on
 * a desktop, a full-height sheet over everything on a phone.
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
  // The race stays in the sheet while it slides away, rather than the sheet
  // emptying the moment it is told to close.
  const [shown, setShown] = useState<EventListItem | null>(event);
  if (event && event !== shown) setShown(event);

  if (isMobile) {
    if (!shown) return null;
    return (
      <MobileRaceModal
        open={Boolean(event)}
        onClose={onClose}
        title={shown.name}
        handleLabel={messagesFor(locale).close}
      >
        <EventDetailPanel
          event={shown}
          locale={locale}
          embedded
          onClose={onClose}
          onSelectSeries={onSelectSeries}
        />
      </MobileRaceModal>
    );
  }

  if (!event) return null;
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
