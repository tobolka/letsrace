"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Panel } from "@/components/account/panel";
import { messagesFor } from "@/lib/i18n/messages";
import { ensureFavorite } from "@/lib/planner-db";
import { todayIso } from "@/lib/date-presets";
import { toast } from "sonner";
import { AddToPlanButton, RaceItem, type RaceItemData } from "@/components/race/race-item";
import { repairText } from "@/lib/text";

type Hit = RaceItemData;

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
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

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
      const today = todayIso();
      const { data } = await supabase
        .from("race_alert_deliveries")
        .select(
          "distance_km, event:events(id, name, slug, start_date, end_date, disciplines, location:locations(name, municipality, country_code))",
        )
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
      for (const row of data ?? []) {
        const ev = unwrap(row.event);
        if (!ev || seen.has(ev.id)) continue;
        // A match for a race that has already been run is not news any more.
        if ((ev.end_date ?? ev.start_date) < today) continue;
        seen.add(ev.id);
        const loc = unwrap(ev.location);
        out.push({
          id: ev.id,
          name: repairText(ev.name),
          slug: ev.slug,
          startDate: ev.start_date,
          endDate: ev.end_date,
          place: loc?.municipality || loc?.name || null,
          countryCode: loc?.country_code ?? null,
          disciplines: ev.disciplines ?? [],
          distanceKm: row.distance_km,
        });
      }
      setHits(out);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  return (
    <Panel title={t.discoverNewTitle} description={t.discoverNewBody} bodyClassName="p-2">
      <>
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
          <div className="flex flex-col">
            {hits.map((h) => (
              <RaceItem
                key={h.id}
                race={h}
                locale={locale}
                action={
                  <AddToPlanButton
                    locale={locale}
                    raceName={h.name}
                    added={added.has(h.id)}
                    onAdd={async () => {
                      const supabase = createBrowserSupabase();
                      if (await ensureFavorite(supabase, userId, h.id, false)) {
                        setAdded((prev) => new Set(prev).add(h.id));
                      } else {
                        toast.error(t.saveFailed);
                      }
                    }}
                  />
                }
              />
            ))}
          </div>
        )}
      </>
    </Panel>
  );
}
