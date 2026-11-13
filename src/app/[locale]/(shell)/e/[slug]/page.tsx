import type { Metadata } from "next";
import { getRaceEditionLinks } from "@/lib/race-editions";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { BadgeCheck, Bike, CalendarHeart, ChartNoAxesColumnIncreasing, Trophy, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ExplainedBadge } from "@/components/explore/explained-badge";
import { MetaRow } from "@/components/explore/meta-row";
import { findRacesForMissingSlug, getPublicEventBySlug, getSeriesBySlug, hostOfUrl, listOrganiserRaces, type EventListItem } from "@/lib/events";
import { pickNearbyRaces } from "@/lib/nearby-races";
import { upcomingCatalogue } from "@/lib/upcoming-catalogue";
import { RaceWeather, RaceWeatherSection } from "@/components/race/race-weather";
import { categoryDetail, distinctCategories } from "@/lib/category-detail";
import { roundOf } from "@/lib/series-rounds";
import { raceHolidays } from "@/lib/holidays";
import { birthYears } from "@/lib/birth-years";
import { organizerCopy } from "@/lib/i18n/organizer-copy";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";
import { AGE_CATEGORIES, UCI_CLASS_LABELS, type UciClass, formatEventCategoryLabel } from "@/lib/taxonomy";
import { ageCategoryHelp, ageCategoryLabel, disciplineLabel, raceLevelLabel, uciClassHelp } from "@/lib/i18n/taxonomy";
import { absoluteUrl, brandedTitle, fillCopy, hubCopy, localeAlternates, raceOgImagePath, SITE_NAME, socialCard } from "@/lib/seo";
import { hubPath, localePath } from "@/lib/localized-paths";
import { fill, raceCopy, raceDescription, raceSummary, raceTitle, routeSummary, unshout } from "@/lib/seo-race-copy";
import { RaceLinkList } from "@/components/seo/race-link-list";
import { BrowseHeader } from "@/components/browse/browse-ui";
import { disciplineColor } from "@/lib/map-visuals";
import { browseCrumbs, browsePlace } from "@/lib/browse-trail";
import { disciplineLeaves as disciplineLeavesOf, isHubDiscipline, listQualifyingHubs, type HubDiscipline } from "@/lib/discipline-hubs";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { countryDisplayName, isListedCountry } from "@/lib/geo/europe";
import { EventJsonLd } from "@/components/seo/event-json-ld";
import { PracticalRaceFacts } from "@/components/race/practical-race-facts";
import { RaceLinkRows, type RaceLink } from "@/components/race/race-link-rows";
import { DOCUMENT_KINDS } from "@/lib/race-fact-copy";
import { RacePageView } from "@/components/analytics/race-page-view";
import { Button } from "@/components/ui/button";
import { eventMapPath } from "@/lib/event-url";
import { RaceDetailMap } from "@/components/race/race-detail-map";
import { RaceActions } from "@/components/race/race-actions";
import { googleDirectionsUrl } from "@/components/explore/event-detail-model";
import { eventTrustLevel, lastCheckedLabel, trustLabel } from "@/lib/trust";
import { RaceSkeleton } from "./race-skeleton";
import { racePlace } from "@/lib/race-place";

/**
 * Held on the CDN for a week. A cancelled race or new entry link still lands
 * after an admin edit (`refreshPublicCatalogue`); watch polls alone must not
 * rewrite every detail page or Hobby Origin Transfer / ISR writes blow up.
 */
export const revalidate = 604800;

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
  const oc = organizerCopy[locale];
  const today = new Date().toISOString().slice(0, 10);
  const isPast = (event.endDate ?? event.startDate) < today;
  const place =
    [racePlace(event), event.location?.countryCode]
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
  const mapHref = eventMapPath(locale, event, { upcoming: true });
  const trustText = trustLabel(eventTrustLevel(event), t);
  const checkedText = lastCheckedLabel(event.lastSeenAt, locale, t.trustChecked);
  // Only markets that actually have a hub page — linking to a 404 is worse than
  // not linking.
  const rawCountry = event.location?.countryCode ?? null;
  const hubCountry = rawCountry && isListedCountry(rawCountry) ? rawCountry : null;
  const countryName = hubCountry ? countryDisplayName(hubCountry, locale) : null;
  const whoChips = whoLabel ? whoLabel.split(" · ").filter(Boolean) : [];
  // The ages a chip stands for, by its label: "Junior" → "17–18 let".
  const categoryOf = (label: string) => AGE_CATEGORIES.find((c) => ageCategoryLabel(c, locale) === label);
  // Birth years only where the categories are the organiser's, this year or last.
  const showYears = event.ageConfidence === "explicit" || event.ageConfidence === "previous";
  const yearsFor = (label: string) => {
    const id = categoryOf(label);
    return id && showYears ? birthYears(id, event.startDate, event.disciplines, locale) : null;
  };
  const ageHintFor = (label: string) => {
    const id = categoryOf(label);
    if (!id) return "";
    const years = yearsFor(label);
    return [ageCategoryHelp(id, locale), years ? fill(rc.bornIn, { years }) : null].filter(Boolean).join(" · ");
  };
  const discChips = event.disciplines.slice(0, 4).map((d) => disciplineLabel(d, locale)).filter(Boolean);
  // The organiser's own page first, then the entry form and the other pages.
  const actionLinks = [
    event.websiteUrl && event.websiteUrl !== event.registrationUrl ? { href: event.websiteUrl, label: rc.website, kind: "website" } : null,
    event.registrationUrl ? { href: event.registrationUrl, label: t.register, kind: "register" } : null,
    event.regulationsUrl ? { href: event.regulationsUrl, label: rc.regulations, kind: "regulations" } : null,
    event.resultsUrl ? { href: event.resultsUrl, label: t.results, kind: "results" } : null,
    !event.registrationUrl && !event.websiteUrl && event.listingUrl ? { href: event.listingUrl, label: t.calendarListing, kind: "listing" } : null,
  ].filter((l): l is { href: string; label: string; kind: string } => Boolean(l))
    .filter((l, i, all) => all.findIndex((x) => x.href === l.href) === i);
  // The first is the big button; the rest, with the regulations' other
  // documents, are the list of links under it.
  const documentNames = DOCUMENT_KINDS[locale];
  const pageLinks: RaceLink[] = [
    ...actionLinks.map((l) => ({ ...l, external: true })),
    ...(event.practicalDetails?.documents?.value ?? [])
      .filter((doc) => !actionLinks.some((l) => l.href === doc.url))
      .map((doc) => ({ href: doc.url, label: documentNames[doc.kind], kind: doc.kind, external: true })),
  ].filter((l, i, all) => all.findIndex((x) => x.href === l.href) === i);

  // What links this page into the rest of the site: its series' other rounds,
  // similar races nearby, and the hub for its kind of racing.
  const here = event.location;
  const [seriesData, hubs, around, editions, organiserRaces, holidays] = await Promise.all([
    event.series ? getSeriesBySlug(event.series.slug).catch(() => null) : Promise.resolve(null),
    hubCountry ? listQualifyingHubs([hubCountry]).catch(() => []) : Promise.resolve([]),
    // A race already run still points on to the next ones like it.
    here?.lat != null && here.lng != null
      ? upcomingCatalogue().catch(() => [])
      : Promise.resolve([]),
    getRaceEditionLinks(event).catch((error: unknown) => {
      console.error("race_edition_links_failed", event.slug, error);
      return { previous: [], next: [] };
    }),
    listOrganiserRaces(event).catch(() => []),
    isPast
      ? Promise.resolve([] as string[])
      : raceHolidays({ startDate: event.startDate, endDate: event.endDate, countryCode: event.location?.countryCode ?? null }, locale).catch(() => []),
  ]);
  const nearby = pickNearbyRaces(event, around, today);
  const categories = distinctCategories(event.categories ?? []);
  const summary = routeSummary(event, locale);
  // One row per website: a calendar we read several pages of is one source,
  // shown under the most trustworthy kind it was read as.
  const sources = [...(event.sources ?? [])]
    .sort((a, b) => SOURCE_ORDER.indexOf(a.kind) - SOURCE_ORDER.indexOf(b.kind))
    .filter((s, i, all) => all.findIndex((o) => hostOf(o.url) === hostOf(s.url)) === i);
  const otherRounds = (seriesData?.events ?? []).filter((e) => e.id !== event.id);
  // Which round of its season this race is, counted over the rounds we list.
  const round = seriesData ? roundOf(event.id, [...otherRounds, event]) : null;
  const upcomingRounds = otherRounds.filter((e) => e.startDate >= today);
  const rounds = (upcomingRounds.length ? upcomingRounds : otherRounds).slice(0, 12);
  const hub = hubs.find((h) => event.disciplines.some((d) => isHubDiscipline(h.discipline) && disciplineMatches(h.discipline, d)));

  return (
    <article className="relative min-h-full bg-background" data-race-revision={event.publicRevision ?? undefined} data-race-id={event.id}>
      {event.status === "cancelled" && (
        <p role="status" className="mx-auto max-w-5xl px-4 py-4 font-semibold text-destructive">
          {{ cs: "Tento závod je zrušený.", en: "This race is cancelled.", sk: "Tieto preteky sú zrušené.", pl: "Ten wyścig został odwołany.", de: "Dieses Rennen wurde abgesagt." }[locale]}
        </p>
      )}
      <RacePageView raceId={event.id} slug={event.slug} hasRegistration={Boolean(event.registrationUrl)} hasPrimaryOutbound={Boolean(event.registrationUrl || event.websiteUrl || event.listingUrl || event.regulationsUrl)} isPast={isPast} />
      <EventJsonLd
        event={event}
        locale={locale}
        description={event.description?.trim() || raceSummary(event, locale).join(" ")}
        breadcrumb={[
          { name: SITE_NAME, path: "" },
          ...(hubCountry && countryName ? [{ name: countryName, path: hubPath(locale, hubCountry) }] : []),
          ...(hubCountry && hub ? [{ name: disciplineLabelForHub(locale, hub.discipline), path: hubPath(locale, hubCountry, hub.discipline) }] : []),
          { name: event.name, path: `e/${event.slug}` },
        ]}
      />

      <BrowseHeader
        locale={locale}
        crumbs={[
          ...browseCrumbs(locale, browsePlace([event])),
          ...(event.series ? [{ label: event.series.name, href: localePath(locale, `series/${event.series.slug}`) }] : []),
          { label: event.name },
        ]}
      />
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
            {/* Same casing as the page title: a name the source wrote in capitals is not shouted. */}
            {unshout(event.name)}
          </h1>
          <p className="mt-2 text-sm leading-relaxed">
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
        <div className="mt-5 flex flex-col gap-2.5">
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
                    {yearsFor(chip) ? <span className="ml-1 font-normal tabular-nums text-muted-foreground">{yearsFor(chip)}</span> : null}
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
              <ExplainedBadge explanation={uciClassHelp(event.uciClass, locale)}>UCI {UCI_CLASS_LABELS[event.uciClass as UciClass] ?? event.uciClass.toUpperCase()}</ExplainedBadge>
            ) : null}
          </MetaRow>
          {event.series ? (
            <MetaRow icon={<Trophy />} label={t.seriesFilter}>
              <Button asChild variant="outline" size="xs" className="max-w-full min-w-0 shrink justify-start overflow-hidden">
                <Link href={localePath(locale, `series/${event.series.slug}`)} title={event.series.name} className="min-w-0">
                  <span className="truncate">{event.series.name}</span>
                  {/* The round inside the pill, as the categories carry their birth years. */}
                  {round ? (
                    <span className="ml-1 shrink-0 font-normal tabular-nums text-muted-foreground">{fill(round.of == null ? rc.round : rc.roundOf, { n: String(round.n), of: String(round.of ?? "") })}</span>
                  ) : null}
                </Link>
              </Button>
            </MetaRow>
          ) : null}
          {!isPast && event.status !== "cancelled" && here?.lat != null && here.lng != null ? (
            <RaceWeather lat={here.lat} lng={here.lng} date={event.startDate} locale={locale} />
          ) : null}
          {holidays.length > 0 ? (
            // Public holiday, long weekend, summer holidays: what the date means for a family.
            <MetaRow icon={<CalendarHeart />} label={holidays.join(", ")}>
              <span className="text-sm">{holidays.join(" · ")}</span>
            </MetaRow>
          ) : null}
        </div>

        <RaceActions
          className="mt-5"
          event={event}
          locale={locale}
          layout="tiles"
          location="race_page"
          show={isPast ? ["directions", "share", "map"] : ["directions", "plan", "share", "map"]}
          primary={actionLinks[0] ?? null}
          directionsUrl={googleDirectionsUrl(here, "")}
          mapHref={mapHref}
        />
        {/* The organiser's other pages and documents: one list, the same rows as the map's race card. */}
        <RaceLinkRows
          links={pageLinks}
          analytics={{ raceId: event.id, slug: event.slug, location: "race_page", presentation: "page" }}
          className="mt-5 divide-y divide-border/60 overflow-hidden rounded-xl border"
        />
        <p className="mt-3 text-xs text-muted-foreground">
          {event.organizerVerified ? (
            // Ownership is not a claim that every displayed fact was checked.
            <span className="inline-flex items-center gap-1 font-medium text-foreground" title={oc.badgeHelp}>
              <BadgeCheck className="size-3.5 text-sky-600 dark:text-sky-400" aria-hidden />
              {oc.badge}
            </span>
          ) : (
            trustText
          )}
          {checkedText && event.lastSeenAt ? (
            <>
              <span aria-hidden> · </span>
              <time className="tabular-nums" dateTime={event.lastSeenAt}>
                {checkedText}
              </time>
            </>
          ) : null}
        </p>

        <PracticalRaceFacts event={event} locale={locale} />

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">{rc.about}</h2>
          {/* The race at a glance — routes and the youngest category — before the account of it. */}
          {summary.length ? <p className="mb-2 text-sm font-medium">{capitalizeFirst(summary.join(" · "))}</p> : null}
          {/* One paragraph: the sentences are one account of the race, not a list. */}
          <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
            {event.description?.trim() || raceSummary(event, locale).join(" ")}
          </p>
        </section>


        {categories.length > 0 ? (
          // The routes and classes as the organiser published them, each with
          // what its name does not already say — the distance, the ages.
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold">{t.sourceCategories}</h2>
            <ul className="divide-y divide-border/60 rounded-xl border px-4 text-sm">
              {categories.map((category) => {
                const detail = categoryDetail(category, locale);
                return (
                  <li key={category.id} className="flex min-w-0 items-baseline justify-between gap-3 py-3 leading-snug">
                    <span className="min-w-0 break-words font-medium">{category.name}</span>
                    {detail ? <span className="shrink-0 tabular-nums text-muted-foreground">{detail}</span> : null}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">{t.sourceCategoriesHelp}</p>
          </section>
        ) : null}

        <section className="mt-10">
          <RaceDetailMap events={[event]} locale={locale} href={mapHref} label={t.viewOnMap} />
        </section>

        {!isPast && event.status !== "cancelled" && here?.lat != null && here.lng != null ? (
          <RaceWeatherSection lat={here.lat} lng={here.lng} date={event.startDate} locale={locale} />
        ) : null}

        {event.series && rounds.length > 0 ? (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold">{fill(rc.otherRounds, { name: event.series.name })}</h2>
            <RaceLinkList events={rounds} locale={locale} groupByMonth={false} />
            <Button asChild variant="link" className="mt-1 px-0">
              <Link href={localePath(locale, `series/${event.series.slug}`)}>
                {fillCopy(hubCopy[locale].seriesTitle, { name: event.series.name })}
              </Link>
            </Button>
          </section>
        ) : null}



        {([{ id: "previous-editions", title: rc.previousEditions, rows: editions.previous }, { id: "next-editions", title: rc.nextEditions, rows: editions.next }]).filter(group => group.rows.length > 0).map(group => (
          <section key={group.id} className="mt-10" aria-labelledby={group.id}>
            <h2 id={group.id} className="mb-3 text-lg font-semibold">{group.title}</h2>
            {/* The same rows as the routes and sources lists: the name, then the date on the right. */}
            <ul className="divide-y divide-border/60 rounded-xl border px-4 text-sm">
              {group.rows.map(edition => (
                <li key={edition.id} className="flex min-w-0 items-baseline justify-between gap-3 py-3 leading-snug">
                  <Link href={localePath(locale, `e/${edition.slug}`)} className="min-w-0 truncate font-medium underline-offset-4 hover:underline">
                    {unshout(edition.name)}
                  </Link>
                  <time className="shrink-0 tabular-nums text-muted-foreground" dateTime={edition.start_date}>
                    {format(parseISO(edition.start_date), "PPP", { locale: df })}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {organiserRaces.length > 0 ? (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold">{rc.organiserRaces}</h2>
            <RaceLinkList events={organiserRaces} locale={locale} groupByMonth={false} />
            <p className="mt-2 text-xs text-muted-foreground">{fill(rc.organiserVia, { host: hostOfUrl(event.websiteUrl) ?? "" })}</p>
          </section>
        ) : null}

        {sources.length > 0 ? (
          // Where the race was read from: the organiser's own page first, then
          // federations, series and calendars. Links, not endorsements.
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold">{rc.sources}</h2>
            <ul className="divide-y divide-border/60 rounded-xl border px-4 text-sm">
              {sources.map((s) => (
                <li key={s.url} className="flex min-w-0 items-baseline justify-between gap-3 py-3 leading-snug">
                  <a href={s.url} target="_blank" rel="nofollow noopener noreferrer" className="min-w-0 truncate font-medium underline-offset-4 hover:underline">
                    {hostOf(s.url)}
                  </a>
                  <span className="shrink-0 text-muted-foreground">{rc.sourceKinds[s.kind] ?? rc.sourceKinds.other}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">{rc.sourcesHelp}</p>
          </section>
        ) : null}

      </div>

      {/* Other races, not this one: a grey band across the whole page says the
          race ends here, and the white rows on it are something else. */}
      {nearby.length > 0 ? (
        <section className="bg-muted/60 [&_.race-list]:bg-card">
          <div className="mx-auto max-w-3xl px-4 pt-10 pb-12 sm:px-6">
            <h2 className="mb-3 text-lg font-semibold">{rc.nearbySimilar}</h2>
            <RaceLinkList
              events={nearby.map((n) => n.event)}
              distances={new Map(nearby.map((n) => [n.event.id, n.km]))}
              locale={locale}
              groupByMonth={false}
            />
          </div>
        </section>
      ) : null}

    </article>
  );
}

/** A race's discipline belongs to a hub's family. */
/** The organiser's own word first, a calendar's last. */
const SOURCE_ORDER = ["official", "race", "national_federation", "uci", "series", "aggregator", "other"];

/** "www.inveloveritas.at" for a source's address, or the address itself if it will not parse. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function disciplineMatches(family: HubDiscipline, discipline: string): boolean {
  return (disciplineLeavesOf(family) as string[]).includes(discipline);
}

function disciplineLabelForHub(locale: Locale, family: HubDiscipline): string {
  return disciplineLabel(family, locale);
}

const capitalizeFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
