"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus, MapPin, Repeat, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { messagesFor } from "@/lib/i18n/messages";
import { formatDistanceKm } from "@/lib/geo/distance";
import { eventMapPath } from "@/lib/event-url";
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
  saturday,
  sunday,
  context,
  title,
  onAdd,
}: {
  locale: string;
  saturday: string;
  sunday: string;
  context: SuggestionContext;
  /** Set when the weekend being filled is not the current one. */
  title?: string;
  onAdd: (eventId: string) => Promise<void> | void;
}) {
  const t = messagesFor(locale);
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const hasHome = context.home != null;

  useEffect(() => {
    let alive = true;
    // Without a place to measure from, the ranker has nothing to rank by and
    // would offer whatever the catalogue happens to hold that weekend — races
    // three countries away. Ask for the place instead of guessing.
    if (!context.home) {
      setItems(null);
      return () => {
        alive = false;
      };
    }
    void (async () => {
      const params = new URLSearchParams({ dateFrom: saturday, dateTo: sunday });
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
  }, [saturday, sunday, context]);

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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title ?? t.suggestTitle}</CardTitle>
        <CardDescription>{t.suggestBody}</CardDescription>
      </CardHeader>
      <CardContent>
        {items === null ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.suggestNone}</p>
        ) : (
          <ItemGroup>
            {items.map((s) => {
              const Icon = ReasonIcon[s.reason];
              const isAdded = added.has(s.id);
              const meta = [
                s.place,
                s.distanceKm != null ? formatDistanceKm(s.distanceKm, locale) : null,
                s.seriesName,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <Item key={s.id} size="sm">
                  <ItemContent className="min-w-0">
                    <ItemTitle className="w-full min-w-0">
                      <Link
                        href={eventMapPath(locale, {
                          slug: s.slug,
                          startDate: s.startDate,
                          endDate: s.endDate,
                        })}
                        className="truncate hover:underline"
                      >
                        {s.name}
                      </Link>
                    </ItemTitle>
                    <ItemDescription className="flex items-center gap-1.5">
                      <Badge variant={s.reason === "series" ? "default" : "secondary"}>
                        <Icon className="size-3" aria-hidden /> {reasonLabel[s.reason]}
                      </Badge>
                      <span className="truncate">{meta}</span>
                    </ItemDescription>
                  </ItemContent>
                  {/* The card lives in a narrow rail: a labelled button here
                      left about eight characters for the race name. */}
                  <Button
                    type="button"
                    size="icon-sm"
                    className="shrink-0"
                    variant={isAdded ? "ghost" : "secondary"}
                    disabled={isAdded || busy === s.id}
                    aria-label={`${isAdded ? t.suggestAdded : t.suggestAdd} — ${s.name}`}
                    title={isAdded ? t.suggestAdded : t.suggestAdd}
                    onClick={async () => {
                      setBusy(s.id);
                      try {
                        await onAdd(s.id);
                        setAdded((prev) => new Set(prev).add(s.id));
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {isAdded ? <Check /> : <CalendarPlus />}
                  </Button>
                </Item>
              );
            })}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  );
}
