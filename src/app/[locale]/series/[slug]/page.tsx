import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { getSeriesBySlug } from "@/lib/events";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { absoluteUrl, fillCopy, hubCopy, localeAlternates, localeOgImagePath, SITE_NAME, socialCard } from "@/lib/seo";
import { eventPagePath } from "@/lib/event-url";
import { BrandMark } from "@/components/brand-mark";
import { HubJsonLd } from "@/components/seo/hub-json-ld";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : defaultLocale) as Locale;
  const data = await getSeriesBySlug(slug);
  if (!data) return { title: "Series not found", robots: { index: false } };
  const copy = hubCopy[locale];
  const heading = fillCopy(copy.seriesTitle, { name: data.series.name });
  const title = `${heading} · ${SITE_NAME}`;
  const description =
    data.series.description ||
    fillCopy(copy.series, { name: data.series.name, count: data.events.length });
  const url = absoluteUrl(`/${locale}/series/${slug}`);
  return {
    title: heading,
    description,
    alternates: { canonical: url, languages: localeAlternates(`series/${slug}`) },
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

export default async function SeriesPage({ params }: Props) {
  const { locale: raw, slug } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const data = await getSeriesBySlug(slug);
  if (!data) notFound();
  const t = messages[locale];
  const upcoming = data.events.filter((e) => e.startDate >= new Date().toISOString().slice(0, 10));

  const copy = hubCopy[locale];
  const heading = fillCopy(copy.seriesTitle, { name: data.series.name });

  return (
    <main className="min-h-[100dvh] bg-background px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <HubJsonLd
        locale={locale}
        title={heading}
        description={
          data.series.description ||
          fillCopy(copy.series, { name: data.series.name, count: data.events.length })
        }
        path={`series/${slug}`}
        events={upcoming.map((e) => ({
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
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{data.series.name}</h1>
        {data.series.description ? (
          <p className="mt-2 text-muted-foreground">{data.series.description}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href={`/${locale}?series=${data.series.slug}`}>{t.viewOnMap}</Link>
          </Button>
        </div>
        <Card className="mt-8 gap-0 overflow-hidden py-0">
          <ItemGroup>
            {(upcoming.length ? upcoming : data.events).map((event) => (
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
      </div>
    </main>
  );
}
