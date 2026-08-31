import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { listEvents } from "@/lib/events";
import { thisWeekendRange } from "@/lib/date-presets";
import { countryDisplayName, isListedCountry } from "@/lib/geo/europe";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { absoluteUrl, fillCopy, hubCopy, localeAlternates, SITE_NAME } from "@/lib/seo";
import {
  disciplineCopy,
  disciplineLeaves,
  isHubDiscipline,
  listQualifyingHubs,
  MIN_RACES,
  type HubDiscipline,
} from "@/lib/discipline-hubs";
import { eventPagePath } from "@/lib/event-url";
import { BrandMark } from "@/components/brand-mark";
import { HubJsonLd } from "@/components/seo/hub-json-ld";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; code: string; discipline: string }> };

function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

async function load(rawLocale: string, rawCode: string, rawDiscipline: string) {
  const locale = (locales.includes(rawLocale as Locale) ? rawLocale : defaultLocale) as Locale;
  const code = rawCode.toUpperCase();
  const discipline = rawDiscipline.toLowerCase();
  if (!isListedCountry(code) || !isHubDiscipline(discipline)) return null;

  const weekend = thisWeekendRange();
  const events = await listEvents({
    countryCodes: [code],
    disciplines: disciplineLeaves(discipline as HubDiscipline),
    dateFrom: weekend.from,
    dateTo: addDaysIso(weekend.to, 120),
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
  const heading = fillCopy(copy.title, { name });
  const description = fillCopy(copy.description, { name, count: events.length });
  const path = `c/${code.toLowerCase()}/${discipline}`;

  return {
    title: heading,
    description,
    alternates: { canonical: absoluteUrl(`/${locale}/${path}`), languages: localeAlternates(path) },
    openGraph: {
      title: `${heading} · ${SITE_NAME}`,
      description,
      url: absoluteUrl(`/${locale}/${path}`),
      siteName: SITE_NAME,
    },
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

  return (
    <main className="min-h-[100dvh] bg-background px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
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
        <BrandMark href={`/${locale}`} size="sm" className="mt-5 block" />
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{heading}</h1>
        <p className="mt-2 text-muted-foreground">
          {events.length} {t.racesCount}
        </p>
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
          <Card className="mt-8 gap-0 overflow-hidden py-0">
            <ItemGroup>
              {events.slice(0, 40).map((event) => (
                <Item key={event.id} asChild size="sm" className="rounded-none border-x-0 border-t-0">
                  <Link href={eventPagePath(locale, event.slug)}>
                    <ItemContent>
                      <ItemTitle>{event.name}</ItemTitle>
                    </ItemContent>
                    <ItemActions>
                      <time className="tabular text-sm text-muted-foreground" dateTime={event.startDate}>
                        {format(parseISO(event.startDate), "d MMM yyyy")}
                      </time>
                    </ItemActions>
                  </Link>
                </Item>
              ))}
            </ItemGroup>
          </Card>
        ) : null}

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
