import Link from "next/link";
import type { EventListItem } from "@/lib/events";
import type { Locale } from "@/lib/i18n/messages";
import { localePath } from "@/lib/localized-paths";
import { ageCategoryLabel } from "@/lib/i18n/taxonomy";

const copy = {
  cs: { months: "Rok v našem kalendáři", distances: "Uložené vzdálenosti", categories: "Zveřejněné kategorie", series: "Seriály v této kolekci", note: "Počty a rozsahy popisují uložené závody; chybějící údaje neodhadujeme." },
  en: { months: "The year in our calendar", distances: "Known distances", categories: "Stated categories", series: "Series in this collection", note: "Counts and ranges describe listed races; we do not guess missing information." },
  sk: { months: "Rok v našom kalendári", distances: "Uložené vzdialenosti", categories: "Zverejnené kategórie", series: "Seriály v tejto kolekcii", note: "Počty a rozsahy opisujú uložené preteky; chýbajúce údaje neodhadujeme." },
  pl: { months: "Rok w naszym kalendarzu", distances: "Znane dystanse", categories: "Opublikowane kategorie", series: "Cykle w tej kolekcji", note: "Liczby i zakresy opisują wyścigi w katalogu; nie zgadujemy brakujących informacji." },
  de: { months: "Das Jahr in unserem Kalender", distances: "Bekannte Streckenlängen", categories: "Veröffentlichte Kategorien", series: "Serien in dieser Sammlung", note: "Zahlen und Spannen beschreiben gelistete Rennen; fehlende Angaben werden nicht geschätzt." },
};

export function SeasonOverview({ events, locale }: { events: EventListItem[]; locale: Locale }) {
  const c = copy[locale];
  const distances = events.flatMap(event => (event.categories ?? []).flatMap(category => category.distanceKm != null && category.distanceKm > 0 ? [category.distanceKm] : []));
  const known = events.filter(event => event.categories?.some(category => category.distanceKm != null && category.distanceKm > 0)).length;
  const categories = [...new Set(events.flatMap(event => event.ageConfidence === "explicit" ? event.ageCategories : []))];
  const series = [...new Map(events.flatMap(event => event.series ? [[event.series.id, event.series] as const] : [])).values()].sort((a, b) => a.name.localeCompare(b.name, locale));
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return <section className="mt-7 space-y-4" aria-labelledby="season-overview"><h2 id="season-overview" className="text-lg font-semibold">{c.months}</h2><dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-6">{Array.from({ length: 12 }, (_, month) => {
    const key = `2027-${String(month + 1).padStart(2, "0")}`;
    return <div key={key} className="bg-background px-3 py-2"><dt className="text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(`${key}-15T12:00:00Z`))}</dt><dd className="mt-1 font-semibold tabular-nums">{events.filter(event => event.startDate.startsWith(key)).length}</dd></div>;
  })}</dl><p className="text-xs text-muted-foreground">{c.note}</p>
    {distances.length > 0 && <p className="text-sm"><span className="text-muted-foreground">{c.distances}: </span>{number.format(Math.min(...distances))}–{number.format(Math.max(...distances))} km · {known}/{events.length}</p>}
    {categories.length > 0 && <div><h3 className="mb-2 text-sm font-medium">{c.categories}</h3><p className="text-sm leading-relaxed text-muted-foreground">{categories.map(category => ageCategoryLabel(category, locale)).join(" · ")}</p></div>}
    {series.length > 0 && <div><h3 className="mb-2 text-sm font-medium">{c.series}</h3><ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">{series.map(item => <li key={item.id}><Link className="underline underline-offset-4" href={localePath(locale, `series/${item.slug}`)}>{item.name}</Link></li>)}</ul></div>}
  </section>;
}
