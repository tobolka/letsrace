import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { getSeriesBySlug } from "@/lib/events";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { absoluteUrl, localeAlternates, SITE_NAME } from "@/lib/seo";
import { eventMapPath } from "@/lib/event-url";
import { buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : defaultLocale) as Locale;
  const data = await getSeriesBySlug(slug);
  if (!data) return { title: "Series not found", robots: { index: false } };
  const title = `${data.series.name} · ${SITE_NAME}`;
  const description =
    data.series.description ||
    `${data.events.length} races in ${data.series.name} on Startline.`;
  const url = absoluteUrl(`/${locale}/series/${slug}`);
  return {
    title: data.series.name,
    description,
    alternates: { canonical: url, languages: localeAlternates(`series/${slug}`) },
    openGraph: { title, description, url, siteName: SITE_NAME },
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

  return (
    <main className="min-h-[100dvh] bg-stone-100 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-2xl py-8">
        <Link
          href={`/${locale}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
        >
          {SITE_NAME}
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-950">
          {data.series.name}
        </h1>
        {data.series.description ? (
          <p className="mt-2 text-stone-600">{data.series.description}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={`/${locale}?series=${data.series.slug}`}
            className={cn(buttonVariants({ size: "lg" }))}
          >
            {t.viewOnMap}
          </Link>
        </div>
        <ul className="mt-8 divide-y divide-stone-200 border-y border-stone-200">
          {(upcoming.length ? upcoming : data.events).map((event) => (
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
      </div>
    </main>
  );
}
