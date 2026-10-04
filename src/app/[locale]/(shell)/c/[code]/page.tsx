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
import { addDaysIso, fill, raceCopy, seasonLabel, seriesIn } from "@/lib/seo-race-copy";
import { RaceLinkList } from "@/components/seo/race-link-list";
import { HubJsonLd } from "@/components/seo/hub-json-ld";
import { disciplineCopy, listQualifyingHubs } from "@/lib/discipline-hubs";
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
  const events = await listEvents({
    countryCodes: [code],
    dateFrom: today,
    dateTo: addDaysIso(today, 365),
  });

  const copy = hubCopy[locale];
  const rc = raceCopy[locale];
  const heading = fillCopy(copy.countryTitle, { name });
  // "Gravel races in Czechia" is what people search; the country page is where
  // they can be reached from.
  const disciplineHubs = await listQualifyingHubs([code]);
  const series = seriesIn(events);

  return (
    <main className="min-h-full bg-background px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-2 md:pt-4">
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
      <div className="mx-auto max-w-2xl py-8">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/${locale}`}>{SITE_NAME}</Link>
        </Button>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {heading} {seasonLabel()}
        </h1>
        <p className="mt-3 text-pretty text-muted-foreground">{fill(rc.hubIntro, { count: events.length })}</p>
        <div className="mt-6">
          <Button asChild size="lg">
            <Link href={`/${locale}?country=${code}&dateFrom=${weekend.from}&dateTo=${weekend.to}`}>
              {t.viewOnMap}
            </Link>
          </Button>
        </div>
        {disciplineHubs.length > 0 && (
          <nav aria-label={heading} className="mt-6 flex flex-wrap gap-2">
            {disciplineHubs.map((h) => (
              <Button key={h.discipline} asChild variant="outline" size="sm">
                <Link href={`/${locale}/c/${code.toLowerCase()}/${h.discipline}`}>
                  {fillCopy(disciplineCopy(locale, h.discipline).title, { name })}
                  <span className="ml-1 text-muted-foreground tabular-nums">{h.races}</span>
                </Link>
              </Button>
            ))}
          </nav>
        )}

        {events.length ? (
          <div className="mt-8">
            <RaceLinkList events={events} locale={locale} />
          </div>
        ) : (
          <Empty className="mt-8 border-0 p-0 md:p-0">
            <EmptyHeader>
              <EmptyTitle>{t.noResults}</EmptyTitle>
              <EmptyDescription>{t.weekendNearYou}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {series.length > 0 && (
          <nav aria-label={rc.series} className="mt-10">
            <h2 className="mb-3 text-lg font-semibold">{rc.series}</h2>
            <div className="flex flex-wrap gap-2">
              {series.map((s) => (
                <Button key={s.slug} asChild variant="outline" size="sm">
                  <Link href={`/${locale}/series/${s.slug}`}>
                    {s.name}
                    <span className="ml-1 text-muted-foreground tabular-nums">{s.rounds}</span>
                  </Link>
                </Button>
              ))}
            </div>
          </nav>
        )}
      </div>
    </main>
  );
}
