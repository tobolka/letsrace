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
}: {
  locale: string;
  radius: number | null;
  status: OriginStatus;
  onRadius: (km: number | null) => void;
}) {
  const t = messagesFor(locale);
  const active = radius != null;
  const label = active ? t.distanceWithin.replace("{km}", String(radius)) : t.distanceFilter;

  return (
    <div className="inline-flex shrink-0 items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            // A distance the browser will not let us measure is not in force,
            // and the chip must not look as if it were.
            title={active && status === "denied" ? t.distanceDenied : undefined}
            className={cn(
              "shrink-0 max-md:h-11 [@media(pointer:coarse)]:h-11",
              active && "rounded-r-none",
              active && status === "denied" && "text-muted-foreground line-through",
            )}
          >
            {status === "locating" && active ? (
              <Spinner />
            ) : status === "denied" && active ? (
              <LocateOff />
            ) : (
              <LocateFixed />
            )}
            {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">{t.distanceFilter}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={radius == null ? "" : String(radius)}
            onValueChange={(v) => onRadius(v ? Number(v) : null)}
          >
            <DropdownMenuRadioItem value="">{t.distanceAny}</DropdownMenuRadioItem>
            {RADIUS_OPTIONS.map((km) => (
              <DropdownMenuRadioItem key={km} value={String(km)}>
                {t.distanceWithin.replace("{km}", String(km))}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {status === "locating" || status === "denied" ? (
            <>
              <DropdownMenuSeparator />
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                {status === "locating" ? t.distanceLocating : t.distanceDenied}
              </p>
            </>
          ) : null}
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
