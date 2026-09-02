"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { BellRing, CalendarPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { asLocale } from "@/lib/i18n/messages";
import { eventMapPath } from "@/lib/event-url";
import { formatDistanceKm } from "@/lib/geo/distance";
import { ensureFavorite } from "@/lib/planner-db";

type Hit = {
  id: string;
  name: string;
  slug: string;
  startDate: string;
  endDate: string | null;
  km: number | null;
};

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * What the watching actually produced. An alert that only ever arrives by
 * e-mail is impossible to trust; showing the last fortnight of matches — and
 * letting one go straight into the plan — makes the setting answerable.
 */
export function AlertInbox({ locale, userId }: { locale: string; userId: string }) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const loc = asLocale(locale);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const supabase = createBrowserSupabase();
      const { data: alerts } = await supabase
        .from("race_alerts")
        .select("id")
        .eq("user_id", userId);
      if (!alive) return;
      if (!alerts || alerts.length === 0) {
        setHits([]);
        return;
      }
      const since = new Date();
      since.setDate(since.getDate() - 14);
      const { data } = await supabase
        .from("race_alert_deliveries")
        .select("distance_km, event:events(id, name, slug, start_date, end_date)")
        .in(
          "alert_id",
          alerts.map((a) => a.id),
        )
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(12);
      if (!alive) return;
      const out: Hit[] = [];
      const seen = new Set<string>();
      for (const row of (data ?? []) as unknown as {
        distance_km: number | null;
        event:
          | { id: string; name: string; slug: string; start_date: string; end_date: string | null }
          | { id: string; name: string; slug: string; start_date: string; end_date: string | null }[]
          | null;
      }[]) {
        const ev = unwrap(row.event);
        if (!ev || seen.has(ev.id)) continue;
        seen.add(ev.id);
        out.push({
          id: ev.id,
          name: ev.name,
          slug: ev.slug,
          startDate: ev.start_date,
          endDate: ev.end_date,
          km: row.distance_km,
        });
      }
      setHits(out);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.alertInbox}</CardTitle>
        <CardDescription>{t.alertInboxHelp}</CardDescription>
      </CardHeader>
      <CardContent>
        {hits === null ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : hits.length === 0 ? (
          <Empty className="border-0 p-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellRing />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-normal text-muted-foreground">
                {t.alertInboxEmpty}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup>
            {hits.map((h) => {
              const isAdded = added.has(h.id);
              return (
                <Item key={h.id} size="sm">
                  <ItemContent className="min-w-0">
                    <ItemTitle className="w-full min-w-0">
                      <Link
                        href={eventMapPath(locale, {
                          slug: h.slug,
                          startDate: h.startDate,
                          endDate: h.endDate,
                        })}
                        className="truncate hover:underline"
                      >
                        {h.name}
                      </Link>
                    </ItemTitle>
                    <ItemDescription className="tabular-nums">
                      {format(parseISO(h.startDate), "d. M. yyyy", { locale: df })}
                      {h.km != null ? ` · ${formatDistanceKm(h.km, loc)}` : ""}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      type="button"
                      size="sm"
                      variant={isAdded ? "ghost" : "secondary"}
                      disabled={isAdded || busy === h.id}
                      onClick={async () => {
                        setBusy(h.id);
                        try {
                          const supabase = createBrowserSupabase();
                          await ensureFavorite(supabase, userId, h.id, false);
                          setAdded((prev) => new Set(prev).add(h.id));
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      {isAdded ? <Check /> : <CalendarPlus />}
                      <span className="hidden sm:inline">
                        {isAdded ? t.suggestAdded : t.suggestAdd}
                      </span>
                    </Button>
                  </ItemActions>
                </Item>
              );
            })}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  );
}
