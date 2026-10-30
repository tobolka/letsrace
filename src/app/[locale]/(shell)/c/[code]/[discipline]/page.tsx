import { paginateRaces, raceListPagePath } from "@/lib/race-list-pagination";
import { RaceListPagination } from "@/components/seo/race-list-pagination";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listHubEvents } from "@/lib/race-hub-data";
import { thisWeekendRange } from "@/lib/date-presets";
import { countryDisplayName, isListedCountry } from "@/lib/geo/europe";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { absoluteUrl, brandedTitle, counted, fillCopy, hubCopy, inCountry, localeAlternates, localeOgImagePath, SITE_NAME, socialCard } from "@/lib/seo";
import { hubPath, localePath } from "@/lib/localized-paths";
import {
  disciplineCopy,
  disciplineLeaves,
  isHubDiscipline,
  MIN_RACES,
  type HubDiscipline,
} from "@/lib/discipline-hubs";
import { disciplineLabel } from "@/lib/i18n/taxonomy";
import { MapPinned } from "lucide-react";
import { BrowseHeader, BrowseIntro, SeriesCard, TileGrid } from "@/components/browse/browse-ui";
import { addDaysIso, fill, raceCopy, seasonLabel, seriesIn, shortDate } from "@/lib/seo-race-copy";
import { RaceLinkList } from "@/components/seo/race-link-list";
import { HubJsonLd } from "@/components/seo/hub-json-ld";
import { Button } from "@/components/ui/button";
import { HubSkeleton } from "../hub-skeleton";

/** Paginated variants share one weekly ISR window; rows come from the tagged hub cache. */
export const revalidate = 604800;

type Props = { searchParams: Promise<{ page?: string | string[] }>; params: Promise<{ locale: string; code: string; discipline: string }> };

async function load(rawLocale: string, rawCode: string, rawDiscipline: string) {
  const locale = (locales.includes(rawLocale as Locale) ? rawLocale : defaultLocale) as Locale;
  const code = rawCode.toUpperCase();
  const discipline = rawDiscipline.toLowerCase();
  if (!isListedCountry(code) || !isHubDiscipline(discipline)) return null;

  const today = new Date().toISOString().slice(0, 10);
  const events = await listHubEvents({
    countryCodes: [code],
    disciplines: disciplineLeaves(discipline as HubDiscipline),
    dateFrom: today,
    dateTo: addDaysIso(today, 365),
  });
  return { locale, code, discipline: discipline as HubDiscipline, events };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, code: rawCode, discipline: rawDiscipline } = await params;
  const data = await load(rawLocale, rawCode, rawDiscipline);
  // notFound() here, not just in the page: crawlers get the head before
  // `loading.tsx` streams, so this is where a real 404 status is still possible.
  if (!data) notFound();

  const { locale, code, discipline, events } = data;
  const where = inCountry(code, countryDisplayName(code, locale), locale);
  const copy = disciplineCopy(locale, discipline);
  const heading = `${fillCopy(copy.title, { in: where })} ${seasonLabel()} – ${raceCopy[locale].calendar}`;
  const description = fillCopy(copy.description, { in: where, races: counted(events.length, "race", locale) });
  // Canonical stays on page 1 — reading searchParams here would force dynamic.
  const path = hubPath(locale, code, discipline);
  const url = absoluteUrl(`/${locale}/${path}`);
  const ogTitle = `${heading} · ${SITE_NAME}`;

  return {
    title: brandedTitle(heading),
    description,
    // Per language, not this language's path: `/en/zavody/cz/road` is not a page.
    alternates: { canonical: url, languages: localeAlternates((l) => hubPath(l, code, discipline)) },
    ...socialCard({
      title: heading,
      ogTitle,
      description,
      url,
      localeKey: locale,
      imagePath: localeOgImagePath(locale),
      imageAlt: ogTitle,
    }),
    // A hub thinner than the country page it splits off from competes with its
    // own parent. It stays reachable, it just does not ask to be indexed.
    robots: events.length >= MIN_RACES ? undefined : { index: false, follow: true },
  };
}

export default async function DisciplineHubPage({ params, searchParams }: Props) {
  const { locale: rawLocale, code: rawCode, discipline: rawDiscipline } = await params;
  if (!locales.includes(rawLocale as Locale)) notFound();
  // Checked before the skeleton streams, so an unknown address is a real 404.
  if (!isListedCountry(rawCode.toUpperCase()) || !isHubDiscipline(rawDiscipline.toLowerCase())) notFound();
  return (
    <Suspense fallback={<HubSkeleton />}>
      <DisciplineHub
        rawLocale={rawLocale}
        rawCode={rawCode}
        rawDiscipline={rawDiscipline}
        searchParams={searchParams}
      />
    </Suspense>
  );
}

async function DisciplineHub({
  rawLocale,
  rawCode,
  rawDiscipline,
  searchParams,
}: {
  rawLocale: string;
  rawCode: string;
  rawDiscipline: string;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const data = await load(rawLocale, rawCode, rawDiscipline);
  if (!data) return null;

  const { locale, code, discipline, events } = data;
  const paginated = paginateRaces(events, (await searchParams).page);
  const t = messages[locale];
  const rc = raceCopy[locale];
  const name = countryDisplayName(code, locale);
  const copy = disciplineCopy(locale, discipline);
  const where = inCountry(code, name, locale);
  const heading = fillCopy(copy.title, { in: where });
  const countryHeading = fillCopy(hubCopy[locale].countryTitle, { in: where });
  const weekend = thisWeekendRange();
  const series = seriesIn(events);
  const outside = paginated.events.filter((e) => !e.series);
  const nextOf = (slug: string) => events.find((e) => e.series?.slug === slug)?.startDate;

  return (
    <article className="min-h-full bg-background">
      <HubJsonLd
        locale={locale}
        title={heading}
        description={fillCopy(copy.description, { in: where, races: counted(events.length, "race", locale) })}
        path={raceListPagePath(hubPath(locale, code, discipline), String(paginated.page))}
        breadcrumb={[{ name: countryHeading, path: hubPath(locale, code) }]}
        events={paginated.events.map((e) => ({
          name: e.name,
          slug: e.slug,
          startDate: e.startDate,
          place: e.location?.municipality ?? e.location?.name ?? null,
        }))}
      />
      <BrowseHeader
        locale={locale}
        crumbs={[
          { label: rc.browse, href: `/${locale}/${hubPath(locale)}` },
          { label: name, href: `/${locale}/${hubPath(locale, code)}` },
          { label: disciplineLabel(discipline, locale) },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-4 sm:px-6">
        <BrowseIntro title={`${heading} ${seasonLabel()}`} description={fill(rc.hubIntro, { count: events.length })}>
          <Button asChild>
            <Link href={`/${locale}?country=${code}&disciplines=${discipline}&dateFrom=${weekend.from}&dateTo=${weekend.to}`}>
              <MapPinned data-icon="inline-start" />
              {t.viewOnMap}
            </Link>
          </Button>
        </BrowseIntro>

        {series.length > 0 && (
          <TileGrid title={rc.series} className="mt-8">
            {series.map((s) => {
              const next = nextOf(s.slug);
              return (
                <SeriesCard
                  key={s.slug}
                  href={localePath(locale, `series/${s.slug}`)}
                  name={s.name}
                  meta={[counted(s.rounds, "round", locale), next ? fill(rc.nextRound, { date: shortDate(next, locale) }) : null].filter(Boolean).join(" · ")}
                />
              );
            })}
            {outside.length > 0 && (
              <SeriesCard href="#outside-series" name={rc.outsideSeries} meta={fill(rc.outsideSeriesBody, { count: outside.length })} />
            )}
          </TileGrid>
        )}

        {events.length ? (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold">{rc.allRaces}</h2>
            <RaceLinkList events={paginated.events} locale={locale} headingLevel="h3" />
            <RaceListPagination page={paginated.page} pages={paginated.pages} path={`/${locale}/${hubPath(locale, code, discipline)}`} locale={locale} />
          </section>
        ) : null}

        {series.length > 0 && outside.length > 0 && (
          <section id="outside-series" className="mt-10 scroll-mt-4">
            <h2 className="mb-3 text-lg font-semibold">{rc.outsideSeries}</h2>
            <RaceLinkList events={outside} locale={locale} headingLevel="h3" />
          </section>
        )}

      </div>
    </article>
  );
}
