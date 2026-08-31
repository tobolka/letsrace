import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { listEvents } from "@/lib/events";
import { thisWeekendRange } from "@/lib/date-presets";
import {
  countryDisplayName,
  isListedCountry,
  PUBLIC_COUNTRY_CODES,
} from "@/lib/geo/europe";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { absoluteUrl, fillCopy, hubCopy, localeAlternates, SITE_NAME } from "@/lib/seo";
import { eventPagePath } from "@/lib/event-url";
import { BrandMark } from "@/components/brand-mark";
import { HubJsonLd } from "@/components/seo/hub-json-ld";
import { disciplineCopy, listQualifyingHubs } from "@/lib/discipline-hubs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";

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
  const heading = fillCopy(copy.countryTitle, { name });
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
    openGraph: { title, description, url, siteName: SITE_NAME },
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
  const events = await listEvents({
    countryCodes: [code],
    dateFrom: weekend.from,
    dateTo: addDaysIso(weekend.to, 60),
  });

  const copy = hubCopy[locale];
  const heading = fillCopy(copy.countryTitle, { name });
  // "Gravel races in Czechia" is what people search; the country page is where
  // they can be reached from.
  const disciplineHubs = await listQualifyingHubs([code]);

  return (
    <main className="min-h-[100dvh] bg-background px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
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
        <BrandMark href={`/${locale}`} size="sm" className="mt-5 block" />
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{name}</h1>
        <p className="mt-2 text-muted-foreground">
          {events.length} {t.racesCount} · {t.thisWeekend}+
        </p>
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
        ) : (
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

function addDaysIso(isoDate: string, days: number) {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
