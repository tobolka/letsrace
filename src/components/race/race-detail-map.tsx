"use client";

import Link from "next/link";
import { Maximize2 } from "lucide-react";
import { RaceMapLazy } from "@/components/map/race-map-lazy";
import type { EventListItem } from "@/lib/events";

const noop = () => {};
const HALF_SPAN = 0.06;

/** The main map, cropped to one race. Zoom stays on the map; the corner
 * button opens the race on the full map. */
export function RaceDetailMap({ event, locale, href, label }: {
  event: EventListItem; locale: string; href: string; label: string;
}) {
  const lat = Number(event.location?.lat), lng = Number(event.location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return (
    <div className="relative h-72 overflow-hidden rounded-xl border sm:h-80">
      <RaceMapLazy
        embedded
        events={[event]}
        selectedId={event.id}
        locale={locale}
        onSelect={noop}
        onBoundsChange={noop}
        padding={{ top: 24, right: 24, bottom: 24, left: 24 }}
        destination={{ west: lng - HALF_SPAN, east: lng + HALF_SPAN, south: lat - HALF_SPAN / 2, north: lat + HALF_SPAN / 2 }}
        destinationSeq={1}
      />
      <Link
        href={href}
        aria-label={label}
        title={label}
        className="absolute right-2.5 top-2.5 z-[700] grid size-10 place-items-center rounded-full bg-white text-stone-800 shadow-[0_1px_5px_#00000026] hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3778d7]"
      >
        <Maximize2 size={18} />
      </Link>
    </div>
  );
}
