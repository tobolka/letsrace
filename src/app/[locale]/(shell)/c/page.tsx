import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { countryDisplayName, PUBLIC_COUNTRY_CODES } from "@/lib/geo/europe";
import { listCountryTallies } from "@/lib/discipline-hubs";
import { absoluteUrl, localeAlternates, localeOgImagePath, SITE_NAME, socialCard } from "@/lib/seo";
import { flagEmoji, raceCopy } from "@/lib/seo-race-copy";
import { BrowseHeader, CountryCard, TileGrid } from "@/components/browse/browse-ui";

export const revalidate = 600;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : defaultLocale) as Locale;
  const rc = raceCopy[locale];
  const url = absoluteUrl(`/${locale}/c`);
  return {
    title: rc.browse,
    description: rc.browseIntro,
    alternates: { canonical: url, languages: localeAlternates("c") },
    ...socialCard({
      title: rc.browse,
      ogTitle: `${rc.browse} · ${SITE_NAME}`,
      description: rc.browseIntro,
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
        <h1 className="text-3xl font-semibold tracking-tight">{rc.byCountry}</h1>
        <p className="mt-2 text-pretty text-muted-foreground">{rc.browseIntro}</p>
        <TileGrid className="mt-8">
          {tallies.map((c) => (
            <CountryCard
              key={c.countryCode}
              href={`/${locale}/c/${c.countryCode.toLowerCase()}`}
              flag={flagEmoji(c.countryCode)}
              name={countryDisplayName(c.countryCode, locale)}
              count={`${c.races} ${t.racesCount}`}
            />
          ))}
        </TileGrid>
      </div>
    </main>
  );
}
