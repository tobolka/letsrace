"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { persist } from "@/lib/account/save";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { AlertPreview } from "@/components/account/alert-preview";
import { Panel } from "@/components/account/panel";
import { PlacePicker } from "@/components/account/place-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { messagesFor } from "@/lib/i18n/messages";
import {
  ALERT_RADIUS_DEFAULT,
  ALERT_RADIUS_PRESETS,
  clampRadiusKm,
} from "@/lib/race-alerts";
import { DISCIPLINE_TREE } from "@/lib/taxonomy";
import { disciplineLabel } from "@/lib/i18n/taxonomy";
import { cn } from "@/lib/utils";

type AlertRow = {
  id: string;
  enabled: boolean;
  label: string;
  lat: number;
  lng: number;
  radius_km: number;
  disciplines: string[] | null;
};

export function AlertSettings({
  locale,
  userId,
  preferredDisciplines = [],
}: {
  locale: string;
  userId: string;
  preferredDisciplines?: string[];
}) {
  const t = messagesFor(locale);
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [ready, setReady] = useState(false);
  const [adding, setAdding] = useState(false);

  async function load() {
    const supabase = createBrowserSupabase();
    const { data } = await supabase
      .from("race_alerts")
      .select("id, enabled, label, lat, lng, radius_km, disciplines")
      .eq("user_id", userId)
      .order("created_at");
    setRows((data as AlertRow[]) ?? []);
    setReady(true);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function patch(id: string, next: Partial<AlertRow>) {
    const supabase = createBrowserSupabase();
    const before = rows.find((r) => r.id === id);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));
    const ok = await persist(
      supabase
        .from("race_alerts")
        .update({ ...next, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId),
      {
        locale,
        onFailure: () =>
          setRows((prev) => prev.map((r) => (r.id === id && before ? before : r))),
      },
    );
    if (ok) toast.success(t.alertSaved);
  }

  async function createAlert(place: { label: string; lat: number; lng: number }) {
    const supabase = createBrowserSupabase();
    const { data, error } = await supabase
      .from("race_alerts")
      .insert({
        user_id: userId,
        enabled: true,
        label: place.label,
        lat: place.lat,
        lng: place.lng,
        radius_km: ALERT_RADIUS_DEFAULT,
        disciplines: preferredDisciplines,
        locale,
      })
      .select("id, enabled, label, lat, lng, radius_km, disciplines")
      .single();
    if (error || !data) return;
    setRows((prev) => [...prev, data as AlertRow]);
    toast.success(t.alertSaved);
  }

  async function removeAlert(id: string) {
    const supabase = createBrowserSupabase();
    const before = rows;
    setRows((prev) => prev.filter((r) => r.id !== id));
    await persist(
      supabase.from("race_alerts").delete().eq("id", id).eq("user_id", userId),
      { locale, onFailure: () => setRows(before) },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!ready ? <Skeleton className="h-64 w-full rounded-xl" /> : null}

      {rows.map((row) => (
        <AlertCard
          key={row.id}
          locale={locale}
          row={row}
          onPatch={(next) => void patch(row.id, next)}
          onRemove={() => void removeAlert(row.id)}
        />
      ))}

      {ready && rows.length > 0 ? (
        // Most people watch one place. Once it is set, the form for a second
        // one is clutter until it is asked for.
        <Collapsible open={adding} onOpenChange={setAdding}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="w-fit">
              <Plus data-icon="inline-start" />
              {t.alertAddAnother}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Panel className="mt-3">
              <PlacePicker
                locale={locale}
                onPick={(place) => {
                  setAdding(false);
                  void createAlert(place);
                }}
              />
            </Panel>
          </CollapsibleContent>
        </Collapsible>
      ) : ready ? (
        <Panel description={t.alertNoPlace}>
          <PlacePicker locale={locale} onPick={(place) => void createAlert(place)} />
        </Panel>
      ) : null}
    </div>
  );
}

function AlertCard({
  locale,
  row,
  onPatch,
  onRemove,
}: {
  locale: string;
  row: AlertRow;
  onPatch: (next: Partial<AlertRow>) => void;
  onRemove: () => void;
}) {
  const t = messagesFor(locale);
  const discs = row.disciplines ?? [];
  const switchId = `alert-on-${row.id}`;

  return (
    <Panel
      className={cn(!row.enabled && "bg-card/60")}
      title={
        <span className="flex min-w-0 items-center gap-2">
          <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{row.label || t.myLocation}</span>
        </span>
      }
      actions={
        <Field orientation="horizontal" className="w-auto items-center gap-2">
          <FieldLabel htmlFor={switchId} className="text-xs font-normal text-muted-foreground">
            {t.alertEnabled}
          </FieldLabel>
          <Switch
            id={switchId}
            checked={row.enabled}
            onCheckedChange={(on) => onPatch({ enabled: on })}
          />
        </Field>
      }
      bodyClassName={cn("flex flex-col gap-5 p-4 transition-opacity", !row.enabled && "opacity-60")}
    >
      <Field>
        <FieldLabel>{t.alertRadius}</FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={1}
          value={String(row.radius_km)}
          onValueChange={(v) => {
            if (v) onPatch({ radius_km: clampRadiusKm(Number(v)) });
          }}
          className="flex flex-wrap"
        >
          {ALERT_RADIUS_PRESETS.map((km) => (
            <ToggleGroupItem key={km} value={String(km)} className="tabular-nums">
              {t.alertRadiusKm.replace("{n}", String(km))}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <Field>
        <FieldLabel>{t.alertDisciplines}</FieldLabel>
        {discs.length === 0 ? <FieldDescription>{t.alertAllDisciplines}</FieldDescription> : null}
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          spacing={1}
          value={discs}
          onValueChange={(next) => onPatch({ disciplines: next })}
          className="flex w-full flex-wrap"
        >
          {DISCIPLINE_TREE.map((opt) => (
            <ToggleGroupItem key={opt.id} value={opt.id}>
              {disciplineLabel(opt.id, locale)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <div className="rounded-lg bg-muted/50 p-3">
        <AlertPreview
          locale={locale}
          lat={Number(row.lat)}
          lng={Number(row.lng)}
          radiusKm={row.radius_km}
          disciplines={discs}
        />
      </div>

      <AlertDialog>
        {/* Destroying something is not the widest, most central control on a
            card; it sits at the end of the row like every other afterthought. */}
        <AlertDialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="-mb-1 self-end text-muted-foreground">
            <Trash2 data-icon="inline-start" />
            {t.alertRemove}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmRemoveAlert}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onRemove}>
              {t.alertRemove}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}
