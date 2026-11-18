import { dateFilterLabel } from "@/components/explore/date-range";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { TruncatedText } from "@/components/shell/truncated-text";
import { datePresetRanges, todayIso } from "@/lib/date-presets";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { asLocale, messagesFor, type Locale } from "@/lib/i18n/messages";
import { pluralForm, type PluralForm } from "@/lib/i18n/plural";
import { cn } from "@/lib/utils";

/** "1 závod", "3 závody", "64 závodů" — the count said as a sentence would. */
export function raceCountLabel(n: number, locale: string): string {
  const t = messagesFor(locale);
  const form = countForm(n, asLocale(locale));
  const word = form === "one" ? t.racesCountOne : form === "few" ? t.racesCountFew : t.racesCount;
  return `${n} ${word}`;
}

function countForm(n: number, loc: Locale): PluralForm {
  const abs = Math.abs(n);
  // Czech and Slovak take the "few" form for 2–4 only; 22 is "22 závodů".
  return loc === "cs" || loc === "sk" ? (abs === 1 ? "one" : abs >= 2 && abs <= 4 ? "few" : "many") : pluralForm(n, loc);
}

const UPCOMING_RACES: Record<Locale, Record<PluralForm, string>> = {
  cs: { one: "nadcházející závod", few: "nadcházející závody", many: "nadcházejících závodů" },
  sk: { one: "nadchádzajúci pretek", few: "nadchádzajúce preteky", many: "nadchádzajúcich pretekov" },
  pl: { one: "nadchodzący wyścig", few: "nadchodzące wyścigi", many: "nadchodzących wyścigów" },
  en: { one: "upcoming race", few: "upcoming races", many: "upcoming races" },
  de: { one: "kommendes Rennen", few: "kommende Rennen", many: "kommende Rennen" },
};

const INCLUDING_PAST: Record<Locale, string> = {
  cs: "včetně proběhlých",
  sk: "vrátane minulých",
  pl: "łącznie z minionymi",
  en: "including past ones",
  de: "inklusive vergangener",
};

/**
 * The count with the dates it covers, said briefly: "1074 nadcházejících
 * závodů", "5 závodů tento víkend", "1122 závodů včetně proběhlých". A bare
 * number never says which part of the season it is.
 */
export function raceCountWithDates(n: number, locale: string, dateFrom: string, dateTo: string, now = new Date()): string {
  const loc = asLocale(locale);
  if (!dateFrom && !dateTo) return `${raceCountLabel(n, locale)} ${INCLUDING_PAST[loc]}`;
  if (!dateTo && dateFrom <= todayIso(now)) {
    // From today on, or from a day already gone: everything still to come.
    return `${n} ${UPCOMING_RACES[loc][countForm(n, loc)]}`;
  }
  // A named window is said; a picked range is already on the date chip just
  // above, and repeated here it only crowded the line.
  const named = datePresetRanges(dateFrom, dateTo, now).some((p) => p.active);
  return named ? `${raceCountLabel(n, locale)} ${dateScopeLabel(dateFrom, dateTo, locale)}` : raceCountLabel(n, locale);
}

/**
 * How many races a view holds, at the head of every list.
 *
 * `count` is null until the first answer, and shows as a placeholder. `loading`
 * is a refetch under way: the number stays and a spinner turns up beside it,
 * in a box that is always there so nothing beside it moves.
 */
export function RaceCount({
  count,
  locale,
  loading = false,
  className,
  dates,
}: {
  count: number | null;
  locale: string;
  loading?: boolean;
  className?: string;
  /**
   * The date filter in force, said with the count: "2 races" on its own read
   * as a nearly empty calendar to a parent planning the year.
   */
  dates?: { from: string; to: string };
}) {
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums", className)}
      aria-live="polite"
      aria-busy={loading}
    >
      {count == null ? <Skeleton aria-hidden className="h-3 w-20 rounded bg-muted" /> : (
        <TruncatedText text={dates ? raceCountWithDates(count, locale, dates.from, dates.to) : raceCountLabel(count, locale)} />
      )}
      <span className="inline-flex size-4 shrink-0 items-center justify-center" aria-hidden={!loading}>
        {loading ? <Spinner className="size-3.5" /> : null}
      </span>
    </span>
  );
}

/** "tento víkend", "this month", "22 Nov – 23 Nov": the window a count is for, said after it. */
export function dateScopeLabel(dateFrom: string, dateTo: string, locale: string): string {
  const t = messagesFor(locale);
  const label = dateFilterLabel(
    dateFrom,
    dateTo,
    {
      weekend: t.thisWeekend,
      nextWeekend: t.nextWeekend,
      upcoming: t.upcoming,
      thisMonth: t.thisMonth,
      nextMonth: t.nextMonth,
      any: t.anyDate,
    },
    dateFnsLocale(locale),
  );
  // German nouns keep their capital; the rest read as the middle of a sentence.
  return asLocale(locale) === "de" ? label : label.charAt(0).toLowerCase() + label.slice(1);
}
