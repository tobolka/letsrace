import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Bike, ChartNoAxesColumnIncreasing, ExternalLink, MapPinned, Trophy, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ExplainedBadge } from "@/components/explore/explained-badge";
import { MetaRow } from "@/components/explore/meta-row";
import { findRacesForMissingSlug, getPublicEventBySlug, getSeriesBySlug, type EventListItem } from "@/lib/events";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { AGE_CATEGORIES, formatEventCategoryLabel } from "@/lib/taxonomy";
import { ageCategoryHelp, ageCategoryLabel, disciplineLabel, raceLevelLabel, uciClassHelp } from "@/lib/i18n/taxonomy";
import { absoluteUrl, brandedTitle, fillCopy, hubCopy, localeAlternates, raceOgImagePath, SITE_NAME, socialCard } from "@/lib/seo";
import { hubPath, localePath } from "@/lib/localized-paths";
import { fill, raceCopy, raceDescription, raceSummary, raceTitle } from "@/lib/seo-race-copy";
import { RaceLinkList } from "@/components/seo/race-link-list";
import { BrowseHeader } from "@/components/browse/browse-ui";
import { disciplineColor } from "@/lib/map-visuals";
import { browseCrumbs, browsePlace } from "@/lib/browse-trail";
import { disciplineLeaves as disciplineLeavesOf, isHubDiscipline, listQualifyingHubs, type HubDiscipline } from "@/lib/discipline-hubs";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { countryDisplayName, isListedCountry } from "@/lib/geo/europe";
import { EventJsonLd } from "@/components/seo/event-json-ld";
import { OutboundTrackLink } from "@/components/seo/outbound-track-link";
import { Button } from "@/components/ui/button";
import { eventMapPath } from "@/lib/event-url";
import { SaveRaceButton } from "@/components/race/save-race-button";
import { eventTrustLevel, lastCheckedLabel, trustLabel } from "@/lib/trust";
import { RaceSkeleton } from "./race-skeleton";

/**
 * The long-tail catalogue is rendered on demand. Persisting a full HTML/RSC
 * response for every race × language made crawler visits write thousands of
 * large ISR entries, even when each URL was requested only once.
 */
export const revalidate = 0;

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : defaultLocale) as Locale;
  const event = await getPublicEventBySlug(slug);
  if (!event) {
    // Same answer as the page: the edition that replaced it, or 404.
    const { match } = await findRacesForMissingSlug(slug).catch(() => ({ match: null }));
    if (match) permanentRedirect(localePath(locale, `e/${match.slug}`));
    notFound();
  }

  // What someone types: the race, its year, the kind of racing and the town —
  // and a description that says what is on the page (classes, entry, rules).
  const title = raceTitle(event, locale);
  const description = raceDescription(event, locale);
  const url = absoluteUrl(localePath(locale, `e/${event.slug}`));

  return {
    title: brandedTitle(title),
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
      imagePath: raceOgImagePath(locale, event.slug),
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
  if (!event) {
    // An old edition's address goes to the race that replaced it; anything
    // else is a real 404 — decided before the skeleton streams a 200.
    // `not-found.tsx` beside this page offers the races it may have meant.
    const { match } = await findRacesForMissingSlug(slug).catch(() => ({ match: null }));
    if (match) permanentRedirect(localePath(locale, `e/${match.slug}`));
    notFound();
  }
  if (event.slug !== slug) permanentRedirect(localePath(locale, `e/${event.slug}`));
  return (
    <Suspense fallback={<RaceSkeleton />}>
      <Race locale={locale} event={event} />
    </Suspense>
  );
}

async function Race({ locale, event }: { locale: Locale; event: EventListItem }) {
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
  const levelLabel = event.level ? raceLevelLabel(event.level, locale) : null;
  const mapHref = eventMapPath(locale, event);
  const trustText = trustLabel(eventTrustLevel(event), t);
  const checkedText = lastCheckedLabel(event.lastSeenAt, locale, t.trustChecked);
  // Only markets that actually have a hub page — linking to a 404 is worse than
  // not linking.
  const rawCountry = event.location?.countryCode ?? null;
  const hubCountry = rawCountry && isListedCountry(rawCountry) ? rawCountry : null;
  const countryName = hubCountry ? countryDisplayName(hubCountry, locale) : null;
  const whoChips = whoLabel ? whoLabel.split(" · ").filter(Boolean) : [];
  // The ages a chip stands for, by its label: "Junior" → "17–18 let".
  const ageHintFor = (label: string) => {
    const id = AGE_CATEGORIES.find((c) => ageCategoryLabel(c, locale) === label);
    return id ? ageCategoryHelp(id, locale) : "";
  };
  const discChips = event.disciplines.slice(0, 4).map((d) => disciplineLabel(d, locale)).filter(Boolean);
  // Entry first — it is what the page is for — then the organiser's own pages.
  const actionLinks = [
    event.registrationUrl ? { href: event.registrationUrl, label: t.register, kind: "register" } : null,
    event.websiteUrl && event.websiteUrl !== event.registrationUrl ? { href: event.websiteUrl, label: rc.website, kind: "website" } : null,
    event.regulationsUrl ? { href: event.regulationsUrl, label: rc.regulations, kind: "regulations" } : null,
    event.resultsUrl ? { href: event.resultsUrl, label: t.results, kind: "results" } : null,
    !event.registrationUrl && !event.websiteUrl && event.listingUrl ? { href: event.listingUrl, label: t.calendarListing, kind: "listing" } : null,
  ].filter((l): l is { href: string; label: string; kind: string } => Boolean(l))
    .filter((l, i, all) => all.findIndex((x) => x.href === l.href) === i);

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
          ...(hubCountry && countryName ? [{ name: countryName, path: hubPath(locale, hubCountry) }] : []),
          ...(hubCountry && hub ? [{ name: disciplineLabelForHub(locale, hub.discipline), path: hubPath(locale, hubCountry, hub.discipline) }] : []),
          { name: event.name, path: `e/${event.slug}` },
        ]}
      />

      <div className="relative">
        <BrowseHeader
          locale={locale}
          crumbs={[
            ...browseCrumbs(locale, browsePlace([event])),
            ...(event.series ? [{ label: event.series.name, href: localePath(locale, `series/${event.series.slug}`) }] : []),
            { label: event.name },
          ]}
        />
      </div>
      <div className="relative mx-auto max-w-3xl px-4 pb-12 pt-4 sm:px-6">
        {/* The list row's shape, larger: the discipline's colour down the
            edge, the name, then the date and where, what and which series.
            The edge hangs in the gutter so the name lines up with the trail
            and everything under it, as the browse pages' headings do. */}
        <header className="browse-intro relative scroll-mt-24">
          <span
            aria-hidden
            className="absolute bottom-1 top-5 -left-3 w-1 rounded-full sm:-left-4"
            style={{ background: disciplineColor(event.disciplines) }}
          />
          <h1 data-page-title className="text-balance text-3xl font-semibold leading-[1.12] tracking-[-0.045em] sm:text-[2.125rem]">
            {event.name}
          </h1>
          <p className="mt-3 text-sm">
            <time className="font-medium tabular-nums" dateTime={event.startDate}>
              {dateLabel}
            </time>
            <span className="text-muted-foreground">
              {" · "}
              {[place, discChips.join(", "), event.series?.name].filter(Boolean).join(" · ")}
            </span>
          </p>
          {isPast ? <p className="mt-2 text-sm font-medium">{rc.taken}</p> : null}
        </header>

        {/* The same rows and badges as the race card on the map. */}
        <div className="mt-6 flex flex-col gap-2.5">
          <MetaRow icon={<UserRound />} label={t.audience}>
            {whoChips.length > 0 ? (
              <>
                {whoChips.map((chip) => (
                  <ExplainedBadge
                    key={chip}
                    explanation={ageHintFor(chip)}
                    className={event.ageConfidence === "explicit" ? undefined : "border-dashed"}
                  >
                    {chip}
                  </ExplainedBadge>
                ))}
                {event.ageConfidence === "explicit" ? null : (
                  <span className="text-xs text-muted-foreground" title={t.ageUnconfirmedHelp}>
                    {event.ageConfidence === "previous" ? t.ageLastYear : t.ageGuessed}
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">{t.whoUnknown}</span>
            )}
          </MetaRow>
          <MetaRow icon={<Bike />} label={t.formatLabel}>
            {discChips.length > 0 ? (
              discChips.map((chip) => (
                <Badge key={chip} variant="outline">
                  {chip}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">{t.formatUnknown}</span>
            )}
          </MetaRow>
          <MetaRow icon={<ChartNoAxesColumnIncreasing />} label={t.levelFilter}>
            {levelLabel ? <Badge variant="outline">{levelLabel}</Badge> : null}
            {event.uciClass ? (
              <ExplainedBadge explanation={uciClassHelp(event.uciClass, locale)}>UCI {event.uciClass}</ExplainedBadge>
            ) : null}
          </MetaRow>
          {event.series ? (
            <MetaRow icon={<Trophy />} label={t.seriesFilter}>
              <Button asChild variant="outline" size="xs" className="max-w-full min-w-0 shrink justify-start overflow-hidden">
                <Link href={localePath(locale, `series/${event.series.slug}`)} title={event.series.name} className="min-w-0">
                  <span className="truncate">{event.series.name}</span>
                </Link>
              </Button>
            </MetaRow>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {actionLinks.map((link, index) => (
            <OutboundTrackLink
              key={link.href}
              href={link.href}
              eventName="outbound_enter"
              eventProps={{ slug: event.slug, kind: link.kind }}
              variant={index === 0 ? "default" : "outline"}
              size="default"
            >
              <ExternalLink data-icon="inline-start" />
              {link.label}
            </OutboundTrackLink>
          ))}
          {isPast ? null : <SaveRaceButton eventId={event.id} raceName={event.name} locale={locale} variant="full" />}
          <Button asChild variant="outline">
            <Link href={mapHref}>
              <MapPinned data-icon="inline-start" />
              {t.viewOnMap}
            </Link>
          </Button>
        </div>
        {actionLinks.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t.noOnlineEntry}</p> : null}
        <p className="mt-3 text-xs text-muted-foreground">
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

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">{rc.about}</h2>
          {/* One paragraph: the sentences are one account of the race, not a list. */}
          <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
            {raceSummary(event, locale).join(" ")}
          </p>
        </section>

        {event.series && rounds.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">{fill(rc.otherRounds, { name: event.series.name })}</h2>
            <RaceLinkList events={rounds} locale={locale} groupByMonth={false} />
            <Button asChild variant="link" className="mt-1 px-0">
              <Link href={localePath(locale, `series/${event.series.slug}`)}>
                {fillCopy(hubCopy[locale].seriesTitle, { name: event.series.name })}
              </Link>
            </Button>
          </section>
        ) : null}

      </div>

    </main>
  );
}

/** A race's discipline belongs to a hub's family. */
function disciplineMatches(family: HubDiscipline, discipline: string): boolean {
  return (disciplineLeavesOf(family) as string[]).includes(discipline);
}

function disciplineLabelForHub(locale: Locale, family: HubDiscipline): string {
  return disciplineLabel(family, locale);
}
