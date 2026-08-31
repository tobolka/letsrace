"use client";

import { useEffect, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { parseISO } from "date-fns";
import { cs, enGB, pl, sk } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "react-day-picker/style.css";

const LOCALES = { cs, en: enGB, pl, sk } as const;

export function isoToRange(dateFrom: string, dateTo: string): DateRange | undefined {
  if (!dateFrom) return undefined;
  const from = parseISO(dateFrom);
  if (Number.isNaN(from.getTime())) return undefined;
  if (!dateTo) return { from };
  const to = parseISO(dateTo);
  return { from, to: Number.isNaN(to.getTime()) ? undefined : to };
}

type Props = {
  locale: string;
  selected?: DateRange;
  onSelect: (range: DateRange | undefined) => void;
};

export function DateRangeCalendar({ locale, selected, onSelect }: Props) {
  const dfLocale = LOCALES[locale as keyof typeof LOCALES] ?? enGB;
  const [month, setMonth] = useState<Date>(selected?.from ?? new Date());

  useEffect(() => {
    if (selected?.from) setMonth(selected.from);
  }, [selected?.from]);

  return (
    <div className="letsrace-date-cal min-w-0 px-1.5 pb-1.5 pt-1">
      <DayPicker
        mode="range"
        locale={dfLocale}
        weekStartsOn={1}
        animate={false}
        month={month}
        onMonthChange={setMonth}
        selected={selected}
        onSelect={(range) => {
          if (!range?.from) return;
          onSelect(range);
        }}
        components={{
          Chevron: ({ orientation }) =>
            orientation === "left" ? (
              <ChevronLeft className="size-4" aria-hidden />
            ) : (
              <ChevronRight className="size-4" aria-hidden />
            ),
        }}
      />
    </div>
  );
}
