"use client";

import { format, parseISO } from "date-fns";
import { Calendar, ChartNoAxesColumnIncreasing, MapPin, Trophy, UserRound } from "lucide-react";
import type { DetailLink } from "@/components/explore/event-detail-model";
import { ExplainedBadge } from "@/components/explore/explained-badge";
import { MetaRow } from "@/components/explore/meta-row";
import { CardSection, RaceMoreDetails, type CardLink } from "@/components/explore/race-more-details";
import { RaceWeather, windyLabel, windyUrl } from "@/components/race/race-weather";
import { RaceActions } from "@/components/race/race-actions";
import { Button } from "@/components/ui/button";
import type { EventListItem } from "@/lib/events";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { localePath } from "@/lib/localized-paths";
import { daysUntilLabel } from "@/lib/race-countdown";
import { cn } from "@/lib/utils";

/**
 * The race on a phone, in the order it is read: when and where and what kind
 * of racing — one line each, under the name — then the way in, then the rest.
 *
 * What you can do with the race is a row of equal tiles — directions, save,
 * share, the full page — the shape a maps app gives a place. The way in (the
 * registration or the organiser's page) leads the list of links further down,
 * with the organiser's other pages, rather than being a button of its own.
 *
 * The desktop's floating card is the same body (`variant="card"`), with the
 * same tiles — the full page among them — and the weather and the series'
 * page join the facts. Under them both
 * comes the rest of what the race page knows, as it arrives.
 */
export function EmbeddedBody({
  event,
  locale,
  placeLabel,
  directionsUrl,
  primary,
  secondaryLinks,
  whoChips,
  ageHintFor,
  levelLabel,
  levelHelp,
  discChips,
  onSelectSeries,
  trackEnter,
  trustText,
  trustLow,
  checkedText,
  showOnMap = false,
  variant = "sheet",
}: {
  variant?: "sheet" | "card";
  /** Opened from the list or the calendar: a tile takes the race to the map. */
  showOnMap?: boolean;
  event: EventListItem;
  locale: string;
  placeLabel: string;
  directionsUrl: string | null;
  primary: DetailLink | null;
  secondaryLinks: DetailLink[];
  whoChips: string[];
  ageHintFor: (label: string) => string;
  levelLabel: string;
  levelHelp: string;
  discChips: string[];
  onSelectSeries?: (slug: string) => void;
  trackEnter: (kind: string) => void;
  trustText: string | null;
  trustLow: boolean;
  checkedText: string | null;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const onMap = showOnMap && event.location?.lat != null && event.location?.lng != null;
  // The map with this race open; the map flies to a race it is opened with.
  const mapHref = `${localePath(locale)}?e=${encodeURIComponent(event.slug)}`;
  const dateLabel =
    format(parseISO(event.startDate), "EEE d. MMMM yyyy", { locale: df }) +
    (event.endDate && event.endDate !== event.startDate
      ? ` – ${format(parseISO(event.endDate), "d. MMMM", { locale: df })}`
      : "");
  const card = variant === "card";
  const countdown = event.status === "cancelled" ? null : daysUntilLabel(event.startDate, locale);
  // The place itself on Google Maps (the Navigate button plans the drive).
  const lat = event.location?.lat;
  const lng = event.location?.lng;
  const placeQuery = lat != null && lng != null ? `${lat},${lng}` : placeLabel.trim();
  const placeUrl = placeQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery)}` : null;
  // The forecast sits with the facts on the desktop card; the phone keeps it
  // for the race page, where it has room for the hour-by-hour chart.
  const weatherAt =
    card &&
    event.location?.lat != null &&
    event.location.lng != null &&
    event.status !== "cancelled" &&
    (event.endDate ?? event.startDate) >= new Date().toISOString().slice(0, 10)
      ? { lat: event.location.lat, lng: event.location.lng }
      : null;
  // Every way off the card, one list, one look: the organiser's pages, the
  // series' page, the forecast.
  const links: CardLink[] = [
    // The way in leads the list: the registration, else the organiser's page.
    ...(primary ? [{ ...primary, external: true }] : []),
    ...secondaryLinks.map((link) => ({ ...link, external: true })),
    ...(event.series
      ? [{ href: localePath(locale, `series/${event.series.slug}`), label: event.series.name, kind: "series", external: false }]
      : []),
    ...(weatherAt ? [{ href: windyUrl(weatherAt.lat, weatherAt.lng), label: windyLabel(locale), kind: "weather", external: true }] : []),
  ];
  return (
    <div className="flex flex-col">
      {/* When and where, then what you can do with it. */}
      <div className="-mx-4 -mt-3 flex flex-col gap-4 px-4 pt-4 pb-5">
      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Calendar className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0">
            <time className="tabular-nums first-letter:uppercase" dateTime={event.startDate}>
              {dateLabel}
            </time>
            {countdown ? (
              <span className="font-normal text-brand" suppressHydrationWarning>
                <span aria-hidden> · </span>
                {countdown}
              </span>
            ) : null}
          </span>
        </p>
        <p className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 break-words">
            {placeUrl ? (
              <a
                href={placeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-4 hover:underline"
                onClick={() => trackEnter("place")}
              >
                {placeLabel}
              </a>
            ) : (
              <span>{placeLabel || "—"}</span>
            )}
            {discChips.length > 0 ? (
              <span className="text-muted-foreground">
                <span aria-hidden> · </span>
                <span className="sr-only">{t.formatLabel}: </span>
                {discChips.join(", ")}
              </span>
            ) : null}
          </span>
        </p>
      </div>

      <RaceActions
        event={event}
        locale={locale}
        layout="tiles"
        location="race_panel"
        show={["directions", "plan", "share", "map", "detail"]}
        primary={primary}
        directionsUrl={directionsUrl}
        mapHref={onMap ? mapHref : ""}
        carryFilters
      />
      </div>

      {/* Who it is for and what kind of race it is. */}
      <CardSection className="flex flex-col gap-2.5 py-5">
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
        <MetaRow icon={<ChartNoAxesColumnIncreasing />} label={t.levelFilter}>
          <ExplainedBadge explanation={levelHelp}>{levelLabel}</ExplainedBadge>
        </MetaRow>
        {event.series ? (
          <MetaRow icon={<Trophy />} label={t.seriesFilter}>
            {onSelectSeries ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                title={event.series.name}
                className="max-w-full min-w-0 shrink justify-start overflow-hidden"
                onClick={() => onSelectSeries(event.series!.slug)}
              >
                <span className="truncate">{event.series.name}</span>
              </Button>
            ) : (
              <span className="min-w-0 truncate text-sm">{event.series.name}</span>
            )}
          </MetaRow>
        ) : null}
        {weatherAt ? (
          <RaceWeather key={event.id} lat={weatherAt.lat} lng={weatherAt.lng} date={event.startDate} locale={locale} hideLink />
        ) : null}
      </CardSection>

      <RaceMoreDetails event={event} locale={locale} links={links} onLink={trackEnter} />

      {trustText || checkedText ? (
        <CardSection className="pt-5">
        <p
          className={cn("text-xs leading-snug", trustLow ? "text-destructive" : "text-muted-foreground")}
          title={t.trustExplanation}
        >
          {trustText}
          {checkedText ? (
            <>
              {trustText ? <span aria-hidden> · </span> : null}
              <time className="tabular-nums" dateTime={event.lastSeenAt ?? undefined}>
                {checkedText}
              </time>
            </>
          ) : null}
        </p>
        </CardSection>
      ) : null}
    </div>
  );
}
