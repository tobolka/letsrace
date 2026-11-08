"use client";

import { Suspense, type ReactNode, type RefObject } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { EventDetailPanel } from "@/components/explore/event-detail-lazy";
import { ExploreRaceRows, type ExploreRaceRowsProps } from "@/components/explore/explore-race-rows";
import { ListToolbar } from "@/components/explore/list-toolbar";
import { PANEL_SLIDE_MS, PanelResizeHandle, type PanelResize } from "@/components/explore/panel-resize";
import { RaceCount } from "@/components/shell/race-count";
import { BrandBar } from "@/components/shell/section-header";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { EventListItem } from "@/lib/events";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/**
 * The desktop layout: the filters and the list in a panel down the left edge
 * that can be dragged wider, and the race card floating beside it over the
 * map. The phone has sheets instead (`ExplorePhoneSheets`).
 *
 * The panel can be put away, the way a maps app folds its side panel: the
 * button beside the logo slides it out, and what is left is a small bar over
 * the map — the logo, the count that brings the list back, and the filters.
 */
export function ExploreDesktopPanel({
  panel,
  locale,
  messages,
  filterBar,
  compactFilterBar,
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
  /** The same filters for the small bar left when the list is put away. */
  compactFilterBar: ReactNode;
  listRef: RefObject<HTMLDivElement | null>;
  toolbar: Pick<React.ComponentProps<typeof ListToolbar>, "count" | "pending" | "sort" | "onSort">;
  rows: Omit<ExploreRaceRowsProps, "variant" | "locale" | "messages" | "groupClassName">;
  selected: EventListItem | null;
  onCloseDetail: () => void;
  onSelectSeries: (slug: string) => void;
}) {
  const { collapsed } = panel;
  return (
      <div className="pointer-events-none absolute inset-0 z-20 hidden md:block">
        <div
          className={cn(
            "absolute inset-y-0 left-0 min-w-0",
            !panel.dragging &&
              "transition-[width,translate,visibility] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            collapsed && "invisible -translate-x-[calc(100%+2rem)]",
          )}
          style={{
            width: panel.width,
            transitionDuration: `${PANEL_SLIDE_MS}ms`,
          }}
          inert={collapsed || undefined}
        >
        <div className="pointer-events-auto flex h-full w-full min-w-0 flex-col overflow-hidden border-r bg-card">
          <BrandBar href={`/${locale}`}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="-mr-2 ml-auto text-muted-foreground"
              aria-label={messages.collapseList}
              aria-controls="race-list"
              aria-expanded
              onClick={() => panel.setCollapsed(true)}
            >
              <PanelLeftClose />
            </Button>
          </BrandBar>
          <div className="relative z-30 flex min-h-12 shrink-0 items-center px-4 py-2">
            {filterBar}
          </div>
          <Separator />
          <ListToolbar {...toolbar} distanceEnabled messages={messages} locale={locale} />
          <div id="race-list" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">
            <div ref={listRef} className="@container min-h-0">
            <ExploreRaceRows variant="panel" locale={locale} messages={messages} {...rows} />
            </div>
          </div>
        </div>
        <PanelResizeHandle resize={panel} label={messages.resizePanel} />
        </div>

        {collapsed ? (
          // What is left of the panel: the filters, how many races they find,
          // and the way back to the list.
          // Dressed like the race card that opens under it — the same corners,
          // border and shadow — so the two read as one stack over the map.
          <div
            className="pointer-events-auto absolute top-3 left-3 flex h-12 w-max max-w-[calc(100%-5rem)] items-center gap-1.5 rounded-xl border bg-card py-1.5 pr-1.5 pl-4 shadow-lg map-list-bar-in"
          >
            <BrandMark href={`/${locale}`} size="xs" className="mr-2.5 shrink-0" />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0 gap-1.5 font-normal"
              aria-label={messages.expandList}
              tooltip={messages.expandList}
              aria-controls="race-list"
              aria-expanded={false}
              onClick={() => panel.setCollapsed(false)}
            >
              <PanelLeftOpen />
              <RaceCount count={toolbar.count} locale={locale} loading={toolbar.pending} className="text-sm text-foreground" />
            </Button>
            <div className="relative z-30 flex min-w-0 items-center">{compactFilterBar}</div>
          </div>
        ) : null}

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
            leftX={collapsed ? 12 : panel.chosen + 12}
            topY={collapsed ? 72 : 12}
          />
          </Suspense>
        )}
      </div>
  );
}
