import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listEvents } from "@/lib/events";
import { thisWeekendRange } from "@/lib/date-presets";
import {
  countryDisplayName,
  isListedCountry,
  PUBLIC_COUNTRY_CODES,
} from "@/lib/geo/europe";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { absoluteUrl, fillCopy, hubCopy, localeAlternates, localeOgImagePath, SITE_NAME, socialCard } from "@/lib/seo";
import { addDaysIso, fill, raceCopy, seasonLabel } from "@/lib/seo-race-copy";
import { HubJsonLd } from "@/components/seo/hub-json-ld";
import { listCountryTallies, type HubDiscipline } from "@/lib/discipline-hubs";
import { disciplineLabel } from "@/lib/i18n/taxonomy";
import { MapPinned } from "lucide-react";
import { BrowseHeader, DisciplineTile, TileGrid } from "@/components/browse/browse-ui";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

type Props = { params: Promise<{ locale: string; code: string }> };

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    PUBLIC_COUNTRY_CODES.slice(0, 40).map((code) => ({
      locale,
      code: code.toLowerCase(),
    })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, code: rawCode } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : defaultLocale) as Locale;
  const code = rawCode.toUpperCase();
  if (!isListedCountry(code)) return { title: "Country", robots: { index: false } };
  const name = countryDisplayName(code, locale);
  const copy = hubCopy[locale];
  // The visible title carries the query someone actually types — the country
  // name alone competes with the country, not with race calendars.
  const heading = `${fillCopy(copy.countryTitle, { name })} – ${fill(raceCopy[locale].calendar, { season: seasonLabel() })}`;
  const title = `${heading} · ${SITE_NAME}`;
  const description = fillCopy(copy.country, { name });
  const url = absoluteUrl(`/${locale}/c/${code.toLowerCase()}`);
  return {
    title: heading,
    description,
    alternates: {
      canonical: url,
      languages: localeAlternates(`c/${code.toLowerCase()}`),
    },
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

export default async function CountryHubPage({ params }: Props) {
  const { locale: raw, code: rawCode } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const code = rawCode.toUpperCase();
  if (!isListedCountry(code)) notFound();
  const t = messages[locale];
  const name = countryDisplayName(code, locale);
  const weekend = thisWeekendRange();
  const today = new Date().toISOString().slice(0, 10);
  // The whole coming year, every race a link: the hub is how a crawler — and
  // a reader planning a season — reaches the races beyond next month.
  const [events, tally] = await Promise.all([
    listEvents({ countryCodes: [code], dateFrom: today, dateTo: addDaysIso(today, 365) }),
    listCountryTallies([code]).then((r) => r[0] ?? null).catch(() => null),
  ]);

  const copy = hubCopy[locale];
  const rc = raceCopy[locale];
  const heading = fillCopy(copy.countryTitle, { name });
  const families = (Object.entries(tally?.families ?? {}) as [HubDiscipline, number][]).sort((a, b) => b[1] - a[1]);

  return (
    <main className="min-h-full bg-background">
      <HubJsonLd
        locale={locale}
        title={heading}
        description={fillCopy(copy.country, { name })}
        path={`c/${code.toLowerCase()}`}
        events={events.map((e) => ({
          name: e.name,
          slug: e.slug,
          startDate: e.startDate,
          place: e.location?.municipality ?? e.location?.name ?? null,
        }))}
      />
      <BrowseHeader
        locale={locale}
        crumbs={[{ label: rc.browse, href: `/${locale}/c` }, { label: name }]}
      />
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-4 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          {heading} {seasonLabel()}
        </h1>
        <p className="mt-2 text-pretty text-muted-foreground">{fill(rc.hubIntro, { count: events.length })}</p>
        <div className="mt-5">
          <Button asChild>
            <Link href={`/${locale}?country=${code}&dateFrom=${weekend.from}&dateTo=${weekend.to}`}>
              <MapPinned data-icon="inline-start" />
              {t.viewOnMap}
            </Link>
          </Button>
        </div>

        {families.length > 0 && (
          <TileGrid title={rc.disciplines} className="mt-8">
            {families.map(([family, n]) => (
              <DisciplineTile
                key={family}
                href={`/${locale}/c/${code.toLowerCase()}/${family}`}
                family={family}
                name={disciplineLabel(family, locale)}
                count={`${n} ${t.racesCount}`}
              />
            ))}
          </TileGrid>
        )}

        {families.length === 0 && (
          <Empty className="mt-8 border-0 p-0 md:p-0">
            <EmptyHeader>
              <EmptyTitle>{t.noResults}</EmptyTitle>
              <EmptyDescription>{t.weekendNearYou}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </main>
  );
}
