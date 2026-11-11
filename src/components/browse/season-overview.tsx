import Link from "next/link";
import type { EventListItem } from "@/lib/events";
import type { Locale } from "@/lib/i18n/messages";
import { SeriesGrid } from "@/components/browse/series-grid";
import { raceMonthHref } from "@/lib/race-list-pagination";

const copy = {
  cs: { months: "Rok v našem kalendáři", series: "Seriály v této kolekci", note: "Počty popisují závody v našem kalendáři." },
  en: { months: "The year in our calendar", series: "Series in this collection", note: "Counts describe races in our calendar." },
  sk: { months: "Rok v našom kalendári", series: "Seriály v tejto kolekcii", note: "Počty opisujú preteky v našom kalendári." },
  pl: { months: "Rok w naszym kalendarzu", series: "Cykle w tej kolekcji", note: "Liczby opisują wyścigi w naszym kalendarzu." },
  de: { months: "Das Jahr in unserem Kalender", series: "Serien in dieser Sammlung", note: "Die Zahlen beschreiben Rennen in unserem Kalender." },
};

export function SeasonOverview({ events, locale, path, page }: { events: EventListItem[]; locale: Locale; path: string; page: number }) {
  const c = copy[locale];
  return <section className="mt-7 space-y-4" aria-labelledby="season-overview"><h2 id="season-overview" className="text-lg font-semibold">{c.months}</h2><ul className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-6">{Array.from({ length: 12 }, (_, month) => {
    const key = `2027-${String(month + 1).padStart(2, "0")}`;
    const count = events.filter(event => event.startDate.startsWith(key)).length;
    const label = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(`${key}-15T12:00:00Z`));
    const fullLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-15T12:00:00Z`));
    const href = raceMonthHref(events, key, path, page);
    const content = <><span className="block text-xs text-muted-foreground">{label}</span><span className="mt-1 block font-semibold tabular-nums">{count}</span></>;
    return <li key={key} className="bg-background">{href ? <Link href={href} prefetch={false} aria-label={`${fullLabel} · ${count}`} className="block px-3 py-2 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">{content}</Link> : <div className="px-3 py-2 text-muted-foreground">{content}</div>}</li>;
  })}</ul><p className="text-xs text-muted-foreground">{c.note}</p>
    <SeriesGrid events={events} locale={locale} title={c.series} size="compact" />
  </section>;
}
