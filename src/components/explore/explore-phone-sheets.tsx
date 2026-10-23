"use client";

import { Suspense, type ComponentProps, type RefObject } from "react";
import { EventDetailPanel } from "@/components/explore/event-detail-lazy";
import { ExploreRaceRows, type ExploreRaceRowsProps } from "@/components/explore/explore-race-rows";
import { MobileTopBar } from "@/components/explore/mobile-top-bar";
import {
  COMPACT,
  DETAIL_FULL,
  FULL,
  LIST_PEEK,
  MobileDetailSheet,
  MobileListSheet,
} from "@/components/explore/mobile-sheets";
import { ActiveFilterChips, ListMetaRow } from "@/components/shell/active-filters";
import type { EventListItem } from "@/lib/events";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

type TopBarProps = Omit<
  ComponentProps<typeof MobileTopBar>,
  | "className"
  | "customDateLabel"
  | "filtersLabel"
  | "searchLabel"
  | "searchPlaceholder"
  | "doneLabel"
  | "clearLabel"
>;

/**
 * The phone layout: the list is a sheet that rides on the tab bar and can be
 * pulled up, and a race opens a second sheet above it. Each has one job and
 * neither knows about the other (see `mobile-sheets`). Everything it shows is
 * handed in; what the filters mean and what a tap does is the shell's.
 */
export function ExplorePhoneSheets({
  locale,
  messages,
  listSnap,
  onListSnap,
  detailSnap,
  onDetailSnap,
  viewportH,
  topBar,
  chips,
  meta,
  listRef,
  rows,
  selected,
  onCloseDetail,
  onSelectSeries,
}: {
  locale: string;
  messages: Messages;
  listSnap: number | string;
  onListSnap: (snap: number | string) => void;
  detailSnap: number;
  onDetailSnap: (snap: number) => void;
  viewportH: number;
  topBar: TopBarProps;
  chips: Omit<ComponentProps<typeof ActiveFilterChips>, "locale" | "className">;
  meta: Omit<ComponentProps<typeof ListMetaRow>, "locale">;
  listRef: RefObject<HTMLDivElement | null>;
  rows: Omit<ExploreRaceRowsProps, "variant" | "locale" | "messages" | "groupClassName">;
  selected: EventListItem | null;
  onCloseDetail: () => void;
  onSelectSeries: (slug: string) => void;
}) {
  return (
    <>
      <MobileListSheet
        snap={listSnap}
        onSnap={onListSnap}
        viewportH={viewportH}
        title={messages.racesCount}
        handleLabel={listSnap === LIST_PEEK ? messages.sheetExpand : messages.sheetCollapse}
        mapLabel={messages.navMap}
      >
        <MobileTopBar
          className="-mt-1"
          customDateLabel={messages.customDate}
          filtersLabel={messages.filtersButton}
          searchLabel={messages.search}
          searchPlaceholder={messages.searchPlaceholder}
          doneLabel={messages.filtersDone}
          clearLabel={messages.clearFilter}
          {...topBar}
          onSearchOpenChange={(open) => {
            topBar.onSearchOpenChange(open);
            // The field is at the foot of the screen at the lower stops,
            // which is where the keyboard comes up. Raised, the sheet puts
            // it at the top and the answers right under it.
            if (open) onListSnap(FULL);
          }}
        />

        <div
          id="race-list-mobile"
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain md:hidden"
        >
          <div className="border-b border-border/50">
            <ActiveFilterChips locale={locale} className="pb-0" {...chips} />
            <ListMetaRow locale={locale} {...meta} />
          </div>
          {/* Room under the last race for the "Map" pill the full sheet
              floats over it, so the end of the list can be read. */}
          <ExploreRaceRows
            variant="sheet"
            locale={locale}
            messages={messages}
            groupClassName={cn(listSnap === FULL && "pb-16")}
            {...rows}
          />
        </div>
      </MobileListSheet>

      <MobileDetailSheet
        open={Boolean(selected)}
        snap={detailSnap}
        onSnap={onDetailSnap}
        viewportH={viewportH}
        onClose={onCloseDetail}
        title={selected?.name ?? ""}
        handleLabel={detailSnap === DETAIL_FULL ? messages.sheetCollapse : messages.raceExpand}
      >
        {selected ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Suspense fallback={null}>
              <EventDetailPanel
                event={selected}
                locale={locale}
                embedded
                // The preview says what a race is; one tap shows the rest,
                // without hunting for the grab bar.
                onExpand={detailSnap === COMPACT ? () => onDetailSnap(DETAIL_FULL) : undefined}
                onClose={onCloseDetail}
                onSelectSeries={onSelectSeries}
              />
            </Suspense>
          </div>
        ) : null}
      </MobileDetailSheet>
    </>
  );
}
