import { paginateRaces, raceListPagePath } from "@/lib/race-list-pagination";
import { RaceListPagination } from "@/components/seo/race-list-pagination";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { countryDisplayName, isListedCountry, sortCountryCodes } from "@/lib/geo/europe";
import { absoluteUrl, brandedTitle, fillCopy, inCountry, localeAlternates, localeOgImagePath, socialCard } from "@/lib/seo";
import { raceCopy } from "@/lib/seo-race-copy";
import { collectionAgeCategories, collectionCopy, collectionDates, collectionPeriod, isCollectionSlug, MIN_COLLECTION_RACES, type CollectionSlug, type CollectionWindow } from "@/lib/race-collections";
import { RaceDetailMap } from "@/components/race/race-detail-map";
import { collectionPath, hubPath } from "@/lib/localized-paths";
import { getRaceCollection, listCollectionSummaries } from "@/lib/race-collection-data";
import { BrowseHeader, BrowseIntro } from "@/components/browse/browse-ui";
import { CollectionGrid } from "@/components/browse/collection-grid";
import { RaceLinkList } from "@/components/seo/race-link-list";
import { HubJsonLd } from "@/components/seo/hub-json-ld";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

/** Collection pages are public and slow-moving — hold on the CDN. */
export const revalidate = 604800;

type Props = { searchParams: Promise<{ page?: string | string[] }>; params: Promise<{ locale: string; slug: string; country?: string[] }> };

function resolve({ locale: raw, slug, country }: Awaited<Props["params"]>) {
  if (!locales.includes(raw as Locale) || !isCollectionSlug(slug) || (country?.length ?? 0) > 1) return null;
  const countryCode = country?.[0]?.toUpperCase();
  if (countryCode && !isListedCountry(countryCode)) return null;
  const locale = raw as Locale;
  const where = countryCode ? inCountry(countryCode, countryDisplayName(countryCode, locale), locale) : ({ cs: "v Evropě", en: "in Europe", sk: "v Európe", pl: "w Europie", de: "in Europa" } satisfies Record<Locale, string>)[locale];
  const text = collectionCopy[locale].collections[slug];
  return { locale, slug, countryCode, path: collectionPath(locale, slug, countryCode), title: fillCopy(text.title, { in: where }), description: fillCopy(text.description, { in: where }) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = resolve(await params);
  if (!data) return { title: raceCopy[defaultLocale].browse, robots: { index: false, follow: false } };
  const { locale, slug, countryCode, path, title, description } = data;
  const { events } = await getRaceCollection(slug, countryCode);
  // Canonical stays on page 1 — reading searchParams here would force dynamic.
  const url = absoluteUrl(`/${locale}/${path}`);
  return {
    title: brandedTitle(title),
    description,
    alternates: { canonical: url, languages: localeAlternates((l) => collectionPath(l, slug, countryCode)) },
    robots: { index: events.length >= MIN_COLLECTION_RACES, follow: true },
    ...socialCard({ title, description, url, localeKey: locale, imagePath: localeOgImagePath(locale), imageAlt: title }),
  };
}

/** The same races on the full map: the collection's dates, age band and country as map filters. */
function mapHref(locale: Locale, slug: CollectionSlug, window: CollectionWindow, countryCode?: string) {
  const { from, to } = collectionDates(slug, window);
  const query = new URLSearchParams({ dateFrom: from, dateTo: to });
  const ages = collectionAgeCategories(slug);
  if (ages) query.set("categories", ages.join(","));
  if (slug === "amateur") query.set("levels", "amateur");
  if (countryCode) query.set("country", countryCode);
  return `/${locale}?${query}`;
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const data = resolve(await params);
  if (!data) notFound();
  return (
    <CollectionBody data={data} searchParams={searchParams} />
  );
}

async function CollectionBody({
  data,
  searchParams,
}: {
  data: NonNullable<ReturnType<typeof resolve>>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { locale, slug, countryCode, path, title, description } = data;
  const [{ events, window }, summaries] = await Promise.all([getRaceCollection(slug, countryCode), listCollectionSummaries()]);
  const paginated = paginateRaces(events, (await searchParams).page);
  const copy = collectionCopy[locale];
  const rc = raceCopy[locale];
  const countries = summaries.filter((s) => s.slug === slug && s.countryCode && s.count > 0).map((s) => s.countryCode!);
  if (countryCode && !countries.includes(countryCode)) countries.push(countryCode);
  const crumbs = [
    { label: rc.browse, href: `/${locale}/${hubPath(locale)}` },
    ...(countryCode ? [{ label: copy.collections[slug].label, href: `/${locale}/${collectionPath(locale, slug)}` }, { label: countryDisplayName(countryCode, locale) }] : [{ label: copy.collections[slug].label }]),
  ];

  return (
    <main className="min-h-full bg-background">
      <HubJsonLd locale={locale} title={title} description={description} path={raceListPagePath(path, String(paginated.page))} breadcrumb={[{ name: rc.browse, path: hubPath(locale) }, ...(countryCode ? [{ name: copy.collections[slug].label, path: collectionPath(locale, slug) }] : [])]} events={paginated.events.map((e) => ({ name: e.name, slug: e.slug, startDate: e.startDate, place: e.location?.municipality ?? e.location?.name }))} />
      <BrowseHeader locale={locale} crumbs={crumbs} />
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-4 sm:px-6">
        <BrowseIntro title={title} description={description} />
        <p className="mt-4 text-sm font-medium tabular-nums">{collectionPeriod(slug, events.length, locale, window)}</p>
        <nav aria-label={rc.byCountry} className="mt-6 flex flex-wrap gap-2">
          <Button asChild variant={countryCode ? "outline" : "secondary"} size="sm"><Link href={`/${locale}/${collectionPath(locale, slug)}`} aria-current={!countryCode ? "page" : undefined}>{copy.allCountries}</Link></Button>
          {sortCountryCodes(countries, locale).map((code) => (
            <Button key={code} asChild variant={countryCode === code ? "secondary" : "outline"} size="sm"><Link href={`/${locale}/${collectionPath(locale, slug, code)}`} aria-current={countryCode === code ? "page" : undefined}>{countryDisplayName(code, locale)}</Link></Button>
          ))}
        </nav>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">{copy.collections[slug].note}</p>
        {events.length ? (
          <>
            <section className="mt-8">
              <h2 className="mb-3 text-lg font-semibold">{rc.allRaces}</h2>
              <RaceLinkList events={paginated.events} locale={locale} groupByMonth={slug !== "weekend" && slug !== "kids-weekend"} headingLevel="h3" />
              <RaceListPagination page={paginated.page} pages={paginated.pages} path={`/${locale}/${path}`} locale={locale} />
            </section>
            <section className="mt-8">
              <RaceDetailMap events={events} locale={locale} href={mapHref(locale, slug, window, countryCode)} label={messages[locale].viewOnMap} />
            </section>
          </>
        ) : (
          <Empty className="mt-8 border">
            <EmptyHeader><EmptyTitle>{copy.emptyTitle}</EmptyTitle><EmptyDescription>{copy.emptyDescription}</EmptyDescription></EmptyHeader>
            <Button asChild variant="outline"><Link href={`/${locale}/${hubPath(locale)}`}>{copy.showAll}</Link></Button>
          </Empty>
        )}
        <CollectionGrid locale={locale} countryCode={countryCode} />
      </div>
    </main>
  );
}
