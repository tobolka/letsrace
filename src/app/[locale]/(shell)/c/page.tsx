import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/messages";
import { countryDisplayName, PUBLIC_COUNTRY_CODES } from "@/lib/geo/europe";
import { listCountryTallies } from "@/lib/discipline-hubs";
import { absoluteUrl, counted, localeAlternates, localeOgImagePath, SITE_NAME, socialCard } from "@/lib/seo";
import { hubPath } from "@/lib/localized-paths";
import { raceCopy } from "@/lib/seo-race-copy";
import { BrowseHeader, BrowseIntro, CountryCard, TileGrid } from "@/components/browse/browse-ui";
import { CollectionGrid } from "@/components/browse/collection-grid";
import { collectionCopy } from "@/lib/race-collections";
import { BrowseSkeleton } from "./browse-skeleton";

export const revalidate = 604800;

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
  // The skeleton lives here rather than in `loading.tsx`: a segment-level
  // boundary also wraps every country and discipline below, and once it has
  // streamed their 200 they can no longer answer 404.
  return (
    <Suspense fallback={<BrowseSkeleton />}>
      <Browse locale={raw as Locale} />
    </Suspense>
  );
}

async function Browse({ locale }: { locale: Locale }) {
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
              count={counted(c.races, "race", locale)}
            />
          ))}
        </TileGrid>
      </div>
    </main>
  );
}
