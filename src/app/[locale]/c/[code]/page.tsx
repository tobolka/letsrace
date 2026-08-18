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
import { absoluteUrl, localeAlternates, SITE_NAME } from "@/lib/seo";
import { eventMapPath } from "@/lib/event-url";
import { BrandMark } from "@/components/brand-mark";
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
  const title = `${name} · ${SITE_NAME}`;
  const description = `Cycling races in ${name} — map calendar on ${SITE_NAME}.`;
  const url = absoluteUrl(`/${locale}/c/${code.toLowerCase()}`);
  return {
    title: name,
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

  return (
    <main className="min-h-[100dvh] bg-background px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
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
        {events.length ? (
          <Card className="mt-8 gap-0 overflow-hidden py-0">
            <ItemGroup>
              {events.slice(0, 40).map((event) => (
                <Item key={event.id} asChild size="sm" className="rounded-none border-x-0 border-t-0">
                  <Link href={eventMapPath(locale, event)}>
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
