import Link from "next/link";
import { getCataloguePreview } from "@/lib/catalogue-preview";
import { messages, type Locale } from "@/lib/i18n/messages";
import { hubPath, localePath } from "@/lib/localized-paths";
import { raceCopy, shortDate, monthHeading } from "@/lib/seo-race-copy";
import { seoCopy } from "@/lib/seo";
import { catalogueViewSeo } from "@/lib/catalogue-view-seo";

export type CatalogueView = "map" | "list" | "schedule";

/** Real, usable HTML until the interactive view takes over; also works without JS. */
export async function CataloguePreview({ locale, view }: { locale: Locale; view: CatalogueView }) {
  const events = await getCataloguePreview();
  const t = messages[locale];
  const rc = raceCopy[locale];
  const copy = view === "map" ? { title: t.introTitle, description: seoCopy[locale].description } : catalogueViewSeo[locale][view];
  const months = Map.groupBy(events, (event) => event.startDate.slice(0, 7));
  return (
    <section className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
        <nav className="flex flex-wrap gap-4 text-sm underline" aria-label={rc.browse}>
          <Link href={`/${locale}/${hubPath(locale)}`}>{rc.browse}</Link>
          {view !== "map" && <Link href={`/${locale}`}>{t.navMap}</Link>}
          {view !== "list" && <Link href={localePath(locale, "list")}>{t.navList}</Link>}
          {view !== "schedule" && <Link href={localePath(locale, "schedule")}>{t.navSchedule}</Link>}
        </nav>
      </header>
      <h2 className="text-lg font-semibold">{rc.upcoming}</h2>
      {[...months].map(([month, races]) => (
        <section key={month}>
          <h3 className="mb-2 text-sm font-semibold">{monthHeading(`${month}-01`, locale)}</h3>
          <ul className="divide-y rounded-xl border px-4">
            {races.map((event) => (
              <li key={event.slug} className="py-3">
                <Link href={localePath(locale, `e/${event.slug}`)} className="font-medium underline-offset-4 hover:underline">{event.name}</Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  <time dateTime={event.startDate}>{shortDate(event.startDate, locale)}</time>
                  {[event.place, event.country].filter(Boolean).map((part, i) => <span key={i}> · {part}</span>)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Link href={`/${locale}/${hubPath(locale)}`} className="text-sm underline">{rc.allRaces}</Link>
    </section>
  );
}
