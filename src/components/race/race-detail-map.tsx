"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Maximize2 } from "lucide-react";
import { RaceMapLazy } from "@/components/map/race-map-lazy";
import type { EventListItem } from "@/lib/events";
import { eventPagePath } from "@/lib/event-url";

const noop = () => {};
const MIN_HALF_SPAN = 0.06;

/** The main map, cropped to one race or a handful of them. Zoom stays on the
 * map; the corner button opens the same races on the full map. A pin opens
 * its race's page when several are shown. */
export function RaceDetailMap({ events, locale, href, label }: {
  events: EventListItem[]; locale: string; href: string; label: string;
}) {
  const router = useRouter();
  const located = events.filter((e) => Number.isFinite(Number(e.location?.lat)) && Number.isFinite(Number(e.location?.lng)) && e.location?.lat != null && e.location?.lng != null);
  if (!located.length) return null;
  const lats = located.map((e) => Number(e.location!.lat)), lngs = located.map((e) => Number(e.location!.lng));
  const [south, north] = [Math.min(...lats), Math.max(...lats)], [west, east] = [Math.min(...lngs), Math.max(...lngs)];
  const dLat = Math.max(MIN_HALF_SPAN / 2, (north - south) * 0.1), dLng = Math.max(MIN_HALF_SPAN, (east - west) * 0.1);
  const single = located.length === 1 ? located[0] : null;
  return (
    <div className="relative h-72 overflow-hidden rounded-xl border sm:h-80">
      <RaceMapLazy
        embedded
        events={located}
        selectedId={single?.id}
        locale={locale}
        onSelect={single ? noop : (id) => {
          const slug = located.find((e) => e.id === id)?.slug;
          if (slug) router.push(eventPagePath(locale, slug));
        }}
        onBoundsChange={noop}
        padding={{ top: 24, right: 24, bottom: 24, left: 24 }}
        destination={{ west: west - dLng, east: east + dLng, south: south - dLat, north: north + dLat }}
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
