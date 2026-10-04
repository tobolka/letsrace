import type { Metadata } from "next";
import Link from "next/link";
import { MapPinned } from "lucide-react";
import { notFound } from "next/navigation";
import { getSeriesBySlug } from "@/lib/events";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { absoluteUrl, fillCopy, hubCopy, localeAlternates, localeOgImagePath, SITE_NAME, socialCard } from "@/lib/seo";
import { raceCopy, seasonLabel } from "@/lib/seo-race-copy";
import { RaceLinkList } from "@/components/seo/race-link-list";
import { BrowseHeader, BrowseIntro } from "@/components/browse/browse-ui";
import { browseCrumbs, browsePlace } from "@/lib/browse-trail";
import { countryDisplayName, isListedCountry } from "@/lib/geo/europe";
import { HubJsonLd } from "@/components/seo/hub-json-ld";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : defaultLocale) as Locale;
  const data = await getSeriesBySlug(slug);
  if (!data) return { title: "Series not found", robots: { index: false } };
  const copy = hubCopy[locale];
  const heading = `${fillCopy(copy.seriesTitle, { name: data.series.name })} ${seasonLabel()}`;
  const title = `${heading} · ${SITE_NAME}`;
  const description =
    data.series.description ||
    fillCopy(copy.series, { name: data.series.name, count: data.events.length });
  const url = absoluteUrl(`/${locale}/series/${slug}`);
  return {
    title: heading,
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
  };
}

export default async function SeriesPage({ params }: Props) {
  const { locale: raw, slug } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const data = await getSeriesBySlug(slug);
  if (!data) notFound();
  const t = messages[locale];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = data.events.filter((e) => e.startDate >= today);
  const past = data.events.filter((e) => e.startDate < today);
  const rc = raceCopy[locale];
  const countries = [...new Set(data.events.map((e) => e.location?.countryCode).filter((c): c is string => Boolean(c) && isListedCountry(c!)))];

  const copy = hubCopy[locale];
  const heading = fillCopy(copy.seriesTitle, { name: data.series.name });

  return (
    <main className="min-h-full bg-background">
      <HubJsonLd
        locale={locale}
        title={heading}
        description={
          data.series.description ||
          fillCopy(copy.series, { name: data.series.name, count: data.events.length })
        }
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
          description={data.series.description || fillCopy(copy.series, { name: data.series.name, count: data.events.length })}
        >
          <Button asChild>
            <Link href={`/${locale}?series=${data.series.slug}`}>
              <MapPinned data-icon="inline-start" />
              {t.viewOnMap}
            </Link>
          </Button>
        </BrowseIntro>
        {data.series.description ? (
          <p className="mt-6 text-pretty text-muted-foreground">
            {fillCopy(copy.series, { name: data.series.name, count: data.events.length })}
          </p>
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
                <Link href={`/${locale}/c/${c.toLowerCase()}`}>
                  {fillCopy(copy.countryTitle, { name: countryDisplayName(c, locale) })}
                </Link>
              </Button>
            ))}
          </nav>
        )}
      </div>
    </main>
  );
}
