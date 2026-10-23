"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { format, parseISO } from "date-fns";
import { Calendar, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { isoToRange } from "@/components/explore/date-range";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { datePresetRanges, type DatePresetId } from "@/lib/date-presets";
import { dateFnsLocale } from "@/lib/i18n/dates";
import type { Messages } from "@/lib/i18n/messages";

const DateRangeCalendar = dynamic(
  () =>
    import("@/components/explore/date-range-calendar").then((m) => ({
      default: m.DateRangeCalendar,
    })),
  {
    loading: () => (
      <Skeleton className="h-64 w-[280px] bg-muted/50" aria-hidden />
    ),
  },
);

/** The date chip and its popover: presets on the left, a range calendar on the right. */
export function DateFilter({
  messages,
  locale,
  dateFrom,
  dateTo,
  onPreset,
}: {
  messages: Messages;
  locale: string;
  dateFrom: string;
  dateTo: string;
  onPreset: (from: string, to: string) => void;
}) {
  const [dateOpen, setDateOpen] = useState(false);
  const [customPicked, setCustomPicked] = useState(false);
  const [dateDraft, setDateDraft] = useState<DateRange | undefined>();

  const presets = datePresetRanges(dateFrom, dateTo);
  const preset = (id: DatePresetId) => presets.find((p) => p.id === id)!;
  const thisW = preset("weekend");
  const nextW = preset("nextWeekend");
  const thisM = preset("thisMonth");
  const nextM = preset("nextMonth");
  const today = preset("upcoming").from;
  const isThisWeekend = thisW.active;
  const isNextWeekend = nextW.active;
  const isThisMonth = thisM.active;
  const isNextMonth = nextM.active;
  const isUpcoming = preset("upcoming").active;
  const anyDate = preset("any").active;
  const dateActive = Boolean(dateFrom || dateTo);
  const isPreset =
    isThisWeekend || isNextWeekend || isThisMonth || isNextMonth || anyDate || isUpcoming;
  const isCustom = customPicked || (dateActive && !isPreset);

  const df = dateFnsLocale(locale);
  const draftFrom = dateDraft?.from ? format(dateDraft.from, "d MMM", { locale: df }) : null;
  const draftTo = dateDraft?.to ? format(dateDraft.to, "d MMM", { locale: df }) : null;
  const dateLabel = isCustom
    ? draftFrom && draftTo
      ? `${draftFrom} – ${draftTo}`
      : draftFrom
        ? `${draftFrom} – …`
        : dateFrom && dateTo
          ? `${format(parseISO(dateFrom), "d MMM", { locale: df })} – ${format(parseISO(dateTo), "d MMM", { locale: df })}`
          : dateFrom
            ? `${messages.from} ${format(parseISO(dateFrom), "d MMM", { locale: df })}`
            : messages.customDate
    : isThisWeekend
      ? messages.thisWeekend
      : isNextWeekend
        ? messages.nextWeekend
        : isThisMonth
          ? messages.thisMonth
          : isNextMonth
            ? messages.nextMonth
            : isUpcoming
              ? messages.upcoming
              : anyDate
                ? messages.anyDate
                : messages.date;

  function applyPreset(from: string, to: string) {
    setCustomPicked(false);
    setDateDraft(undefined);
    onPreset(from, to);
  }

  const datePresets: { id: string; label: string; active: boolean; apply: () => void }[] = [
    {
      id: "upcoming",
      label: messages.upcoming,
      active: !isCustom && isUpcoming,
      apply: () => applyPreset(today, ""),
    },
    {
      id: "thisWeekend",
      label: messages.thisWeekend,
      active: !isCustom && isThisWeekend,
      apply: () => applyPreset(thisW.from, thisW.to),
    },
    {
      id: "nextWeekend",
      label: messages.nextWeekend,
      active: !isCustom && isNextWeekend,
      apply: () => applyPreset(nextW.from, nextW.to),
    },
    {
      id: "thisMonth",
      label: messages.thisMonth,
      active: !isCustom && isThisMonth,
      apply: () => applyPreset(thisM.from, thisM.to),
    },
    {
      id: "nextMonth",
      label: messages.nextMonth,
      active: !isCustom && isNextMonth,
      apply: () => applyPreset(nextM.from, nextM.to),
    },
    {
      id: "any",
      label: messages.anyDate,
      active: !isCustom && anyDate,
      apply: () => applyPreset("", ""),
    },
  ];

  return (
    <Popover
      open={dateOpen}
      onOpenChange={(next) => {
        setDateOpen(next);
        if (next) {
          setCustomPicked(dateActive && !isPreset);
          setDateDraft(undefined);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-pressed={dateOpen}
          className="h-8 shrink-0 leading-none tabular-nums max-md:h-11 [@media(pointer:coarse)]:h-11"
        >
          <Calendar />
          {dateLabel}
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto max-h-[min(70dvh,36rem)] max-w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain p-0"
        collisionPadding={12}
      >
        <div className="flex w-full flex-col overflow-hidden md:flex-row">
          <div className="flex w-full shrink-0 flex-col p-1 md:w-36">
            {datePresets.map((opt) => (
              <Button
                key={opt.id}
                type="button"
                variant={opt.active ? "default" : "ghost"}
                size="sm"
                className="w-full justify-start"
                aria-pressed={opt.active}
                onClick={opt.apply}
              >
                {opt.label}
              </Button>
            ))}
            <Button
              type="button"
              variant={isCustom ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start"
              aria-pressed={isCustom}
              onClick={() => setCustomPicked(true)}
            >
              {messages.customDate}
            </Button>
          </div>
          <Separator orientation="vertical" className="hidden md:block" />
          <Separator className="md:hidden" />
          {dateOpen ? (
            <DateRangeCalendar
              locale={locale}
              selected={dateDraft ?? isoToRange(dateFrom, dateTo)}
              onSelect={(range) => {
                if (!range?.from) return;
                setCustomPicked(true);
                setDateDraft(range);
                if (range.to) {
                  const start = range.from <= range.to ? range.from : range.to;
                  const end = range.from <= range.to ? range.to : range.from;
                  onPreset(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
                }
              }}
            />
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
