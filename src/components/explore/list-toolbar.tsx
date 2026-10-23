import { RaceCount } from "@/components/shell/race-count";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { EventSort } from "@/lib/geo/distance";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

export function ListToolbar({
  count,
  pending,
  sort,
  distanceEnabled,
  messages,
  locale,
  onSort,
}: {
  count: number | null;
  pending: boolean;
  sort: EventSort;
  distanceEnabled: boolean;
  messages: Messages;
  locale: string;
  onSort: (sort: EventSort) => void;
}) {
  const sortItemClass =
    "transition-[transform,background-color,color,box-shadow] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground data-[state=on]:[@media(hover:hover)_and_(pointer:fine)]:hover:text-background";

  const distanceItem = (
    <ToggleGroupItem
      value="distance"
      disabled={!distanceEnabled}
      className={cn(sortItemClass, !distanceEnabled && "disabled:pointer-events-auto")}
      aria-label={
        distanceEnabled
          ? messages.sortDistance
          : `${messages.sortDistance}. ${messages.sortNeedsLocation}`
      }
    >
      {messages.sortDistance}
    </ToggleGroupItem>
  );

  return (
    // A bottom border inside its 44px, like the list page's row, so the races
    // start on the same line in both.
    <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b px-4">
      <RaceCount count={count} locale={locale} loading={pending} />
      <div className="flex items-center gap-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="xs"
          value={sort}
          onValueChange={(value) => {
            if (value === "date" || value === "distance") onSort(value);
          }}
          aria-label={messages.sortBy}
        >
          <ToggleGroupItem value="date" className={sortItemClass}>
            {messages.date}
          </ToggleGroupItem>
          {distanceEnabled ? (
            distanceItem
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>{distanceItem}</TooltipTrigger>
              <TooltipContent>{messages.sortNeedsLocation}</TooltipContent>
            </Tooltip>
          )}
        </ToggleGroup>
      </div>
    </div>
  );
}
