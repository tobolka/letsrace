"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { todayIso } from "@/lib/date-presets";

/**
 * One day, or the month ahead.
 *
 * This was a bare `<input type="date">` — "dd.mm.yyyy" in a box, a different
 * picker on every browser, and no way to see which days are weekends. The
 * button says what the list below is answering for; the calendar behind it is
 * the one the rest of the app draws.
 */
export function DayPickerButton({
  locale,
  value,
  onChange,
}: {
  locale: string;
  value: string | null;
  onChange: (day: string | null) => void;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;

  return (
    <ButtonGroup>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" aria-label={t.discoverPickDay}>
            <CalendarDays data-icon="inline-start" />
            <span className="first-letter:uppercase">
              {value ? format(parseISO(value), "EEEE d. MMMM", { locale: df }) : t.discoverNext30}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            locale={df}
            weekStartsOn={1}
            selected={selected}
            defaultMonth={selected}
            disabled={{ before: parseISO(todayIso()) }}
            onSelect={(day) => {
              onChange(day ? format(day, "yyyy-MM-dd") : null);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {value ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t.discoverClearDay}
          title={t.discoverClearDay}
          onClick={() => onChange(null)}
        >
          <X />
        </Button>
      ) : null}
    </ButtonGroup>
  );
}
