"use client";

import { Check, UsersRound, X } from "lucide-react";
import { ACTIVE_CHIP, itemClass } from "@/components/explore/filter-styles";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { todayIso } from "@/lib/date-presets";
import { messagesFor } from "@/lib/i18n/messages";
import { activeRiderId, riderFilter } from "@/lib/rider-category";
import { useFamilyRiders } from "@/lib/riders";
import { cn } from "@/lib/utils";

export const RIDER_FILTER_COPY: Record<string, { label: string; hint: string; clear: string }> = {
  cs: { label: "Jezdec", hint: "Podle věku a oblíbených disciplín", clear: "Zrušit filtr jezdce" },
  sk: { label: "Jazdec", hint: "Podľa veku a obľúbených disciplín", clear: "Zrušiť filter jazdca" },
  en: { label: "Rider", hint: "By age and favourite disciplines", clear: "Clear rider filter" },
};

export type OnRiderFilter = (categories: string[], disciplines: string[]) => void;

/**
 * The family's riders as a filter: choosing one sets the age group their
 * birth year falls in for the season being looked at, and the disciplines
 * they ride. Only for a signed-in family, and only riders with something to
 * filter by. The rider shown as chosen is the one whose filter is on now, so
 * changing the age or discipline by hand quietly lets go of them.
 */
export function useRiderFilterOptions(
  locale: string,
  current: { categories: string[]; disciplines: string[]; dateFrom: string },
  onApply: OnRiderFilter | undefined,
) {
  const family = useFamilyRiders();
  const t = messagesFor(locale);
  const usable = family.filter((m) => m.birthYear != null || m.disciplines.length > 0);
  const refYear = Number((current.dateFrom || todayIso()).slice(0, 4));
  const active = onApply ? activeRiderId(usable, current, refYear) : null;
  const options = onApply
    ? usable.map((m) => {
        const f = riderFilter(m, refYear);
        const isActive = m.id === active;
        return {
          id: m.id,
          name: m.isSelf ? t.planSelf : m.name,
          active: isActive,
          apply: () => (isActive ? onApply([], []) : onApply(f.categories, f.disciplines)),
        };
      })
    : [];
  return { options, activeName: options.find((o) => o.active)?.name ?? null, clear: () => onApply?.([], []) };
}

/** The chip on the filter bar, after the date. */
export function RiderFilterChip({
  locale,
  categories,
  disciplines,
  dateFrom,
  onApply,
}: {
  locale: string;
  categories: string[];
  disciplines: string[];
  dateFrom: string;
  onApply?: OnRiderFilter;
}) {
  const { options, activeName, clear } = useRiderFilterOptions(locale, { categories, disciplines, dateFrom }, onApply);
  if (!options.length) return null;
  const c = RIDER_FILTER_COPY[locale] ?? RIDER_FILTER_COPY.en;
  return (
    <div className="inline-flex h-full max-w-full shrink-0 items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-label={`${c.label} ${activeName ?? ""}`.trim()}
            className={cn("max-md:h-11 [@media(pointer:coarse)]:h-11", activeName && cn("rounded-r-none", ACTIVE_CHIP))}
          >
            <UsersRound />
            <span className="max-w-[12rem] truncate">{activeName ?? c.label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56" collisionPadding={12}>
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{c.hint}</DropdownMenuLabel>
          {options.map((o) => (
            <DropdownMenuItem key={o.id} className={cn(itemClass, o.active && "font-medium")} onSelect={o.apply}>
              <span className="min-w-0 flex-1 truncate">{o.name}</span>
              {o.active ? <Check className="ml-auto" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {activeName ? (
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label={c.clear}
          className={cn("rounded-l-none max-md:size-11 [@media(pointer:coarse)]:size-11", ACTIVE_CHIP)}
          onClick={clear}
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}
