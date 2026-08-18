import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft, ExternalLink, MapPinned } from "lucide-react";
import { getPublicEventBySlug } from "@/lib/events";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import {
  DISCIPLINE_LABELS,
  RACE_LEVEL_LABELS,
  formatEventCategoryLabel,
  type Discipline,
  type RaceLevel,
} from "@/lib/taxonomy";
import { disciplineColor, disciplineColorDark } from "@/lib/map-visuals";
import { absoluteUrl, localeAlternates, SITE_AUTHOR, SITE_NAME } from "@/lib/seo";
import { EventJsonLd } from "@/components/seo/event-json-ld";
import { OutboundTrackLink } from "@/components/seo/outbound-track-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { eventMapPath } from "@/lib/event-url";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : defaultLocale) as Locale;
  const event = await getPublicEventBySlug(slug);
  if (!event) {
    return { title: "Race not found", robots: { index: false, follow: false } };
  }

  const place =
    event.location?.municipality || event.location?.name || event.location?.countryCode || "";
  const date = format(parseISO(event.startDate), "d MMM yyyy");
  const title = place ? `${event.name} · ${place}` : event.name;
  const disc = event.disciplines
    .slice(0, 3)
    .map((d) => DISCIPLINE_LABELS[d as Discipline] || d)
    .filter(Boolean)
    .join(", ");
  const description = [date, place, disc, "Find this race on Startline."]
    .filter(Boolean)
    .join(" · ");
  const url = absoluteUrl(`/${locale}/e/${event.slug}`);

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: localeAlternates(`e/${event.slug}`),
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function EventPage({ params }: Props) {
  const { locale: raw, slug } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const event = await getPublicEventBySlug(slug);
  if (!event) notFound();

  const t = messages[locale];
  const place =
    [event.location?.municipality || event.location?.name, event.location?.countryCode]
      .filter(Boolean)
      .join(" · ") || "—";
  const dateLabel =
    format(parseISO(event.startDate), "EEEE d MMMM yyyy") +
    (event.endDate && event.endDate !== event.startDate
      ? ` – ${format(parseISO(event.endDate), "d MMMM yyyy")}`
      : "");
  const whoLabel = formatEventCategoryLabel(event, {
    kids: t.kids,
    youth: t.youth,
    adults: t.adults,
  });
  const discLabel = event.disciplines
    .map((d) => DISCIPLINE_LABELS[d as Discipline] || d)
    .filter(Boolean)
    .join(" · ");
  const levelLabel = RACE_LEVEL_LABELS[event.level as RaceLevel] || event.level;
  const mapHref = eventMapPath(locale, event);
  const enterUrl = event.registrationUrl || event.websiteUrl || event.listingUrl;
  const enterLabel = event.registrationUrl
    ? t.register
    : event.websiteUrl
      ? t.openWebsite
      : event.listingUrl
        ? t.calendarListing
        : null;
  const from = disciplineColor(event.disciplines);
  const to = disciplineColorDark(event.disciplines);

  return (
    <main className="relative min-h-[100dvh] bg-background">
      <EventJsonLd event={event} locale={locale} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(42vh,22rem)] opacity-90"
        style={{
          background: `radial-gradient(120% 80% at 10% -10%, ${from}33 0%, transparent 55%), linear-gradient(180deg, ${to}14 0%, transparent 70%)`,
        }}
      />

      <div className="relative mx-auto max-w-2xl px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6 sm:pb-16 sm:pt-12">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/${locale}`}>
            <ArrowLeft data-icon="inline-start" />
            {SITE_NAME}
          </Link>
        </Button>

        <header className="mt-5 scroll-mt-24 sm:mt-6">
          <p className="font-mono text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            {SITE_NAME}
          </p>
          <h1 className="mt-2 text-balance text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-4xl sm:leading-tight">
            {event.name}
          </h1>
          <p className="mt-3 text-[15px] text-muted-foreground sm:text-base">
            <time className="tabular" dateTime={event.startDate}>
              {dateLabel}
            </time>
          </p>
          <p className="mt-1 break-words text-[15px] text-muted-foreground sm:text-base">{place}</p>
        </header>

        <Card className="mt-7 gap-0 py-0 sm:mt-8">
          <CardContent className="px-0">
            <dl className="divide-y">
              <FactRow label={t.audience}>{whoLabel || t.whoUnknown}</FactRow>
              <FactRow label={t.formatLabel}>{discLabel || t.formatUnknown}</FactRow>
              <FactRow label={t.levelFilter}>{levelLabel}</FactRow>
              {event.series ? (
                <FactRow label={t.seriesFilter}>
                  <Button asChild variant="link" className="h-auto min-h-11 px-0 sm:min-h-0">
                    <Link href={`/${locale}?series=${event.series.slug}`}>{event.series.name}</Link>
                  </Button>
                </FactRow>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <div className="mt-8 hidden flex-wrap gap-3 sm:flex">
          <Button asChild size="lg">
            <Link href={mapHref}>
              <MapPinned data-icon="inline-start" />
              {t.viewOnMap}
            </Link>
          </Button>
          {enterUrl && enterLabel ? (
            <OutboundTrackLink
              href={enterUrl}
              eventName="outbound_enter"
              eventProps={{
                slug: event.slug,
                kind: event.registrationUrl ? "register" : "website",
              }}
            >
              <ExternalLink data-icon="inline-start" />
              {enterLabel}
            </OutboundTrackLink>
          ) : null}
          {event.regulationsUrl && event.regulationsUrl !== enterUrl ? (
            <OutboundTrackLink
              href={event.regulationsUrl}
              eventName="outbound_enter"
              eventProps={{ slug: event.slug, kind: "regulations" }}
            >
              <ExternalLink data-icon="inline-start" />
              {t.regulations}
            </OutboundTrackLink>
          ) : null}
        </div>

        <p className="mt-10 hidden text-sm text-muted-foreground sm:mt-12 sm:block">
          {t.tagline}
          <span className="mx-1.5" aria-hidden>
            ·
          </span>
          {t.madeBy}{" "}
          <a
            href={SITE_AUTHOR.url}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            {SITE_AUTHOR.name}
          </a>
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          <Button asChild size="lg" className="w-full">
            <Link href={mapHref}>
              <MapPinned data-icon="inline-start" />
              {t.viewOnMap}
            </Link>
          </Button>
          {enterUrl && enterLabel ? (
            <OutboundTrackLink
              href={enterUrl}
              eventName="outbound_enter"
              eventProps={{
                slug: event.slug,
                kind: event.registrationUrl ? "register" : "website",
              }}
              className="w-full"
            >
              <ExternalLink data-icon="inline-start" />
              {enterLabel}
            </OutboundTrackLink>
          ) : (
            <p className="text-center text-sm text-muted-foreground">{t.noOnlineEntry}</p>
          )}
          {event.regulationsUrl && event.regulationsUrl !== enterUrl ? (
            <Button asChild variant="link">
              <a href={event.regulationsUrl} target="_blank" rel="noopener noreferrer">
                {t.regulations}
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:gap-4">
      <dt className="shrink-0 font-mono text-[10px] font-semibold tracking-wide text-muted-foreground uppercase sm:w-28 sm:pt-0.5">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-[15px] leading-snug sm:text-sm">{children}</dd>
    </div>
  );
}
