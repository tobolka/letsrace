import { paginateRaces, raceListPagePath } from "@/lib/race-list-pagination";
import { RaceListPagination } from "@/components/seo/race-list-pagination";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listHubEvents } from "@/lib/race-hub-data";
import { thisWeekendRange } from "@/lib/date-presets";
import {
  countryDisplayName,
  isListedCountry,
} from "@/lib/geo/europe";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { absoluteUrl, brandedTitle, counted, fillCopy, hubCopy, inCountry, localeAlternates, localeOgImagePath, SITE_NAME, socialCard } from "@/lib/seo";
import { hubPath } from "@/lib/localized-paths";
import { addDaysIso, fill, raceCopy, seasonLabel } from "@/lib/seo-race-copy";
import { HubJsonLd } from "@/components/seo/hub-json-ld";
import { RaceLinkList } from "@/components/seo/race-link-list";
import { listCountryTallies, type HubDiscipline } from "@/lib/discipline-hubs";
import { disciplineLabel } from "@/lib/i18n/taxonomy";
import { DISCIPLINE_TREE } from "@/lib/taxonomy";
import { MapPinned } from "lucide-react";
import { BrowseHeader, BrowseIntro, DisciplineTile, TileGrid } from "@/components/browse/browse-ui";
import { Button } from "@/components/ui/button";
import { CollectionGrid } from "@/components/browse/collection-grid";
import { HubSkeleton } from "./hub-skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

type Props = { searchParams: Promise<{ page?: string | string[] }>; params: Promise<{ locale: string; code: string }> };

/** Paginated variants share one weekly ISR window; rows come from the tagged hub cache. */
export const revalidate = 604800;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, code: rawCode } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : defaultLocale) as Locale;
  const code = rawCode.toUpperCase();
  // notFound() here, not just in the page: crawlers get the head before
  // `loading.tsx` streams, so this is where a real 404 status is still possible.
  if (!isListedCountry(code)) notFound();
  // Canonical stays on page 1 so metadata never reads searchParams (that would
  // force the whole hub dynamic and burn Hobby Origin Transfer).
  const where = inCountry(code, countryDisplayName(code, locale), locale);
  const copy = hubCopy[locale];
  // The visible title carries the query someone actually types — the country
  // name alone competes with the country, not with race calendars.
  const heading = `${fillCopy(copy.countryTitle, { in: where })} ${seasonLabel()} – ${raceCopy[locale].calendar}`;
  const title = `${heading} · ${SITE_NAME}`;
  const description = fillCopy(copy.country, { in: where });
  const url = absoluteUrl(`/${locale}/${hubPath(locale, code)}`);
  return {
    title: brandedTitle(heading),
    description,
    alternates: {
      canonical: url,
      languages: localeAlternates((l) => hubPath(l, code)),
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

export default async function CountryHubPage({ params, searchParams }: Props) {
  const { locale: raw, code: rawCode } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const code = rawCode.toUpperCase();
  if (!isListedCountry(code)) notFound();
  // searchParams stay inside Suspense so the route can still ISR on the CDN.
  return (
    <Suspense fallback={<HubSkeleton />}>
      <CountryHub locale={raw as Locale} code={code} searchParams={searchParams} />
    </Suspense>
  );
}

async function CountryHub({
  locale,
  code,
  searchParams,
}: {
  locale: Locale;
  code: string;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const rawPage = (await searchParams).page;
  const t = messages[locale];
  const name = countryDisplayName(code, locale);
  const weekend = thisWeekendRange();
  const today = new Date().toISOString().slice(0, 10);
  // The whole coming year, every race a link: the hub is how a crawler — and
  // a reader planning a season — reaches the races beyond next month.
  const [events, tally] = await Promise.all([
    listHubEvents({ countryCodes: [code], dateFrom: today, dateTo: addDaysIso(today, 365) }),
    listCountryTallies([code]).then((r) => r[0] ?? null).catch(() => null),
  ]);

  const paginated = paginateRaces(events, rawPage);
  const copy = hubCopy[locale];
  const rc = raceCopy[locale];
  const where = inCountry(code, name, locale);
  const heading = fillCopy(copy.countryTitle, { in: where });
  const disciplineOrder = DISCIPLINE_TREE.map(({ id }) => id);
  const families = (Object.entries(tally?.families ?? {}) as [HubDiscipline, number][])
    .sort((a, b) => disciplineOrder.indexOf(a[0]) - disciplineOrder.indexOf(b[0]));

  return (
    <main className="min-h-full bg-background">
      <HubJsonLd
        locale={locale}
        title={heading}
        description={fillCopy(copy.country, { in: where })}
        path={raceListPagePath(hubPath(locale, code), String(paginated.page))}
        events={paginated.events.map((e) => ({
          name: e.name,
          slug: e.slug,
          startDate: e.startDate,
          place: e.location?.municipality ?? e.location?.name ?? null,
        }))}
      />
      <BrowseHeader
        locale={locale}
        crumbs={[{ label: rc.browse, href: `/${locale}/${hubPath(locale)}` }, { label: name }]}
      />
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-4 sm:px-6">
        <BrowseIntro title={`${heading} ${seasonLabel()}`} description={fill(rc.hubIntro, { count: events.length })}>
          <Button asChild>
            <Link href={`/${locale}?country=${code}&dateFrom=${weekend.from}&dateTo=${weekend.to}`}>
              <MapPinned data-icon="inline-start" />
              {t.viewOnMap}
            </Link>
          </Button>
        </BrowseIntro>

        <CollectionGrid locale={locale} countryCode={code} />

        {families.length > 0 && (
          <TileGrid title={rc.disciplines} className="mt-8">
            {families.map(([family, n]) => (
              <DisciplineTile
                key={family}
                href={`/${locale}/${hubPath(locale, code, family)}`}
                family={family}
                name={disciplineLabel(family, locale)}
                count={counted(n, "race", locale)}
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

        {/* The list the comment above promises. Without it the races were only in
            the JSON-LD, and most race pages had no link in from anywhere. */}
        {events.length ? (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold">{rc.allRaces}</h2>
            <RaceLinkList events={paginated.events} locale={locale} headingLevel="h3" />
            <RaceListPagination page={paginated.page} pages={paginated.pages} path={`/${locale}/${hubPath(locale, code)}`} locale={locale} />
          </section>
        ) : null}
      </div>
    </main>
  );
}
