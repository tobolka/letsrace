"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { AlertPreview } from "@/components/account/alert-preview";
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
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));
    await supabase
      .from("race_alerts")
      .update({ ...next, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
    toast.success(t.alertSaved);
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
    setRows((prev) => prev.filter((r) => r.id !== id));
    await supabase.from("race_alerts").delete().eq("id", id).eq("user_id", userId);
  }

  return (
    <div className="flex flex-col gap-4">
      {!ready ? <Skeleton className="h-24 w-full" /> : null}

      {rows.map((row) => (
        <Card key={row.id}>
          <CardContent className="pt-6">
            <AlertCard
              locale={locale}
              row={row}
              onPatch={(next) => void patch(row.id, next)}
              onRemove={() => void removeAlert(row.id)}
            />
          </CardContent>
        </Card>
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
            <Card className="mt-3">
              <CardContent className="pt-6">
                <PlacePicker
                  locale={locale}
                  onPick={(place) => {
                    setAdding(false);
                    void createAlert(place);
                  }}
                />
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      ) : ready ? (
        <Card>
          <CardContent className="pt-6">
            <PlacePicker locale={locale} onPick={(place) => void createAlert(place)} />
          </CardContent>
        </Card>
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{row.label || t.myLocation}</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {t.alertRadius} {t.alertRadiusKm.replace("{n}", String(row.radius_km))}
          </p>
        </div>
        <Field orientation="horizontal" className="w-auto items-center">
          <FieldLabel htmlFor={switchId}>{t.alertEnabled}</FieldLabel>
          <Switch
            id={switchId}
            checked={row.enabled}
            onCheckedChange={(on) => onPatch({ enabled: on })}
          />
        </Field>
      </div>

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
        <FieldDescription>
          {discs.length === 0 ? t.alertAllDisciplines : null}
        </FieldDescription>
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
              {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <div className="rounded-lg border bg-muted/30 p-3">
        <AlertPreview
          locale={locale}
          lat={Number(row.lat)}
          lng={Number(row.lng)}
          radiusKm={row.radius_km}
          disciplines={discs}
        />
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm">
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
    </div>
  );
}
