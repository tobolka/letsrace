"use client";

import { UserRound } from "lucide-react";
import { ageCategoryLabel } from "@/lib/i18n/taxonomy";
import { messagesFor } from "@/lib/i18n/messages";
import { matchRiderCategories, type RiderCategoryMatch, type RiderRaceFacts } from "@/lib/rider-category";
import { useRiders, type Rider } from "@/lib/riders";
import { cn } from "@/lib/utils";

const TITLE: Record<string, string> = {
  cs: "Kategorie a startovné pro vaše jezdce podle roku narození",
  sk: "Kategórie a štartovné pre vašich jazdcov podľa roku narodenia",
  en: "Your riders' categories and entry fees, by year of birth",
};

function money(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
}

function feeText(fee: NonNullable<RiderCategoryMatch["fee"]>, locale: string) {
  return fee.maxAmount != null
    ? `${new Intl.NumberFormat(locale).format(fee.amount)}–${money(fee.maxAmount, fee.currency, locale)}`
    : money(fee.amount, fee.currency, locale);
}

/** "holky 7-8 / kluci 7-8 · 200 Kč", or each category with its own fee when they differ. */
export function riderMatchText(matches: RiderCategoryMatch[], locale: string): string {
  const t = messagesFor(locale);
  const label = (m: RiderCategoryMatch) =>
    (m.taxonomyId ? ageCategoryLabel(m.taxonomyId, locale) : m.label) + (m.asLastYear ? ` (${t.ageLastYear})` : "");
  const fees = matches.map((m) => (m.fee ? feeText(m.fee, locale) : null));
  if (fees[0] && fees.every((f) => f === fees[0])) return `${matches.map(label).join(" / ")} · ${fees[0]}`;
  return matches.map((m, i) => (fees[i] ? `${label(m)} · ${fees[i]}` : label(m))).join(" / ");
}

export function riderLines(riders: Rider[], race: RiderRaceFacts, locale: string) {
  const t = messagesFor(locale);
  return riders.flatMap((rider) => {
    const matches = matchRiderCategories(rider.birthYear, race, { gender: rider.gender ?? null });
    return matches.length ? [{ id: rider.id, name: rider.isSelf ? t.planSelf : rider.name, text: riderMatchText(matches, locale) }] : [];
  });
}

/**
 * Pinned at the top of a race: which category each of the family's riders
 * starts in and what it costs ("Ela → holky 7-8 · 200 Kč"), so a parent does
 * not have to find their child's year in a list of eighteen. Nothing for
 * visitors, riders without a birth year, or a race whose categories give no ages.
 */
export function RiderCategoryLine({ race, locale, className }: { race: RiderRaceFacts | null | undefined; locale: string; className?: string }) {
  const riders = useRiders();
  if (!race || !riders.length) return null;
  const lines = riderLines(riders, race, locale);
  if (!lines.length) return null;
  return (
    <div
      className={cn("flex items-start gap-2 rounded-lg bg-brand/10 px-3 py-2 text-sm", className)}
      title={TITLE[locale] ?? TITLE.en}
      data-rider-categories
    >
      <UserRound className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
      <ul className="min-w-0 flex-1 space-y-0.5">
        {lines.map((line) => (
          <li key={line.id} className="break-words">
            <span className="font-medium">{line.name}</span>
            <span aria-hidden className="text-muted-foreground"> → </span>
            <span className="sr-only">: </span>
            {line.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
