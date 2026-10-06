import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { countryDisplayName, PUBLIC_COUNTRY_CODES } from "@/lib/geo/europe";
import { listCountryTallies } from "@/lib/discipline-hubs";
import { absoluteUrl, localeAlternates, localeOgImagePath, SITE_NAME, socialCard } from "@/lib/seo";
import { hubPath } from "@/lib/browse-paths";
import { raceCopy } from "@/lib/seo-race-copy";
import { BrowseHeader, BrowseIntro, CountryCard, TileGrid } from "@/components/browse/browse-ui";
import { CollectionGrid } from "@/components/browse/collection-grid";
import { collectionCopy } from "@/lib/race-collections";

export const revalidate = 600;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : defaultLocale) as Locale;
  const rc = raceCopy[locale];
  const url = absoluteUrl(`/${locale}/${hubPath(locale)}`);
  return {
    title: rc.browseTitle,
    description: rc.browseDescription,
    alternates: { canonical: url, languages: localeAlternates((l) => hubPath(l)) },
    ...socialCard({
      title: rc.browseTitle,
      ogTitle: `${rc.browseTitle} · ${SITE_NAME}`,
      description: rc.browseDescription,
      url,
      localeKey: locale,
      imagePath: localeOgImagePath(locale),
    }),
  };
}

/**
 * The way into the races for someone who would rather choose than pan a map:
 * countries first, then disciplines, then series.
 */
export default async function BrowsePage({ params }: Props) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const t = messages[locale];
  const rc = raceCopy[locale];
  const tallies = await listCountryTallies([...PUBLIC_COUNTRY_CODES]).catch(() => []);

  return (
    <main className="min-h-full bg-background">
      <BrowseHeader locale={locale} crumbs={[{ label: rc.browse }]} />
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-4 sm:px-6">
        <BrowseIntro title={rc.browse} description={collectionCopy[locale].browseIntro} />
        <CollectionGrid locale={locale} />
        <TileGrid title={rc.byCountry} className="mt-8">
          {tallies.map((c) => (
            <CountryCard
              key={c.countryCode}
              href={`/${locale}/${hubPath(locale, c.countryCode)}`}
              code={c.countryCode}
              name={countryDisplayName(c.countryCode, locale)}
              count={`${c.races} ${t.racesCount}`}
            />
          ))}
        </TileGrid>
      </div>
    </main>
  );
}
