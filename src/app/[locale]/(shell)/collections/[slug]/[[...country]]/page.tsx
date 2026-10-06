import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/messages";
import { countryDisplayName, isListedCountry, sortCountryCodes } from "@/lib/geo/europe";
import { absoluteUrl, brandedTitle, fillCopy, inCountry, localeAlternates, localeOgImagePath, socialCard } from "@/lib/seo";
import { raceCopy } from "@/lib/seo-race-copy";
import { collectionCopy, collectionPath, collectionPeriod, isCollectionSlug, MIN_COLLECTION_RACES } from "@/lib/race-collections";
import { getRaceCollection, listCollectionSummaries } from "@/lib/race-collection-data";
import { BrowseHeader, BrowseIntro } from "@/components/browse/browse-ui";
import { CollectionGrid } from "@/components/browse/collection-grid";
import { RaceLinkList } from "@/components/seo/race-link-list";
import { HubJsonLd } from "@/components/seo/hub-json-ld";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string; slug: string; country?: string[] }> };

function resolve({ locale: raw, slug, country }: Awaited<Props["params"]>) {
  if (!locales.includes(raw as Locale) || !isCollectionSlug(slug) || (country?.length ?? 0) > 1) return null;
  const countryCode = country?.[0]?.toUpperCase();
  if (countryCode && !isListedCountry(countryCode)) return null;
  const locale = raw as Locale;
  const where = countryCode ? inCountry(countryCode, countryDisplayName(countryCode, locale), locale) : ({ cs: "v Evropě", en: "in Europe", sk: "v Európe", pl: "w Europie", de: "in Europa" } satisfies Record<Locale, string>)[locale];
  const text = collectionCopy[locale].collections[slug];
  return { locale, slug, countryCode, path: collectionPath(slug, countryCode), title: fillCopy(text.title, { in: where }), description: fillCopy(text.description, { in: where }) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = resolve(await params);
  if (!data) return { title: raceCopy[defaultLocale].browse, robots: { index: false, follow: false } };
  const { locale, slug, countryCode, path, title, description } = data;
  const { events } = await getRaceCollection(slug, countryCode);
  return {
    title: brandedTitle(title),
    description,
    alternates: { canonical: absoluteUrl(`/${locale}/${path}`), languages: localeAlternates(path) },
    robots: { index: events.length >= MIN_COLLECTION_RACES, follow: true },
    ...socialCard({ title, description, url: absoluteUrl(`/${locale}/${path}`), localeKey: locale, imagePath: localeOgImagePath(locale), imageAlt: title }),
  };
}

export default async function CollectionPage({ params }: Props) {
  const data = resolve(await params);
  if (!data) notFound();
  const { locale, slug, countryCode, path, title, description } = data;
  const [{ events, window }, summaries] = await Promise.all([getRaceCollection(slug, countryCode), listCollectionSummaries()]);
  const copy = collectionCopy[locale];
  const rc = raceCopy[locale];
  const countries = summaries.filter((s) => s.slug === slug && s.countryCode && s.count > 0).map((s) => s.countryCode!);
  if (countryCode && !countries.includes(countryCode)) countries.push(countryCode);
  const crumbs = [
    { label: rc.browse, href: `/${locale}/c` },
    ...(countryCode ? [{ label: copy.collections[slug].label, href: `/${locale}/${collectionPath(slug)}` }, { label: countryDisplayName(countryCode, locale) }] : [{ label: copy.collections[slug].label }]),
  ];

  return (
    <main className="min-h-full bg-background">
      <HubJsonLd locale={locale} title={title} description={description} path={path} breadcrumb={[{ name: rc.browse, path: "c" }, ...(countryCode ? [{ name: copy.collections[slug].label, path: collectionPath(slug) }] : [])]} events={events.map((e) => ({ name: e.name, slug: e.slug, startDate: e.startDate, place: e.location?.municipality ?? e.location?.name }))} />
      <BrowseHeader locale={locale} crumbs={crumbs} />
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-4 sm:px-6">
        <BrowseIntro title={title} description={description} />
        <p className="mt-4 text-sm font-medium tabular-nums">{collectionPeriod(slug, events.length, locale, window)}</p>
        <nav aria-label={rc.byCountry} className="mt-6 flex flex-wrap gap-2">
          <Button asChild variant={countryCode ? "outline" : "secondary"} size="sm"><Link href={`/${locale}/${collectionPath(slug)}`} aria-current={!countryCode ? "page" : undefined}>{copy.allCountries}</Link></Button>
          {sortCountryCodes(countries, locale).map((code) => (
            <Button key={code} asChild variant={countryCode === code ? "secondary" : "outline"} size="sm"><Link href={`/${locale}/${collectionPath(slug, code)}`} aria-current={countryCode === code ? "page" : undefined}>{countryDisplayName(code, locale)}</Link></Button>
          ))}
        </nav>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">{copy.collections[slug].note}</p>
        {events.length ? (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">{rc.allRaces}</h2>
            <RaceLinkList events={events} locale={locale} groupByMonth={slug !== "weekend" && slug !== "kids-weekend"} headingLevel="h3" />
          </section>
        ) : (
          <Empty className="mt-8 border">
            <EmptyHeader><EmptyTitle>{copy.emptyTitle}</EmptyTitle><EmptyDescription>{copy.emptyDescription}</EmptyDescription></EmptyHeader>
            <Button asChild variant="outline"><Link href={`/${locale}/c`}>{copy.showAll}</Link></Button>
          </Empty>
        )}
        <CollectionGrid locale={locale} countryCode={countryCode} />
      </div>
    </main>
  );
}
