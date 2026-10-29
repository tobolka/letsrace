"use client";

import { Suspense, useEffect, useState } from "react";
import { EventDetailPanel, loadEventDetailPanel } from "@/components/explore/event-detail-lazy";
import { MobileRaceModal } from "@/components/explore/mobile-sheets";
import { useIsMobile } from "@/hooks/use-mobile";
import type { EventListItem } from "@/lib/events";
import { messagesFor } from "@/lib/i18n/messages";


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
  // The card's code is fetched while the view is idle, so the first click
  // finds it already here; and if it is not, only the card waits.
  useEffect(() => {
    void loadEventDetailPanel();
  }, []);
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
        <Suspense fallback={null}>
          <EventDetailPanel
            event={shown}
            locale={locale}
            embedded
            onClose={onClose}
            onSelectSeries={onSelectSeries}
          />
        </Suspense>
      </MobileRaceModal>
    );
  }

  if (!event) return null;
  // The map's own card, floating and draggable, starting against the right
  // edge so it covers the columns you read least rather than the names.
  return (
    <Suspense fallback={null}>
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
    </Suspense>
  );
}
