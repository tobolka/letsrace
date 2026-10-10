import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { MapPinned } from "lucide-react";
import { notFound } from "next/navigation";
import { getPublicSeriesRow, getSeriesBySlug } from "@/lib/events";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { absoluteUrl, brandedTitle, counted, fillCopy, hubCopy, inCountry, localeAlternates, localeOgImagePath, SITE_NAME, socialCard } from "@/lib/seo";
import { hubPath, localePath } from "@/lib/localized-paths";
import { DESCRIPTION_MAX, raceCopy, seasonLabel } from "@/lib/seo-race-copy";
import { RaceLinkList } from "@/components/seo/race-link-list";
import { BrowseHeader, BrowseIntro } from "@/components/browse/browse-ui";
import { browseCrumbs, browsePlace } from "@/lib/browse-trail";
import { countryDisplayName, isListedCountry } from "@/lib/geo/europe";
import { HubJsonLd } from "@/components/seo/hub-json-ld";
import { Button } from "@/components/ui/button";
import { SeriesSkeleton } from "./series-skeleton";

/**
 * Cached and rebuilt at most hourly (ISR). The catalogue refreshes once a day,
 * so an hour is fresh; no page is built ahead — each on its first visit.
 */
export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; slug: string }> };

/**
 * The words a series page is found by. The season is the series' own — the
 * years its rounds are in — not the calendar's, and a name that already
 * carries a year ("3Lions-GRAVEL-Cup 2026") is not given a second one.
 *
 * The description an editor wrote for a series is Czech; it leads the Czech
 * page and stays off the others, which used to show it to English and German
 * readers as their page's description.
 */
function seriesWords(data: NonNullable<Awaited<ReturnType<typeof getSeriesBySlug>>>, locale: Locale) {
  const copy = hubCopy[locale];
  const name = data.series.name;
  const years = data.events.map((e) => Number(e.startDate.slice(0, 4)));
  const first = years.length ? Math.min(...years) : null;
  const last = years.length ? Math.max(...years) : null;
  const season =
    first == null ? seasonLabel() : first === last ? String(first) : last === first + 1 ? `${first}/${String(last).slice(2)}` : `${first}–${last}`;
  const named = /\b20\d\d\b/.test(name) ? name : `${name} ${season}`;
  const generated = fillCopy(copy.series, { name, rounds: counted(data.events.length, "round", locale), season });
  const own = locale === "cs" ? data.series.description?.trim() || null : null;
  const description = own && `${own} ${generated}`.length <= DESCRIPTION_MAX ? `${own} ${generated}` : own ?? generated;
  return { title: fillCopy(copy.seriesTitle, { name: named }), description, generated, own };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : defaultLocale) as Locale;
  const data = await getSeriesBySlug(slug);
  // notFound() here, not just in the page: crawlers get the head before
  // `loading.tsx` streams, so this is where a real 404 status is still possible.
  if (!data) notFound();
  const { title: heading, description } = seriesWords(data, locale);
  const title = `${heading} · ${SITE_NAME}`;
  const url = absoluteUrl(localePath(locale, `series/${slug}`));
  return {
    title: brandedTitle(heading),
    description,
    alternates: { canonical: url, languages: localeAlternates(`series/${slug}`) },
    ...socialCard({
      title: heading,
      ogTitle: title,
      description,
      url,
      localeKey: locale,
      imagePath: localeOgImagePath(locale),
      imageAlt: title,
    }),
    // Every round outside the countries we publish: the page lists nothing.
    ...(data.events.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function SeriesPage({ params }: Props) {
  const { locale: raw, slug } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  // One row, before the skeleton streams: an unknown series is a real 404.
  if (!(await getPublicSeriesRow(slug))) notFound();
  return (
    <Suspense fallback={<SeriesSkeleton />}>
      <Series locale={raw as Locale} slug={slug} />
    </Suspense>
  );
}

async function Series({ locale, slug }: { locale: Locale; slug: string }) {
  const data = await getSeriesBySlug(slug);
  if (!data) notFound();
  const t = messages[locale];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = data.events.filter((e) => e.startDate >= today);
  const past = data.events.filter((e) => e.startDate < today);
  const rc = raceCopy[locale];
  const countries = [...new Set(data.events.map((e) => e.location?.countryCode).filter((c): c is string => Boolean(c) && isListedCountry(c!)))];

  const copy = hubCopy[locale];
  const words = seriesWords(data, locale);
  const heading = words.title;

  return (
    <main className="min-h-full bg-background">
      <HubJsonLd
        locale={locale}
        title={heading}
        description={words.description}
        path={`series/${slug}`}
        events={upcoming.map((e) => ({
          name: e.name,
          slug: e.slug,
          startDate: e.startDate,
          place: e.location?.municipality ?? e.location?.name ?? null,
        }))}
      />
      <BrowseHeader locale={locale} crumbs={[...browseCrumbs(locale, browsePlace(data.events)), { label: data.series.name }]} />
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-4 sm:px-6">
        <BrowseIntro
          title={data.series.name}
          description={words.own ?? words.generated}
        >
          <Button asChild>
            <Link href={`/${locale}?series=${data.series.slug}`}>
              <MapPinned data-icon="inline-start" />
              {t.viewOnMap}
            </Link>
          </Button>
        </BrowseIntro>
        {words.own ? (
          <p className="mt-6 text-pretty text-muted-foreground">{words.generated}</p>
        ) : null}
        {upcoming.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">{rc.upcoming}</h2>
            <RaceLinkList events={upcoming} locale={locale} headingLevel="h3" />
          </section>
        )}
        {past.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold">{rc.pastRounds}</h2>
            <RaceLinkList events={past} locale={locale} groupByMonth={false} />
          </section>
        )}
        {countries.length > 0 && (
          <nav aria-label={rc.byCountry} className="mt-10 flex flex-wrap gap-2">
            {countries.map((c) => (
              <Button key={c} asChild variant="outline" size="sm">
                <Link href={`/${locale}/${hubPath(locale, c)}`}>
                  {fillCopy(copy.countryTitle, { in: inCountry(c, countryDisplayName(c, locale), locale) })}
                </Link>
              </Button>
            ))}
          </nav>
        )}
      </div>
    </main>
  );
}
