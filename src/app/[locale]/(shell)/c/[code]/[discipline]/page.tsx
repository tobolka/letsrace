import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listEvents } from "@/lib/events";
import { thisWeekendRange } from "@/lib/date-presets";
import { countryDisplayName, isListedCountry } from "@/lib/geo/europe";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { absoluteUrl, brandedTitle, counted, fillCopy, hubCopy, inCountry, localeAlternates, localeOgImagePath, SITE_NAME, socialCard } from "@/lib/seo";
import { hubPath } from "@/lib/browse-paths";
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

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; code: string; discipline: string }> };

async function load(rawLocale: string, rawCode: string, rawDiscipline: string) {
  const locale = (locales.includes(rawLocale as Locale) ? rawLocale : defaultLocale) as Locale;
  const code = rawCode.toUpperCase();
  const discipline = rawDiscipline.toLowerCase();
  if (!isListedCountry(code) || !isHubDiscipline(discipline)) return null;

  const today = new Date().toISOString().slice(0, 10);
  const events = await listEvents({
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
  if (!data) return { title: "Not found", robots: { index: false, follow: false } };

  const { locale, code, discipline, events } = data;
  const where = inCountry(code, countryDisplayName(code, locale), locale);
  const copy = disciplineCopy(locale, discipline);
  const heading = `${fillCopy(copy.title, { in: where })} ${seasonLabel()} – ${raceCopy[locale].calendar}`;
  const description = fillCopy(copy.description, { in: where, races: counted(events.length, "race", locale) });
  const path = hubPath(locale, code, discipline);
  const url = absoluteUrl(`/${locale}/${path}`);
  const ogTitle = `${heading} · ${SITE_NAME}`;

  return {
    title: brandedTitle(heading),
    description,
    alternates: { canonical: url, languages: localeAlternates(path) },
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

export default async function DisciplineHubPage({ params }: Props) {
  const { locale: rawLocale, code: rawCode, discipline: rawDiscipline } = await params;
  if (!locales.includes(rawLocale as Locale)) notFound();
  const data = await load(rawLocale, rawCode, rawDiscipline);
  if (!data) notFound();

  const { locale, code, discipline, events } = data;
  const t = messages[locale];
  const rc = raceCopy[locale];
  const name = countryDisplayName(code, locale);
  const copy = disciplineCopy(locale, discipline);
  const where = inCountry(code, name, locale);
  const heading = fillCopy(copy.title, { in: where });
  const countryHeading = fillCopy(hubCopy[locale].countryTitle, { in: where });
  const weekend = thisWeekendRange();
  const series = seriesIn(events);
  const outside = events.filter((e) => !e.series);
  const nextOf = (slug: string) => events.find((e) => e.series?.slug === slug)?.startDate;

  return (
    <main className="min-h-full bg-background">
      <HubJsonLd
        locale={locale}
        title={heading}
        description={fillCopy(copy.description, { in: where, races: counted(events.length, "race", locale) })}
        path={hubPath(locale, code, discipline)}
        breadcrumb={[{ name: countryHeading, path: hubPath(locale, code) }]}
        events={events.map((e) => ({
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
                  href={`/${locale}/series/${s.slug}`}
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
            <RaceLinkList events={events} locale={locale} headingLevel="h3" />
          </section>
        ) : null}

        {series.length > 0 && outside.length > 0 && (
          <section id="outside-series" className="mt-10 scroll-mt-4">
            <h2 className="mb-3 text-lg font-semibold">{rc.outsideSeries}</h2>
            <RaceLinkList events={outside} locale={locale} headingLevel="h3" />
          </section>
        )}

      </div>
    </main>
  );
}
