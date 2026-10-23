import { format, parseISO, type Locale } from "date-fns";
import { datePresetRanges, type DatePresetId } from "@/lib/date-presets";
import type { DateRange } from "react-day-picker";

/** Parse ISO date filter strings into a day-picker range (no calendar import). */
export function isoToRange(dateFrom: string, dateTo: string): DateRange | undefined {
  if (!dateFrom) return undefined;
  const from = parseISO(dateFrom);
  if (Number.isNaN(from.getTime())) return undefined;
  if (!dateTo) return { from };
  const to = parseISO(dateTo);
  return { from, to: Number.isNaN(to.getTime()) ? undefined : to };
}

/**
 * The date filter as a pill says it: "Tento víkend", "24. říj – 2. lis", or
 * whatever the quick choice in force is called.
 */
export function dateFilterLabel(
  dateFrom: string,
  dateTo: string,
  presetLabels: Record<DatePresetId, string>,
  df: Locale,
): string {
  const preset = datePresetRanges(dateFrom, dateTo).find((p) => p.active);
  if (preset) return presetLabels[preset.id];
  const day = (iso: string) => format(parseISO(iso), "d MMM", { locale: df });
  if (dateFrom && dateTo) return dateFrom === dateTo ? day(dateFrom) : `${day(dateFrom)} – ${day(dateTo)}`;
  if (dateFrom) return `${day(dateFrom)} –`;
  return presetLabels.any;
}
