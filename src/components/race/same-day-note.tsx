"use client";

import Link from "next/link";
import { CalendarClock, CircleHelp } from "lucide-react";
import { eventPagePath } from "@/lib/event-url";
import { useMyDays } from "@/lib/my-days";
import { sameDayConflicts } from "@/lib/same-day";
import { cn } from "@/lib/utils";

const COPY: Record<string, { title: string; titleDays: string; taken: string }> = {
  cs: { title: "V ten den už máš", titleDays: "V těch dnech už máš", taken: "Obsazený den" },
  sk: { title: "V ten deň už máš", titleDays: "V tých dňoch už máš", taken: "Obsadený deň" },
  en: { title: "You already have on that day", titleDays: "You already have on those days", taken: "Day marked as taken" },
};

/**
 * A yellow note under the riders' categories when the family's plan already
 * has another race on the race's days, or a day they marked as taken.
 */
export function SameDayNote({
  race,
  locale,
  className,
}: {
  race: { id: string; startDate: string; endDate?: string | null };
  locale: string;
  className?: string;
}) {
  const mine = useMyDays();
  if (!mine.races.length && !mine.days.length) return null;
  const { races, days } = sameDayConflicts(race, mine.races, mine.days);
  if (!races.length && !days.length) return null;
  const c = COPY[locale] ?? COPY.en;
  const multiDay = Boolean(race.endDate && race.endDate !== race.startDate);
  const date = (day: string) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  return (
    <section
      className={cn("rounded-xl bg-amber-50 px-3.5 py-3 text-sm dark:bg-amber-950/40", className)}
      aria-label={multiDay ? c.titleDays : c.title}
      data-same-day
    >
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
        <CalendarClock className="size-3.5 shrink-0" aria-hidden />
        {multiDay ? c.titleDays : c.title}
      </p>
      <ul className="space-y-1">
        {races.map((r) => (
          <li key={r.id} className="flex min-w-0 items-baseline gap-2">
            <Link href={eventPagePath(locale, r.slug)} className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline">
              {r.name}
            </Link>
            {multiDay || (r.endDate && r.endDate !== r.startDate) ? (
              <span className="shrink-0 tabular-nums text-muted-foreground">{date(r.startDate)}</span>
            ) : null}
          </li>
        ))}
        {days.map((d) => (
          <li key={d.day} className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{c.taken}</span>
              {d.note ? <span className="text-muted-foreground"> · {d.note}</span> : null}
            </span>
            {multiDay ? <span className="shrink-0 tabular-nums text-muted-foreground">{date(d.day)}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

const UNVERIFIED: Record<string, { title: string; body: string }> = {
  cs: { title: "Kategorie je nutné ověřit", body: "Závod odpovídá zvolenému věku jen podle našeho odhadu. Než vyrazíš, ověř si kategorie v propozicích pořadatele." },
  sk: { title: "Kategórie treba overiť", body: "Pretek zodpovedá zvolenému veku len podľa nášho odhadu. Pred cestou si over kategórie v propozíciách organizátora." },
  en: { title: "Check the categories", body: "This race matches the chosen age only by our estimate. Check the categories in the organiser's regulations before you go." },
};

/** The same yellow note, when an age filter lets a race through only on guessed categories. */
export function UnverifiedAgesNote({ locale, className }: { locale: string; className?: string }) {
  const c = UNVERIFIED[locale] ?? UNVERIFIED.en;
  return (
    <section className={cn("rounded-xl bg-amber-50 px-3.5 py-3 text-sm dark:bg-amber-950/40", className)} aria-label={c.title} data-unverified-ages>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
        <CircleHelp className="size-3.5 shrink-0" aria-hidden />
        {c.title}
      </p>
      <p className="text-pretty">{c.body}</p>
    </section>
  );
}
