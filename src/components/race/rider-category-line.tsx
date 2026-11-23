"use client";

import { UsersRound } from "lucide-react";
import { ageCategoryLabel } from "@/lib/i18n/taxonomy";
import { messagesFor } from "@/lib/i18n/messages";
import { matchRiderCategories, type RiderCategoryMatch, type RiderRaceFacts } from "@/lib/rider-category";
import { useRiders, type Rider } from "@/lib/riders";
import { cn } from "@/lib/utils";

const HEADING: Record<string, string> = {
  cs: "Kategorie tvých jezdců",
  sk: "Kategórie tvojich jazdcov",
  en: "Your riders' categories",
  de: "Kategorien deiner Fahrer",
  pl: "Kategorie Twoich zawodników",
};

const TITLE: Record<string, string> = {
  cs: "Kategorie a startovné pro vaše jezdce podle roku narození",
  sk: "Kategórie a štartovné pre vašich jazdcov podľa roku narodenia",
  en: "Your riders' categories and entry fees, by year of birth",
  de: "Kategorien und Startgeld für deine Fahrer nach Geburtsjahr",
  pl: "Kategorie i opłaty startowe dla Twoich zawodników według rocznika",
};

function money(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
}

function feeText(fee: NonNullable<RiderCategoryMatch["fee"]>, locale: string) {
  return fee.maxAmount != null
    ? `${new Intl.NumberFormat(locale).format(fee.amount)}–${money(fee.maxAmount, fee.currency, locale)}`
    : money(fee.amount, fee.currency, locale);
}

/**
 * A rider's categories and the fee: "holky 7-8 / kluci 7-8" and "200 Kč" when
 * they cost the same, else each category with its own fee and no shared one.
 */
export function riderMatchParts(matches: RiderCategoryMatch[], locale: string): { categories: string; fee: string | null } {
  const t = messagesFor(locale);
  const label = (m: RiderCategoryMatch) =>
    (m.taxonomyId ? ageCategoryLabel(m.taxonomyId, locale) : m.label) + (m.asLastYear ? ` (${t.ageLastYear})` : "");
  const fees = matches.map((m) => (m.fee ? feeText(m.fee, locale) : null));
  if (fees[0] && fees.every((f) => f === fees[0])) return { categories: matches.map(label).join(" / "), fee: fees[0] };
  return { categories: matches.map((m, i) => (fees[i] ? `${label(m)} ${fees[i]}` : label(m))).join(" / "), fee: null };
}

export function riderLines(riders: Rider[], race: RiderRaceFacts, locale: string) {
  const t = messagesFor(locale);
  return riders.flatMap((rider) => {
    const matches = matchRiderCategories(rider.birthYear, race, { gender: rider.gender ?? null });
    return matches.length ? [{ id: rider.id, name: rider.isSelf ? t.planSelf : rider.name, ...riderMatchParts(matches, locale) }] : [];
  });
}

/**
 * Under a race's buttons: which category each of the family's riders starts
 * in and what it costs, so a parent does not have to find their child's year
 * in a list of eighteen. Nothing for visitors, riders without a birth year, or
 * a race whose categories give no ages.
 */
export function RiderCategoryLine({ race, locale, className }: { race: RiderRaceFacts | null | undefined; locale: string; className?: string }) {
  const riders = useRiders();
  if (!race || !riders.length) return null;
  const lines = riderLines(riders, race, locale);
  if (!lines.length) return null;
  return (
    <section
      className={cn(
        "rounded-xl bg-sky-50 px-3.5 py-3 text-sm dark:bg-sky-950/40",
        className,
      )}
      aria-label={TITLE[locale] ?? TITLE.en}
      data-rider-categories
    >
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-sky-700 dark:text-sky-300">
        <UsersRound className="size-3.5 shrink-0" aria-hidden />
        {HEADING[locale] ?? HEADING.en}
      </p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1.5">
        {lines.map((line) => (
          <div key={line.id} className="contents">
            <dt className="font-medium">{line.name}</dt>
            <dd className={cn("min-w-0 break-words text-muted-foreground", !line.fee && "col-span-2")}>{line.categories}</dd>
            {line.fee ? <dd className="text-right font-medium tabular-nums">{line.fee}</dd> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}
