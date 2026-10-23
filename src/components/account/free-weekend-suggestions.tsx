"use client";

import { useEffect, useState } from "react";
import { MapPin, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "@/components/account/panel";
import { AddToPlanButton, RaceItem } from "@/components/race/race-item";
import { messagesFor } from "@/lib/i18n/messages";
import {
  rankSuggestions,
  type Suggestion,
  type SuggestionCandidate,
  type SuggestionContext,
} from "@/lib/plan-suggestions";

/**
 * A weekend with nothing on it is the one moment this page can be useful
 * without being asked. Rather than reporting the hole, it offers what would
 * fill it: the next round of a series already being ridden, then whatever is
 * close enough to drive to.
 */
export function FreeWeekendSuggestions({
  locale,
  from,
  to,
  context,
  title,
  actions,
  onAdd,
}: {
  locale: string;
  /** The span being filled — one day when a day was picked, else the month ahead. */
  from: string;
  to: string;
  context: SuggestionContext;
  title?: string;
  /** Controls in the section's title bar — the day picker. */
  actions?: React.ReactNode;
  onAdd: (eventId: string) => Promise<void> | void;
}) {
  const t = messagesFor(locale);
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const hasHome = context.home != null;
  // No place, no suggestions: forget the last ones rather than show them again
  // when a place comes back.
  if (!hasHome && items !== null) setItems(null);

  useEffect(() => {
    let alive = true;
    // Without a place to measure from, the ranker has nothing to rank by and
    // would offer whatever the catalogue happens to hold that weekend — races
    // three countries away. Ask for the place instead of guessing.
    if (!context.home) return;
    void (async () => {
      const params = new URLSearchParams({ dateFrom: from, dateTo: to });
      if (context.home) {
        // A box wide enough to hold everything the ranker is willing to keep.
        const span = (context.radiusKm * 2.5) / 111;
        params.set("west", String(context.home.lng - span * 1.6));
        params.set("east", String(context.home.lng + span * 1.6));
        params.set("south", String(context.home.lat - span));
        params.set("north", String(context.home.lat + span));
      }
      try {
        const res = await fetch(`/api/events?${params.toString()}`);
        const rows = (await res.json()) as Array<{
          id: string; slug: string; name: string; startDate: string; endDate: string | null;
          disciplines: string[];
          series: { id: string; name: string } | null;
          location: { municipality?: string | null; name?: string | null; countryCode?: string | null; lat?: number | null; lng?: number | null } | null;
        }>;
        if (!alive) return;
        const candidates: SuggestionCandidate[] = rows.map((r) => ({
          id: r.id, name: r.name, slug: r.slug,
          startDate: r.startDate, endDate: r.endDate,
          seriesId: r.series?.id ?? null, seriesName: r.series?.name ?? null,
          disciplines: r.disciplines ?? [],
          place: r.location?.municipality || r.location?.name || null,
          countryCode: r.location?.countryCode ?? null,
          lat: r.location?.lat ?? null, lng: r.location?.lng ?? null,
        }));
        setItems(rankSuggestions(candidates, context));
      } catch {
        if (alive) setItems([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [from, to, context]);

  const reasonLabel: Record<Suggestion["reason"], string> = {
    series: t.suggestSeries,
    nearby: t.suggestNearby,
    discipline: t.suggestOther,
  };
  const ReasonIcon = { series: Repeat, nearby: MapPin, discipline: MapPin };

  // Without a place there is nothing to rank by; the setup checklist asks for
  // one rather than this card offering races three countries away.
  if (!hasHome) return null;

  return (
    <Panel title={title ?? t.suggestTitle} description={t.suggestBody} actions={actions} bodyClassName="p-2">
      <>
        {items === null ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.suggestNone}</p>
        ) : (
          <div className="flex flex-col">
            {items.map((s) => {
              const Icon = ReasonIcon[s.reason];
              return (
                <RaceItem
                  key={s.id}
                  locale={locale}
                  race={{
                    id: s.id,
                    slug: s.slug,
                    name: s.name,
                    startDate: s.startDate,
                    endDate: s.endDate,
                    place: s.place,
                    countryCode: s.countryCode,
                    disciplines: s.disciplines,
                    distanceKm: s.distanceKm,
                  }}
                  tags={
                    <Badge variant={s.reason === "series" ? "default" : "secondary"} className="shrink-0">
                      <Icon className="size-3" aria-hidden /> {reasonLabel[s.reason]}
                    </Badge>
                  }
                  action={
                    <AddToPlanButton
                      locale={locale}
                      raceName={s.name}
                      added={added.has(s.id)}
                      onAdd={async () => {
                        await onAdd(s.id);
                        setAdded((prev) => new Set(prev).add(s.id));
                      }}
                    />
                  }
                />
              );
            })}
          </div>
        )}
      </>
    </Panel>
  );
}
