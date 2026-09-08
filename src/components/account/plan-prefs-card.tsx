"use client";

import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { persist } from "@/lib/account/save";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { ISO_WEEKDAYS } from "@/lib/plan-prefs";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { DISCIPLINE_TREE } from "@/lib/taxonomy";

function weekdayLabel(isoDay: number, locale: string) {
  return format(parseISO(`2026-08-${16 + isoDay}`), "EEE", { locale: dateFnsLocale(locale) });
}

function weekdayFull(isoDay: number, locale: string) {
  return format(parseISO(`2026-08-${16 + isoDay}`), "EEEE", { locale: dateFnsLocale(locale) });
}

export function PlanPrefsFields({
  locale,
  busyWeekdays,
  preferredDisciplines,
  onBusyChange,
  onDisciplinesChange,
}: {
  locale: string;
  busyWeekdays: number[];
  preferredDisciplines: string[];
  onBusyChange: (next: number[]) => void;
  onDisciplinesChange: (next: string[]) => void;
}) {
  const t = messagesFor(locale);

  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel>{t.prefsBusyDays}</FieldLabel>
        <FieldDescription>{t.prefsBusyHelp}</FieldDescription>
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          spacing={1}
          value={busyWeekdays.map(String)}
          onValueChange={(next) => {
            onBusyChange(next.map(Number).filter((n) => n >= 1 && n <= 7));
          }}
          className="flex flex-wrap"
        >
          {ISO_WEEKDAYS.map((d) => (
            <ToggleGroupItem key={d} value={String(d)} aria-label={weekdayFull(d, locale)}>
              {weekdayLabel(d, locale)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      <Field>
        <FieldLabel>{t.prefsDiscipline}</FieldLabel>
        <FieldDescription>{t.prefsDisciplineHelp}</FieldDescription>
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          spacing={1}
          value={preferredDisciplines}
          onValueChange={onDisciplinesChange}
          className="flex w-full flex-wrap"
        >
          {DISCIPLINE_TREE.map((opt) => (
            <ToggleGroupItem key={opt.id} value={opt.id}>
              {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
    </FieldGroup>
  );
}

/** Returns false when nothing was stored, so no caller says "Saved" in error. */
export async function saveMemberPrefs(opts: {
  userId: string;
  memberId: string;
  isSelf: boolean;
  busyWeekdays: number[];
  preferredDisciplines: string[];
  locale: string;
}): Promise<boolean> {
  const supabase = createBrowserSupabase();
  const ok = await persist(
    supabase
      .from("family_members")
      .update({
        busy_weekdays: opts.busyWeekdays,
        preferred_disciplines: opts.preferredDisciplines,
      })
      .eq("id", opts.memberId)
      .eq("user_id", opts.userId),
    { locale: opts.locale },
  );
  if (!ok) return false;
  if (!opts.isSelf) return true;
  return persist(
    supabase
      .from("profiles")
      .update({
        busy_weekdays: opts.busyWeekdays,
        preferred_disciplines: opts.preferredDisciplines,
      })
      .eq("id", opts.userId),
    { locale: opts.locale },
  );
}

export function notifyPrefsSaved(locale: string) {
  toast.success(messagesFor(locale).alertSaved);
}
