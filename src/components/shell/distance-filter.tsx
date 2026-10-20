"use client";

import { LocateFixed, LocateOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import type { OriginStatus } from "@/hooks/use-user-origin";
import { RADIUS_OPTIONS } from "@/lib/explore-params";
import { messagesFor } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/**
 * "Within 50 km of me", as a chip in the filter row.
 *
 * Choosing a distance is what asks for the position, never arriving on the
 * page. While the fix is coming the chip says so; if the browser refuses, the
 * menu says why instead of the filter quietly doing nothing.
 */
export function DistanceFilter({
  locale,
  radius,
  status,
  onRadius,
  compact = false,
  submenu = false,
}: {
  locale: string;
  radius: number | null;
  status: OriginStatus;
  onRadius: (km: number | null) => void;
  compact?: boolean;
  submenu?: boolean;
}) {
  const t = messagesFor(locale);
  // Keep the preference for a later successful location fix, but never show
  // an unavailable radius as an applied filter.
  const unavailable = status === "denied" || status === "outside";
  const unavailableLabel = status === "outside" ? t.distanceOutside : t.distanceDenied;
  const selectedRadius = unavailable ? null : radius;
  const active = selectedRadius != null;
  const fullLabel = active ? t.distanceWithin.replace("{km}", String(selectedRadius)) : t.distanceFilter;
  const label = compact && active ? `${selectedRadius} km` : fullLabel;

  const options = (<>
          <DropdownMenuLabel className="text-xs text-muted-foreground">{t.distanceFilter}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={selectedRadius == null ? "" : String(selectedRadius)}
            onValueChange={(v) => onRadius(v ? Number(v) : null)}
          >
            <DropdownMenuRadioItem value="">{t.distanceAny}</DropdownMenuRadioItem>
            {RADIUS_OPTIONS.map((km) => (
              <DropdownMenuRadioItem key={km} value={String(km)}>
                {t.distanceWithin.replace("{km}", String(km))}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {status === "locating" || unavailable ? (
            <>
              <DropdownMenuSeparator />
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                {status === "locating" ? t.distanceLocating : unavailableLabel}
              </p>
            </>
          ) : null}
  </>);
  if (submenu) return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={cn(active && "bg-accent/70 font-medium")}>
        <LocateFixed /> {t.distanceFilter}
        {active ? <span className="ml-auto text-xs text-muted-foreground">{selectedRadius} km</span> : null}
        {active ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-brand" /> : null}
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="w-56">{options}</DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );

  return (
    <div className="inline-flex shrink-0 items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-label={fullLabel}
            // A distance the browser will not let us measure is not in force,
            // and the chip must not look as if it were.
            title={radius != null && unavailable ? unavailableLabel : undefined}
            className={cn(
              "shrink-0 max-md:h-11 [@media(pointer:coarse)]:h-11",
              active && "rounded-r-none",
            )}
          >
            {status === "locating" && active ? (
              <Spinner />
            ) : unavailable ? (
              <LocateOff />
            ) : (
              <LocateFixed />
            )}
            {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {options}
        </DropdownMenuContent>
      </DropdownMenu>
      {active ? (
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label={t.distanceAny}
          className="rounded-l-none max-md:size-11 [@media(pointer:coarse)]:size-11"
          onClick={() => onRadius(null)}
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}
