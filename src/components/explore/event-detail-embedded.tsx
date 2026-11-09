"use client";

import { format, parseISO } from "date-fns";
import { Calendar, ChartNoAxesColumnIncreasing, Check, ExternalLink, Map as MapIcon, MapPin, MapPinned, Maximize2, Navigation, Share, Trophy, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSwapClass } from "@/hooks/use-swap-class";
import { track } from "@/lib/analytics";
import { carryFilterQuery } from "@/lib/explore-params";
import type { DetailLink } from "@/components/explore/event-detail-model";
import { ExplainedBadge } from "@/components/explore/explained-badge";
import { MetaRow } from "@/components/explore/meta-row";
import { CardSection, RaceMoreDetails, type CardLink } from "@/components/explore/race-more-details";
import { RaceWeather, windyLabel, windyUrl } from "@/components/race/race-weather";
import { SaveRaceButton } from "@/components/race/save-race-button";
import { Button } from "@/components/ui/button";
import { eventPagePath } from "@/lib/event-url";
import type { EventListItem } from "@/lib/events";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { localePath } from "@/lib/localized-paths";
import { cn } from "@/lib/utils";

/**
 * The race on a phone, in the order it is read: when and where and what kind
 * of racing — one line each, under the name — then the way in, then the rest.
 *
 * The way in is one wide button of its own. Everything else you can do with
 * the race sits under it as a row of equal tiles — directions, save, share,
 * the full page — the shape a maps app gives a place, so four small things
 * are not crowded against the one big one. The organiser's other pages are
 * rows of a list at the foot, not more buttons in the pile.
 *
 * The desktop's floating card is the same body (`variant="card"`): there the
 * full page has a button of its own at the card's foot, so the tiles are
 * three, and the weather and the series' page join the facts. Under them both
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
  linkCopied,
  onShare,
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
  linkCopied: boolean;
  onShare: () => void;
  trustText: string | null;
  trustLow: boolean;
  checkedText: string | null;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const router = useRouter();
  const shareSwap = useSwapClass(linkCopied ? "copied" : "share");
  const onMap = showOnMap && event.location?.lat != null && event.location?.lng != null;
  // The map with this race open; the map flies to a race it is opened with.
  const mapHref = `${localePath(locale)}?e=${encodeURIComponent(event.slug)}`;
  const tileCount = 3 + (variant === "card" ? 0 : 1) + (onMap ? 1 : 0);
  const dateLabel =
    format(parseISO(event.startDate), "EEE d. MMMM yyyy", { locale: df }) +
    (event.endDate && event.endDate !== event.startDate
      ? ` – ${format(parseISO(event.endDate), "d. MMMM", { locale: df })}`
      : "");
  const card = variant === "card";
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
    ...secondaryLinks.map((link) => ({ ...link, external: true })),
    ...(event.series
      ? [{ href: localePath(locale, `series/${event.series.slug}`), label: event.series.name, kind: "series", external: false }]
      : []),
    ...(weatherAt ? [{ href: windyUrl(weatherAt.lat, weatherAt.lng), label: windyLabel(locale), kind: "weather", external: true }] : []),
  ];
  const tile =
    "flex h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-muted/70 px-1 text-xs font-medium text-foreground touch-manipulation transition-colors active:bg-muted disabled:opacity-60 [&_svg]:size-5 [&>span]:max-w-full [&>span]:truncate";

  return (
    <div className="flex flex-col">
      {/* When and where, the way in, and what else you can do with it. */}
      <div className="flex flex-col gap-3 pb-4">
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-base font-medium">
          <Calendar className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <time className="tabular-nums first-letter:uppercase" dateTime={event.startDate}>
            {dateLabel}
          </time>
        </p>
        <p className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 break-words">
            <span className="font-medium">{placeLabel || "—"}</span>
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

      {primary ? (
        <Button asChild size="lg" className="h-12 w-full text-base">
          <a href={primary.href} target="_blank" rel="noopener noreferrer" onClick={() => trackEnter(primary.kind)}>
            <ExternalLink data-icon="inline-start" />
            <span className="truncate">{primary.label}</span>
          </a>
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">{t.noOnlineEntry}</p>
      )}

      {card ? (
        // The desktop card's actions are the race page's buttons — the same
        // outline look and the same icon-then-label order.
        <div
          className={cn(
            "grid grid-cols-2 gap-2",
            // Four make an even grid; fewer lead with the plan across the width.
            (onMap ? 1 : 0) + (directionsUrl ? 1 : 0) < 2 && "[&>:first-child]:col-span-2 [&>:nth-child(even):last-child]:col-span-2",
          )}
        >
          <SaveRaceButton eventId={event.id} raceName={event.name} locale={locale} variant="full" className="w-full" />
          {onMap ? (
            <Button asChild variant="outline" className="w-full">
              <Link
                href={mapHref}
                onClick={(e) => {
                  track("cta_click", { slug: event.slug, location: "race_panel", source: "show_on_map" });
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  const carry = carryFilterQuery(new URLSearchParams(window.location.search));
                  if (!carry) return;
                  e.preventDefault();
                  router.push(`${localePath(locale)}${carry}&e=${encodeURIComponent(event.slug)}`);
                }}
              >
                <MapPinned data-icon="inline-start" />
                {t.viewOnMap}
              </Link>
            </Button>
          ) : null}
          {directionsUrl ? (
            <Button asChild variant="outline" className="w-full">
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer" title={t.directionsHelp} onClick={() => trackEnter("directions")}>
                <Navigation data-icon="inline-start" />
                {t.directions}
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            aria-label={linkCopied ? t.linkCopied : t.shareRace}
            onClick={(e) => {
              // The label stays put, so the row does not reflow; only the icon
              // says it worked (and the live region below says it aloud).
              e.currentTarget.blur();
              if (!linkCopied) onShare();
            }}
          >
            {linkCopied ? <Check data-icon="inline-start" /> : <Share data-icon="inline-start" />}
            {t.actionShare}
          </Button>
        </div>
      ) : (
      <div className={cn("grid gap-2", tileCount === 5 ? "grid-cols-5" : tileCount === 4 ? "grid-cols-4" : "grid-cols-3")}>
        {directionsUrl ? (
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer" title={t.directionsHelp} className={tile} onClick={() => trackEnter("directions")}>
            <Navigation aria-hidden />
            <span>{t.directions}</span>
          </a>
        ) : (
          <span aria-hidden className={cn(tile, "opacity-40")}>
            <Navigation />
            <span>{t.directions}</span>
          </span>
        )}
        <SaveRaceButton eventId={event.id} raceName={event.name} locale={locale} variant="tile" className={tile} />
        <button
          type="button"
          aria-label={linkCopied ? t.linkCopied : t.shareRace}
          aria-pressed={linkCopied}
          className={cn(tile, linkCopied && "bg-primary text-primary-foreground active:bg-primary")}
          onClick={() => {
            if (!linkCopied) onShare();
          }}
        >
          <span key={linkCopied ? "copied" : "share"} className={cn("inline-flex", shareSwap)}>
            {linkCopied ? <Check aria-hidden /> : <Share aria-hidden />}
          </span>
          <span>{linkCopied ? t.linkCopied : t.actionShare}</span>
        </button>
        {onMap ? (
          <Link
            href={mapHref}
            aria-label={t.showOnMap}
            title={t.showOnMap}
            onClick={(e) => {
              track("cta_click", { slug: event.slug, location: "race_panel", source: "show_on_map" });
              // The list's filters go along, so the map shows the same races
              // around this one. Read at the click, like the rail's links.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              const carry = carryFilterQuery(new URLSearchParams(window.location.search));
              if (!carry) return;
              e.preventDefault();
              router.push(`${localePath(locale)}${carry}&e=${encodeURIComponent(event.slug)}`);
            }}
            className={tile}
          >
            <MapIcon aria-hidden />
            <span>{t.navMap}</span>
          </Link>
        ) : null}
        {card ? null : (
          <Link
            href={eventPagePath(locale, event.slug)}
            aria-label={t.openRaceDetail}
            onClick={() => track("cta_click", { slug: event.slug, location: "race_panel", source: "full_detail" })}
            className={tile}
          >
            <Maximize2 aria-hidden />
            <span>{t.actionDetail}</span>
          </Link>
        )}
        <p className="sr-only" aria-live="polite">
          {linkCopied ? t.linkCopied : ""}
        </p>
      </div>
      )}
      </div>

      {/* Who it is for and what kind of race it is. */}
      <CardSection className="flex flex-col gap-2 py-3.5">
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
        <CardSection className="pt-3">
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
