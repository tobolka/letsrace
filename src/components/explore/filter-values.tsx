"use client";

import { useCallback } from "react";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { countryDisplayName } from "@/lib/geo/europe";
import type { Messages } from "@/lib/i18n/messages";
import { ageCategoryLabel, ageGroupHint, disciplineLabel, raceLevelLabel } from "@/lib/i18n/taxonomy";
import { familyColor } from "@/lib/map-visuals";
import { AGE_CATEGORY_FILTERS, DISCIPLINE_TREE, RACE_LEVELS } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import type { ExtraFilter, SeriesGroup } from "@/components/explore/filter-bar-model";
import { itemClass } from "@/components/explore/filter-styles";

export type FilterValuesProps = {
  id: ExtraFilter;
  messages: Messages;
  locale: string;
  disciplines: string[];
  categories: string[];
  levels: string[];
  country: string[];
  countryCodes: string[];
  seriesGroups: SeriesGroup[];
  showSeriesHeaders: boolean;
  seriesQuery: string;
  onSeriesQuery: (q: string) => void;
  onDiscipline: (v: string) => void;
  onCategory: (v: string) => void;
  onLevel: (v: string) => void;
  onCountry: (code: string) => void;
  onClearCountries: () => void;
  onSeries: (slug: string) => void;
};

/** The checkable rows (or the series list) inside one filter's dropdown. */
export function FilterValues(props: FilterValuesProps) {
  const { id, messages, locale } = props;
  const focusSeriesSearch = useCallback((input: HTMLInputElement | null) => {
    if (!input) return;
    const frame = requestAnimationFrame(() => input.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (id === "discipline") {
    return (
      <>
        {DISCIPLINE_TREE.map((opt) => (
          <DropdownMenuGroup key={opt.id}>
            <DropdownMenuCheckboxItem
              checked={props.disciplines.includes(opt.id)}
              onCheckedChange={() => props.onDiscipline(opt.id)}
              onSelect={(e) => e.preventDefault()}
              className={itemClass}
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: familyColor(opt.id) }}
                aria-hidden
              />
              {disciplineLabel(opt.id, locale)}
            </DropdownMenuCheckboxItem>
            {opt.children?.map((child) => (
              <DropdownMenuCheckboxItem
                key={child.id}
                checked={props.disciplines.includes(child.id)}
                onCheckedChange={() => props.onDiscipline(child.id)}
                onSelect={(e) => e.preventDefault()}
                className={cn(itemClass, "pl-12 [&>span]:left-6")}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: familyColor(child.id) }}
                  aria-hidden
                />
                {disciplineLabel(child.id, locale)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </>
    );
  }
  if (id === "category") {
    return (
      <>
        {AGE_CATEGORY_FILTERS.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.id}
            checked={props.categories.includes(opt.id)}
            onCheckedChange={() => props.onCategory(opt.id)}
            onSelect={(e) => e.preventDefault()}
            className={itemClass}
          >
            {ageCategoryLabel(opt.id, locale)}
            {/* Which classes the group means, in the organisers' terms. */}
            <span className="ml-auto pl-4 text-right text-xs whitespace-nowrap tabular-nums text-muted-foreground">{ageGroupHint(opt.id, locale)}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </>
    );
  }
  if (id === "level") {
    return RACE_LEVELS.map((levelId) => (
      <DropdownMenuCheckboxItem
        key={levelId}
        checked={props.levels.includes(levelId)}
        onCheckedChange={() => props.onLevel(levelId)}
        className={itemClass}
      >
        {raceLevelLabel(levelId, locale)}
      </DropdownMenuCheckboxItem>
    ));
  }
  if (id === "country") {
    return (
      <>
        <DropdownMenuCheckboxItem
          checked={props.country.length === 0}
          onCheckedChange={() => {
            if (props.country.length) props.onClearCountries();
          }}
          onSelect={(e) => e.preventDefault()}
          className={itemClass}
        >
          {messages.allCountries}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {props.countryCodes.map((code) => (
          <DropdownMenuCheckboxItem
            key={code}
            checked={props.country.includes(code)}
            onCheckedChange={() => props.onCountry(code)}
            onSelect={(e) => e.preventDefault()}
            className={itemClass}
          >
            {countryDisplayName(code, locale)}
          </DropdownMenuCheckboxItem>
        ))}
      </>
    );
  }
  return (
    <>
      <div
        className="sticky -top-1 z-10 bg-popover px-1 pb-2 pt-1"
        onKeyDown={(e) => { if (e.key !== "Escape" && e.key !== "Tab") e.stopPropagation(); }}
      >
        <Input
          type="search"
          ref={focusSeriesSearch}
          aria-label={messages.searchSeries}
          value={props.seriesQuery}
          onChange={(e) => props.onSeriesQuery(e.target.value)}
          placeholder={messages.searchSeries}
          className="h-9"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {props.seriesGroups.length === 0 ? (
        <p className="px-2 py-2 text-sm text-muted-foreground">{messages.noSeries}</p>
      ) : null}
      {props.seriesGroups.map((group, index) => (
        <DropdownMenuGroup key={group.key}>
          {index > 0 && props.showSeriesHeaders ? <DropdownMenuSeparator /> : null}
          {props.showSeriesHeaders ? (
            <DropdownMenuLabel className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {group.label}
            </DropdownMenuLabel>
          ) : null}
          {group.items.map((s) => (
            <DropdownMenuItem
              key={s.slug}
              className={itemClass}
              onSelect={() => props.onSeries(s.slug)}
            >
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {s.eventCount}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      ))}
    </>
  );
}
