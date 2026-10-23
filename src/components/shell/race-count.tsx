import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { asLocale, messagesFor } from "@/lib/i18n/messages";
import { pluralForm } from "@/lib/i18n/plural";
import { cn } from "@/lib/utils";

/** "1 závod", "3 závody", "64 závodů" — the count said as a sentence would. */
export function raceCountLabel(n: number, locale: string): string {
  const t = messagesFor(locale);
  const loc = asLocale(locale);
  const abs = Math.abs(n);
  // Czech and Slovak take the "few" form for 2–4 only; 22 is "22 závodů".
  const form = loc === "cs" || loc === "sk" ? (abs === 1 ? "one" : abs >= 2 && abs <= 4 ? "few" : "many") : pluralForm(n, loc);
  const word = form === "one" ? t.racesCountOne : form === "few" ? t.racesCountFew : t.racesCount;
  return `${n} ${word}`;
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
}: {
  count: number | null;
  locale: string;
  loading?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums", className)}
      aria-live="polite"
      aria-busy={loading}
    >
      {count == null ? <Skeleton aria-hidden className="h-3 w-20 rounded bg-muted" /> : raceCountLabel(count, locale)}
      <span className="inline-flex size-4 shrink-0 items-center justify-center" aria-hidden={!loading}>
        {loading ? <Spinner className="size-3.5" /> : null}
      </span>
    </span>
  );
}
