import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { countryDisplayName, PUBLIC_COUNTRY_CODES } from "@/lib/geo/europe";
import { listCountryTallies } from "@/lib/discipline-hubs";
import { absoluteUrl, localeAlternates, localeOgImagePath, SITE_NAME, socialCard } from "@/lib/seo";
import { raceCopy } from "@/lib/seo-race-copy";
import { BrowseHeader, BrowseIntro, CountryCard, TileGrid } from "@/components/browse/browse-ui";

export const revalidate = 600;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : defaultLocale) as Locale;
  const rc = raceCopy[locale];
  const url = absoluteUrl(`/${locale}/c`);
  return {
    title: rc.browseTitle,
    description: rc.browseDescription,
    alternates: { canonical: url, languages: localeAlternates("c") },
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
        <BrowseIntro title={rc.byCountry} description={rc.browseIntro} />
        <TileGrid className="mt-8">
          {tallies.map((c) => (
            <CountryCard
              key={c.countryCode}
              href={`/${locale}/c/${c.countryCode.toLowerCase()}`}
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
