"use client";

import { Suspense, type ReactNode, type RefObject } from "react";
import { EventDetailPanel } from "@/components/explore/event-detail-lazy";
import { ExploreRaceRows, type ExploreRaceRowsProps } from "@/components/explore/explore-race-rows";
import { ListToolbar } from "@/components/explore/list-toolbar";
import { PanelResizeHandle, type PanelResize } from "@/components/explore/panel-resize";
import { BrandBar } from "@/components/shell/section-header";
import { Separator } from "@/components/ui/separator";
import type { EventListItem } from "@/lib/events";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/**
 * The desktop layout: the filters and the list in a panel down the left edge
 * that can be dragged wider, and the race card floating beside it over the
 * map. The phone has sheets instead (`ExplorePhoneSheets`).
 */
export function ExploreDesktopPanel({
  panel,
  locale,
  messages,
  filterBar,
  listRef,
  toolbar,
  rows,
  selected,
  onCloseDetail,
  onSelectSeries,
}: {
  panel: PanelResize;
  locale: string;
  messages: Messages;
  /** The filter bar, built by the shell because it shares its handlers with the phone's sheet. */
  filterBar: ReactNode;
  listRef: RefObject<HTMLDivElement | null>;
  toolbar: Pick<React.ComponentProps<typeof ListToolbar>, "count" | "pending" | "sort" | "onSort">;
  rows: Omit<ExploreRaceRowsProps, "variant" | "locale" | "messages" | "groupClassName">;
  selected: EventListItem | null;
  onCloseDetail: () => void;
  onSelectSeries: (slug: string) => void;
}) {
  return (
      <div className="pointer-events-none absolute inset-0 z-20 hidden md:block">
        <div
          className={cn(
            "absolute inset-y-0 left-0 min-w-0",
            !panel.dragging &&
              "transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          )}
          style={{ width: panel.width }}
        >
        <div className="pointer-events-auto flex h-full w-full min-w-0 flex-col overflow-hidden border-r bg-card">
          <BrandBar href={`/${locale}`} />
          <div className="relative z-30 flex min-h-12 shrink-0 items-center px-4 py-2">
            {filterBar}
          </div>
          <Separator />
          <ListToolbar {...toolbar} distanceEnabled messages={messages} locale={locale} />
          <main id="race-list" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">
            <div ref={listRef} className="@container min-h-0">
            <ExploreRaceRows variant="panel" locale={locale} messages={messages} {...rows} />
            </div>
          </main>
        </div>
        <PanelResizeHandle resize={panel} label={messages.resizePanel} />
        </div>

        {/*
          Its own boundary: the card's code arrives on the first click, and
          without one the wait reached the page's loading screen — the whole
          map went blank for a moment before the card appeared.
        */}
        {selected && (
          <Suspense fallback={null}>
          <EventDetailPanel
            event={selected}
            locale={locale}
            onClose={onCloseDetail}
            onSelectSeries={onSelectSeries}
            leftX={panel.chosen + 12}
          />
          </Suspense>
        )}
      </div>
  );
}
