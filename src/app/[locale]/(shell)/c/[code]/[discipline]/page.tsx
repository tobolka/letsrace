import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listEvents } from "@/lib/events";
import { thisWeekendRange } from "@/lib/date-presets";
import { countryDisplayName, isListedCountry } from "@/lib/geo/europe";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { absoluteUrl, fillCopy, hubCopy, localeAlternates, localeOgImagePath, SITE_NAME, socialCard } from "@/lib/seo";
import {
  disciplineCopy,
  disciplineLeaves,
  isHubDiscipline,
  listQualifyingHubs,
  MIN_RACES,
  type HubDiscipline,
} from "@/lib/discipline-hubs";
import { addDaysIso, fill, raceCopy, seasonLabel, seriesIn } from "@/lib/seo-race-copy";
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
  const name = countryDisplayName(code, locale);
  const copy = disciplineCopy(locale, discipline);
  const heading = `${fillCopy(copy.title, { name })} – ${fill(raceCopy[locale].calendar, { season: seasonLabel() })}`;
  const description = fillCopy(copy.description, { name, count: events.length });
  const path = `c/${code.toLowerCase()}/${discipline}`;
  const url = absoluteUrl(`/${locale}/${path}`);
  const ogTitle = `${heading} · ${SITE_NAME}`;

  return {
    title: heading,
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
  const name = countryDisplayName(code, locale);
  const copy = disciplineCopy(locale, discipline);
  const heading = fillCopy(copy.title, { name });
  const countryHeading = fillCopy(hubCopy[locale].countryTitle, { name });
  const weekend = thisWeekendRange();
  const siblings = (await listQualifyingHubs([code])).filter((c) => c.discipline !== discipline);
  const series = seriesIn(events);

  return (
    <main className="min-h-full bg-background px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-2 md:pt-4">
      <HubJsonLd
        locale={locale}
        title={heading}
        description={fillCopy(copy.description, { name, count: events.length })}
        path={`c/${code.toLowerCase()}/${discipline}`}
        breadcrumb={[{ name: countryHeading, path: `c/${code.toLowerCase()}` }]}
        events={events.map((e) => ({
          name: e.name,
          slug: e.slug,
          startDate: e.startDate,
          place: e.location?.municipality ?? e.location?.name ?? null,
        }))}
      />
      <div className="mx-auto max-w-2xl py-8">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/${locale}/c/${code.toLowerCase()}`}>{countryHeading}</Link>
        </Button>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {heading} {seasonLabel()}
        </h1>
        <p className="mt-3 text-pretty text-muted-foreground">{fill(raceCopy[locale].hubIntro, { count: events.length })}</p>
        <div className="mt-6">
          <Button asChild size="lg">
            <Link
              href={`/${locale}?country=${code}&disciplines=${discipline}&dateFrom=${weekend.from}&dateTo=${weekend.to}`}
            >
              {t.viewOnMap}
            </Link>
          </Button>
        </div>

        {events.length ? (
          <div className="mt-8">
            <RaceLinkList events={events} locale={locale} />
          </div>
        ) : null}

        {series.length > 0 && (
          <nav aria-label={raceCopy[locale].series} className="mt-10">
            <h2 className="mb-3 text-lg font-semibold">{raceCopy[locale].series}</h2>
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

        {siblings.length > 0 && (
          <nav aria-label={heading} className="mt-8 flex flex-wrap gap-2">
            {siblings.map((s) => (
              <Button key={s.discipline} asChild variant="outline" size="sm">
                <Link href={`/${locale}/c/${code.toLowerCase()}/${s.discipline}`}>
                  {fillCopy(disciplineCopy(locale, s.discipline).title, { name })}
                </Link>
              </Button>
            ))}
          </nav>
        )}
      </div>
    </main>
  );
}
