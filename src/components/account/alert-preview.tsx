"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Radar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { asLocale, messagesFor } from "@/lib/i18n/messages";
import { distanceKm, formatDistanceKm } from "@/lib/geo/distance";
import { disciplinesMatch } from "@/lib/race-alerts";
import { eventMapPath } from "@/lib/event-url";

type Row = {
  id: string;
  slug: string;
  name: string;
  startDate: string;
  endDate: string | null;
  disciplines: string[];
  location: { municipality?: string | null; name?: string | null; lat?: number | null; lng?: number | null } | null;
};

type Hit = { id: string; slug: string; name: string; startDate: string; endDate: string | null; km: number };

/**
 * What this setting would actually have caught.
 *
 * A radius and a list of disciplines are abstractions until something counts
 * them: without this the only way to learn that 30 km around your town holds
 * nothing is to wait a month for an inbox that never fills.
 */
export function AlertPreview({
  locale,
  lat,
  lng,
  radiusKm,
  disciplines,
}: {
  locale: string;
  lat: number;
  lng: number;
  radiusKm: number;
  disciplines: string[];
}) {
  const t = messagesFor(locale);
  const loc = asLocale(locale);
  const [hits, setHits] = useState<Hit[] | null>(null);

  useEffect(() => {
    let alive = true;
    setHits(null);
    const run = window.setTimeout(() => {
      void (async () => {
        const today = new Date();
        const until = new Date(today);
        until.setMonth(until.getMonth() + 4);
        // A degree of latitude is ~111 km; longitude shrinks with latitude, and
        // the exact distance filter below cleans up the corners of the box.
        const dLat = radiusKm / 111;
        const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
        const params = new URLSearchParams({
          dateFrom: today.toISOString().slice(0, 10),
          dateTo: until.toISOString().slice(0, 10),
          west: String(lng - dLng),
          east: String(lng + dLng),
          south: String(lat - dLat),
          north: String(lat + dLat),
        });
        try {
          const res = await fetch(`/api/events?${params.toString()}`);
          if (!res.ok || !alive) return;
          const rows = (await res.json()) as Row[];
          const matched: Hit[] = [];
          for (const row of rows) {
            const p = row.location;
            if (p?.lat == null || p?.lng == null) continue;
            const km = distanceKm({ lat, lng }, { lat: p.lat, lng: p.lng });
            if (km > radiusKm) continue;
            if (!disciplinesMatch(row.disciplines ?? [], disciplines)) continue;
            matched.push({
              id: row.id,
              slug: row.slug,
              name: row.name,
              startDate: row.startDate,
              endDate: row.endDate,
              km,
            });
          }
          matched.sort((a, b) => a.km - b.km || a.startDate.localeCompare(b.startDate));
          if (alive) setHits(matched);
        } catch {
          if (alive) setHits([]);
        }
      })();
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(run);
    };
  }, [lat, lng, radiusKm, disciplines]);

  if (hits === null) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
    );
  }

  if (hits.length === 0) {
    return <p className="text-sm text-muted-foreground">{t.alertPreviewNone}</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
        <Radar className="size-3.5 text-muted-foreground" aria-hidden />
        {t.alertPreviewCount.replace("{n}", String(hits.length))}
      </p>
      <ul className="flex flex-col gap-0.5">
        {hits.slice(0, 3).map((h) => (
          <li key={h.id} className="min-w-0 truncate text-xs text-muted-foreground">
            <Link
              href={eventMapPath(locale, {
                slug: h.slug,
                startDate: h.startDate,
                endDate: h.endDate,
              })}
              className="hover:underline"
            >
              {h.name}
            </Link>
            <span className="tabular-nums"> · {formatDistanceKm(h.km, loc)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
