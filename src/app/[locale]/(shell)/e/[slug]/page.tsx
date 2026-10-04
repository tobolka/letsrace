import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ExternalLink, MapPinned } from "lucide-react";
import { getPublicEventBySlug, getSeriesBySlug } from "@/lib/events";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { formatEventCategoryLabel } from "@/lib/taxonomy";
import { ageBandHint, ageCategoryLabel, ageGroupHint, disciplineLabel, raceLevelLabel } from "@/lib/i18n/taxonomy";
import { disciplineColor, disciplineColorDark } from "@/lib/map-visuals";
import { absoluteUrl, eventSeoCopy, fillCopy, hubCopy, localeAlternates, SITE_NAME, socialCard } from "@/lib/seo";
import { disciplineWords, fill, longDate, raceCopy, raceDescription, raceSummary, raceTitle } from "@/lib/seo-race-copy";
import { RaceLinkList } from "@/components/seo/race-link-list";
import { BrowseHeader } from "@/components/browse/browse-ui";
import { browseCrumbs, browsePlace } from "@/lib/browse-trail";
import { disciplineLeaves as disciplineLeavesOf, isHubDiscipline, listQualifyingHubs, type HubDiscipline } from "@/lib/discipline-hubs";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { countryDisplayName, isListedCountry } from "@/lib/geo/europe";
import { EventJsonLd } from "@/components/seo/event-json-ld";
import { OutboundTrackLink } from "@/components/seo/outbound-track-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { eventMapPath } from "@/lib/event-url";
import { eventTrustLevel, lastCheckedLabel, trustLabel } from "@/lib/trust";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : defaultLocale) as Locale;
  const event = await getPublicEventBySlug(slug);
  const seo = eventSeoCopy[locale];
  if (!event) {
    return { title: seo.notFound, robots: { index: false, follow: false } };
  }

  // What someone types: the race, its year, the kind of racing and the town —
  // and a description that says what is on the page (classes, entry, rules).
  const title = raceTitle(event, locale);
  const description = raceDescription(event, locale);
  const url = absoluteUrl(`/${locale}/e/${event.slug}`);

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: localeAlternates(`e/${event.slug}`),
    },
    ...socialCard({
      title,
      description,
      url,
      localeKey: locale,
      imagePath: `/${locale}/e/${event.slug}/opengraph-image`,
      imageAlt: `${event.name} — ${SITE_NAME}`,
      imageSize: { width: 1200, height: 630 },
    }),
  };
}

export default async function EventPage({ params }: Props) {
  const { locale: raw, slug } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const event = await getPublicEventBySlug(slug);
  if (!event) notFound();
  if (event.slug !== slug) permanentRedirect(`/${locale}/e/${event.slug}`);

  const t = messages[locale];
  const rc = raceCopy[locale];
  const today = new Date().toISOString().slice(0, 10);
  const isPast = (event.endDate ?? event.startDate) < today;
  const place =
    [event.location?.municipality || event.location?.name, event.location?.countryCode]
      .filter(Boolean)
      .join(" · ") || "—";
  // In the reader's language: "sobota 26. září 2026", not "Saturday 26 September".
  const df = dateFnsLocale(locale);
  const dateLabel =
    format(parseISO(event.startDate), "EEEE PPP", { locale: df }) +
    (event.endDate && event.endDate !== event.startDate
      ? ` – ${format(parseISO(event.endDate), "PPP", { locale: df })}`
      : "");
  const whoLabel = formatEventCategoryLabel(
    event,
    { kids: t.kids, youth: t.youth, adults: t.adults },
    (id) => ageCategoryLabel(id, locale),
  );
  const discLabel = disciplineWords(event, locale);
  const levelLabel = event.level ? raceLevelLabel(event.level, locale) : null;
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
  const trustText = trustLabel(eventTrustLevel(event), t);
  const checkedText = lastCheckedLabel(event.lastSeenAt, locale, t.trustChecked);
  // Only markets that actually have a hub page — linking to a 404 is worse than
  // not linking.
  const rawCountry = event.location?.countryCode ?? null;
  const hubCountry = rawCountry && isListedCountry(rawCountry) ? rawCountry : null;
  const countryName = hubCountry ? countryDisplayName(hubCountry, locale) : null;
  const closes = event.registrationClosesAt?.slice(0, 10) ?? null;
  const statedClasses = event.ageConfidence === "explicit" ? event.ageCategories : [];

  // What links this page into the rest of the site: its series' other rounds,
  // races the same weekend nearby, and the hub for its kind of racing.
  const [seriesData, hubs] = await Promise.all([
    event.series ? getSeriesBySlug(event.series.slug).catch(() => null) : Promise.resolve(null),
    hubCountry ? listQualifyingHubs([hubCountry]).catch(() => []) : Promise.resolve([]),
  ]);
  const otherRounds = (seriesData?.events ?? []).filter((e) => e.id !== event.id);
  const upcomingRounds = otherRounds.filter((e) => e.startDate >= today);
  const rounds = (upcomingRounds.length ? upcomingRounds : otherRounds).slice(0, 12);
  const hub = hubs.find((h) => event.disciplines.some((d) => isHubDiscipline(h.discipline) && disciplineMatches(h.discipline, d)));

  return (
    <main className="relative min-h-full bg-background">
      <EventJsonLd
        event={event}
        locale={locale}
        description={raceSummary(event, locale).join(" ")}
        breadcrumb={[
          { name: SITE_NAME, path: "" },
          ...(hubCountry && countryName ? [{ name: countryName, path: `c/${hubCountry.toLowerCase()}` }] : []),
          ...(hubCountry && hub ? [{ name: disciplineLabelForHub(locale, hub.discipline), path: `c/${hubCountry.toLowerCase()}/${hub.discipline}` }] : []),
          { name: event.name, path: `e/${event.slug}` },
        ]}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(42vh,22rem)] opacity-90"
        style={{
          background: `radial-gradient(120% 80% at 10% -10%, ${from}33 0%, transparent 55%), linear-gradient(180deg, ${to}14 0%, transparent 70%)`,
        }}
      />

      <div className="relative">
        <BrowseHeader
          locale={locale}
          crumbs={[
            ...browseCrumbs(locale, browsePlace([event])),
            ...(event.series ? [{ label: event.series.name, href: `/${locale}/series/${event.series.slug}` }] : []),
            { label: event.name },
          ]}
        />
      </div>
      <div className="relative mx-auto max-w-3xl px-4 pb-8 pt-4 sm:px-6 sm:pb-16">
        <header className="scroll-mt-24">
          <h1 className="mt-2 text-balance text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-4xl sm:leading-tight">
            {event.name}
          </h1>
          <p className="mt-3 text-[15px] text-muted-foreground sm:text-base">
            <time className="tabular" dateTime={event.startDate}>
              {dateLabel}
            </time>
          </p>
          <p className="mt-1 break-words text-[15px] text-muted-foreground sm:text-base">{place}</p>
          {isPast ? <p className="mt-3 text-sm font-medium">{rc.taken}</p> : null}
        </header>

        <Card className="mt-7 gap-0 py-0 sm:mt-8">
          <CardContent className="px-0">
            <dl className="divide-y">
              <FactRow label={t.audience}>{whoLabel || t.whoUnknown}</FactRow>
              <FactRow label={t.formatLabel}>{discLabel || t.formatUnknown}</FactRow>
              <FactRow label={t.levelFilter}>
                {[levelLabel, event.uciClass ? `UCI ${event.uciClass}` : null].filter(Boolean).join(" · ")}
              </FactRow>
              {event.series ? (
                <FactRow label={t.seriesFilter}>
                  <Button asChild variant="link" className="h-auto min-h-11 px-0 sm:min-h-0">
                    <Link href={`/${locale}/series/${event.series.slug}`}>{event.series.name}</Link>
                  </Button>
                </FactRow>
              ) : null}
              {event.registrationUrl ? (
                <FactRow label={rc.entry}>
                  <a href={event.registrationUrl} target="_blank" rel="noopener" className="underline underline-offset-4">
                    {closes ? fill(closes >= today ? rc.entryCloses : rc.entryClosed, { date: longDate(closes, locale) }) : t.register}
                  </a>
                </FactRow>
              ) : null}
              {event.regulationsUrl ? (
                <FactRow label={rc.regulations}>
                  <a href={event.regulationsUrl} target="_blank" rel="noopener" className="underline underline-offset-4">
                    {rc.regulations}
                  </a>
                </FactRow>
              ) : null}
              {event.websiteUrl && event.websiteUrl !== event.registrationUrl ? (
                <FactRow label={rc.website}>
                  <a href={event.websiteUrl} target="_blank" rel="noopener" className="break-all underline underline-offset-4">
                    {hostOf(event.websiteUrl)}
                  </a>
                </FactRow>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <p className="mt-3 text-sm text-muted-foreground">
          {trustText}
          {checkedText && event.lastSeenAt ? (
            <>
              <span aria-hidden> · </span>
              <time className="tabular-nums" dateTime={event.lastSeenAt}>
                {checkedText}
              </time>
            </>
          ) : null}
        </p>

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
          {event.resultsUrl &&
          event.resultsUrl !== enterUrl &&
          event.resultsUrl !== event.regulationsUrl ? (
            <OutboundTrackLink
              href={event.resultsUrl}
              eventName="outbound_enter"
              eventProps={{ slug: event.slug, kind: "results" }}
            >
              <ExternalLink data-icon="inline-start" />
              {t.results}
            </OutboundTrackLink>
          ) : null}
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">{rc.about}</h2>
          <div className="mt-2 flex flex-col gap-2 text-pretty text-[15px] leading-relaxed text-muted-foreground">
            {raceSummary(event, locale).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </section>

        {statedClasses.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">{rc.classes}</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {statedClasses.map((a) => (
                <li key={a} className="rounded-md border px-2.5 py-1 text-sm">
                  {ageCategoryLabel(a, locale)}
                  {ageBandHint(a, locale) || ageGroupHint(a, locale) ? (
                    <span className="ml-1.5 text-muted-foreground">{ageBandHint(a, locale) || ageGroupHint(a, locale)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {event.series && rounds.length > 0 ? (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold">{fill(rc.otherRounds, { name: event.series.name })}</h2>
            <RaceLinkList events={rounds} locale={locale} groupByMonth={false} />
            <Button asChild variant="link" className="mt-1 px-0">
              <Link href={`/${locale}/series/${event.series.slug}`}>
                {fillCopy(hubCopy[locale].seriesTitle, { name: event.series.name })}
              </Link>
            </Button>
          </section>
        ) : null}

      </div>

      <div className="sticky bottom-0 z-30 border-t bg-card/95 px-4 pb-3 pt-3 backdrop-blur sm:hidden">
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
        </div>
      </div>
    </main>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** A race's discipline belongs to a hub's family. */
function disciplineMatches(family: HubDiscipline, discipline: string): boolean {
  return (disciplineLeavesOf(family) as string[]).includes(discipline);
}

function disciplineLabelForHub(locale: Locale, family: HubDiscipline): string {
  return disciplineLabel(family, locale);
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
