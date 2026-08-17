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
import { buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

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
  const description = `Cycling races in ${name} — map calendar on Startline.`;
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
    <main className="min-h-[100dvh] bg-stone-100 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-2xl py-8">
        <Link
          href={`/${locale}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
        >
          {SITE_NAME}
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-950">{name}</h1>
        <p className="mt-2 text-stone-600">
          {events.length} {t.racesCount} · {t.thisWeekend}+
        </p>
        <div className="mt-6">
          <Link
            href={`/${locale}?country=${code}&dateFrom=${weekend.from}&dateTo=${weekend.to}`}
            className={cn(buttonVariants({ size: "lg" }))}
          >
            {t.viewOnMap}
          </Link>
        </div>
        <ul className="mt-8 divide-y divide-stone-200 border-y border-stone-200">
          {events.slice(0, 40).map((event) => (
            <li key={event.id}>
              <Link
                href={eventMapPath(locale, event)}
                className="flex min-h-14 flex-col gap-0.5 py-3.5 touch-manipulation hover:bg-stone-50/80 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <span className="font-medium text-stone-900">{event.name}</span>
                <time className="tabular shrink-0 text-sm text-stone-500" dateTime={event.startDate}>
                  {format(parseISO(event.startDate), "d MMM yyyy")}
                </time>
              </Link>
            </li>
          ))}
        </ul>
        {!events.length ? (
          <p className="mt-6 text-sm text-stone-500">{t.noResults}</p>
        ) : null}
      </div>
    </main>
  );
}

function addDaysIso(isoDate: string, days: number) {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
