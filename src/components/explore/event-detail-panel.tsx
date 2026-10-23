"use client";

import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  X,
  MapPin,
  Navigation,
  Trophy,
  Calendar,
  Bike,
  ExternalLink,
  Share,
  UserRound,
  ChartNoAxesColumnIncreasing,
  Maximize2,
  ChevronUp,
  Check,
} from "lucide-react";
import type { EventListItem } from "@/lib/events";
import { messagesFor } from "@/lib/i18n/messages";
import {
  RACE_LEVEL_LABELS,
  AGE_CATEGORIES,
  UCI_CLASS_LABELS,
  formatEventCategoryLabel,
  type RaceLevel,
  type UciClass,
} from "@/lib/taxonomy";
import { disciplineColor } from "@/lib/map-visuals";
import { ExplainedBadge } from "@/components/explore/explained-badge";
import { Badge } from "@/components/ui/badge";
import { MetaRow } from "@/components/explore/meta-row";
import { Button } from "@/components/ui/button";
import { SaveRaceButton } from "@/components/race/save-race-button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { track } from "@vercel/analytics";
import { cn } from "@/lib/utils";
import { DEFAULT_CARD_X, useDraggableCard } from "@/components/explore/use-draggable-card";
import { eventTrustLevel, lastCheckedLabel, trustLabel } from "@/lib/trust";
import { eventMapPath, eventPagePath } from "@/lib/event-url";
import { ageCategoryHelp, ageCategoryLabel, disciplineLabel, raceLevelLabel, uciClassHelp } from "@/lib/i18n/taxonomy";
import { dateFnsLocale } from "@/lib/i18n/dates";


export function EventDetailPanel({
  event,
  onClose,
  locale,
  onSelectSeries,
  embedded = false,
  onExpand,
  anchored = false,
  dockRight = false,
  dockTop = 64,
  leftX = DEFAULT_CARD_X,
}: {
  event: EventListItem;
  onClose: () => void;
  locale: string;
  onSelectSeries?: (slug: string) => void;
  /** Flat layout inside the mobile bottom sheet (no outer card chrome). */
  embedded?: boolean;
  /** The sheet is at its preview height: a button beside the cross raises it. */
  onExpand?: () => void;
  /**
   * The map's card, held by something else — a popover over a calendar day.
   * Same header, close button and footer, but it neither drags nor places
   * itself: whatever holds it decides where it goes.
   */
  anchored?: boolean;
  /** Full-width list mode: sit in the strip reserved at the right edge. */
  dockRight?: boolean;
  /** How far down a right-docked card starts — below whatever header is there. */
  dockTop?: number;
  /** Where the card starts when it sits beside the panel. */
  leftX?: number;
}) {
  const t = messagesFor(locale);
  const [linkCopied, setLinkCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  const { cardRef, offset, dragging, headerProps } = useDraggableCard({
    eventId: event.id,
    embedded,
    anchored,
    dockRight,
    dockTop,
    leftX,
  });
  useEffect(() => {
    return () => {
      if (copyTimerRef.current != null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const levelKey = (event.level || "local") as RaceLevel;
  const levelLabel =
    (event.uciClass
      ? UCI_CLASS_LABELS[event.uciClass as UciClass] || event.uciClass.toUpperCase()
      : null) ||
    (event.classLabel && event.classLabel !== RACE_LEVEL_LABELS[levelKey] ? event.classLabel : raceLevelLabel(levelKey, locale));
  const whoLabel = formatEventCategoryLabel(
    event,
    { kids: t.kids, youth: t.youth, adults: t.adults },
    (id) => ageCategoryLabel(id, locale),
  );
  const whoChips = whoLabel ? whoLabel.split(" · ").filter(Boolean) : [];
  // The ages a chip stands for, by its label: "Junior" → "17–18 let".
  const ageHintFor = (label: string) => {
    const id = AGE_CATEGORIES.find((c) => ageCategoryLabel(c, locale) === label);
    return id ? ageCategoryHelp(id, locale) : "";
  };
  const levelHelp = event.uciClass ? uciClassHelp(event.uciClass, locale) : "";
  const discChips = event.disciplines
    .slice(0, 4)
    .map((d) => disciplineLabel(d, locale))
    .filter(Boolean);

  const registerUrl = event.registrationUrl;
  const websiteUrl = event.websiteUrl;
  const listingUrl =
    event.listingUrl &&
    event.listingUrl !== websiteUrl &&
    event.listingUrl !== registerUrl
      ? event.listingUrl
      : null;
  const primaryEnter = registerUrl || websiteUrl || listingUrl;
  const primaryEnterLabel = registerUrl
    ? t.register
    : websiteUrl
      ? t.openWebsite
      : listingUrl
        ? t.calendarListing
        : null;

  const sharePath = eventMapPath(locale, event);

  async function copyShareLink() {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}${sharePath}` : sharePath;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: event.name, url });
        track("share_native", { slug: event.slug });
        return;
      }
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      track("share_link", { slug: event.slug });
      if (copyTimerRef.current != null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      /* user cancelled share or clipboard blocked */
    }
  }

  function trackEnter(kind: string) {
    track("outbound_enter", { slug: event.slug, kind });
  }

  const extraLinks: { href: string; label: string; kind: string }[] = [];
  if (registerUrl && websiteUrl && websiteUrl !== registerUrl) {
    extraLinks.push({ href: websiteUrl, label: t.openWebsite, kind: "website" });
  }
  if (
    event.regulationsUrl &&
    event.regulationsUrl !== registerUrl &&
    event.regulationsUrl !== websiteUrl &&
    event.regulationsUrl !== listingUrl
  ) {
    extraLinks.push({
      href: event.regulationsUrl,
      label: t.regulations,
      kind: "regulations",
    });
  }
  if (
    event.resultsUrl &&
    event.resultsUrl !== registerUrl &&
    event.resultsUrl !== websiteUrl &&
    event.resultsUrl !== listingUrl &&
    event.resultsUrl !== event.regulationsUrl
  ) {
    extraLinks.push({
      href: event.resultsUrl,
      label: t.results,
      kind: "results",
    });
  }

  const trust = eventTrustLevel(event);
  const trustText = trustLabel(trust, t);
  const checkedText = lastCheckedLabel(event.lastSeenAt, locale, t.trustChecked);
  const placeLabel = [
    event.location?.municipality || event.location?.name,
    event.location?.countryCode,
  ]
    .filter(Boolean)
    .join(" · ");
  const directionsUrl = googleDirectionsUrl(event.location, placeLabel);

  const primaryHref = primaryEnter || event.regulationsUrl;
  const primaryLabel = primaryEnterLabel ?? (event.regulationsUrl ? t.regulations : null);
  const primaryKind = registerUrl
    ? "register"
    : websiteUrl
      ? "website"
      : listingUrl
        ? "listing"
        : "regulations";
  const secondaryLinks = extraLinks.filter((link) => link.href !== primaryHref);
  const actionLinks = [
    ...(primaryHref && primaryLabel
      ? [{ href: primaryHref, label: primaryLabel, kind: primaryKind }]
      : []),
    ...secondaryLinks,
  ];

  // Registration / website already have their own buttons — repeating
  // "Registration link available" in the footer just cluttered the card.
  const showTrustLabel = trust === "calendar" || trust === "low";
  const trustRow = (
    <div className="flex w-full min-w-0 items-center gap-2 px-1" title={t.trustExplanation}>
      <p className="sr-only" aria-live="polite">
        {linkCopied ? t.linkCopied : ""}
      </p>
      <p
        className={cn(
          "min-w-0 flex-1 truncate text-xs leading-snug",
          trust === "low" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {showTrustLabel ? trustText : null}
        {checkedText && event.lastSeenAt ? (
          <>
            {showTrustLabel ? <span aria-hidden> · </span> : null}
            <time className="tabular-nums" dateTime={event.lastSeenAt}>
              {checkedText}
            </time>
          </>
        ) : null}
      </p>
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        {/* The card is the short version; the race's own page has all of it. */}
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="size-9 [@media(pointer:coarse)]:size-11"
          tooltip={t.openRaceDetail}
        >
          <Link
            href={eventPagePath(locale, event.slug)}
            aria-label={t.openRaceDetail}
            onClick={() => track("open_race_page", { slug: event.slug })}
          >
            <Maximize2 />
          </Link>
        </Button>
        <SaveRaceButton
          eventId={event.id}
          raceName={event.name}
          locale={locale}
          className="size-9 [@media(pointer:coarse)]:size-11"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              pressed={linkCopied}
              size="lg"
              aria-label={linkCopied ? t.linkCopied : t.shareRace}
              className="size-9 min-w-9 [@media(pointer:coarse)]:size-11 [@media(pointer:coarse)]:min-w-11 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              onPressedChange={() => {
                if (!linkCopied) void copyShareLink();
              }}
            >
              <Share />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>{linkCopied ? t.linkCopied : t.shareRace}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );

  return (
    <Card
      ref={cardRef}
      aria-labelledby="race-detail-title"
      className={cn(
        // overflow-x-hidden: long series chips / nowrap buttons used to force a
        // horizontal scrollbar while the card was dragged around the map.
        "pointer-events-auto w-full max-w-[min(320px,calc(100vw-1.5rem))] gap-0 overflow-x-hidden overflow-y-hidden py-0",
        dragging && "select-none",
        embedded
          ? "flex h-full min-h-0 max-w-none flex-col border-0 shadow-none"
          : anchored
            ? "flex w-[320px] max-h-[min(72dvh,36rem)] flex-col border-0 shadow-none"
            : "absolute z-40 w-[320px] max-h-[calc(100dvh-1.5rem)] shadow-lg",
      )}
      style={embedded || anchored ? undefined : { left: offset.x, top: offset.y }}
    >
      <CardHeader
        /*
         * A flex row, centred, not the card's default grid. That grid always lays out
         * two rows and lets the close button span both, so the button centred
         * across a header the title only ever filled the top half of — which
         * is why the name sat visibly above the cross next to it.
         *
         * twMerge drops `grid` for `flex` but keeps grid-rows / grid-cols
         * leftovers; clear them so CardAction's col-start cannot fight the row.
         */
        className={cn(
          "flex shrink-0 flex-row items-center gap-2 border-b px-4 py-3 [.border-b]:pb-3",
          "grid-cols-none grid-rows-none",
          embedded && "px-4 pt-0 pb-2 [.border-b]:pb-2",
          !embedded && !anchored && "cursor-grab touch-none select-none",
          dragging && "cursor-grabbing",
        )}
        {...headerProps}
      >
        <CardTitle
          id="race-detail-title"
          className={cn(
            "flex min-w-0 flex-1 items-stretch gap-2.5 leading-snug",
            embedded ? "text-[17px] font-semibold" : "text-base",
          )}
        >
          {/* The same rule the list card wears, so a race looks like itself
              whether you are reading it in the list or in the panel — but
              stretched, because this is the one place the whole name is
              spelled out and it can run to two lines. */}
          <span
            aria-hidden
            className="my-0.5 w-[3px] shrink-0 self-stretch rounded-full"
            style={{ background: disciplineColor(event.disciplines) }}
          />
          {/* Whole on a phone: the sheet is the one place the name is spelled
              out, and a list row has already cut it short. */}
          <span
            className={cn(
              "min-w-0 flex-1 break-words",
              !embedded && "[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden",
            )}
          >
            {event.name}
          </span>
        </CardTitle>
        {/* Negative margins keep the close target from setting the title row's height. */}
        <CardAction className="col-auto row-auto -my-2 -mr-2 ml-auto flex shrink-0 items-center self-center justify-self-auto">
          {onExpand ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={onExpand}
              aria-label={t.raceExpand}
            >
              <ChevronUp />
            </Button>
          ) : null}
          {/* On a phone the cross is the way out that does not depend on a
              gesture, so it gets a whole thumb's worth of target. */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={embedded ? "size-11" : undefined}
            onClick={onClose}
            aria-label={t.close}
          >
            <X />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent
        /*
         * Tighter on a phone. The sheet is half a small screen, and at desktop
         * spacing four facts and a chip row filled all of it — you had to drag
         * the sheet up to find out whether a race had an entry link.
         */
        className={cn(
          "min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4",
          embedded
            ? "px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "py-3",
        )}
        inert={dragging || undefined}
      >
        {embedded ? (
          <EmbeddedBody
            event={event}
            locale={locale}
            placeLabel={placeLabel}
            directionsUrl={directionsUrl}
            primary={primaryHref && primaryLabel ? { href: primaryHref, label: primaryLabel, kind: primaryKind } : null}
            secondaryLinks={secondaryLinks}
            whoChips={whoChips}
            ageHintFor={ageHintFor}
            levelLabel={levelLabel}
            levelHelp={levelHelp}
            discChips={discChips}
            onSelectSeries={onSelectSeries}
            trackEnter={trackEnter}
            linkCopied={linkCopied}
            onShare={() => void copyShareLink()}
            trustText={showTrustLabel ? trustText : null}
            trustLow={trust === "low"}
            checkedText={checkedText && event.lastSeenAt ? checkedText : null}
          />
        ) : (
        <>
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-base font-medium">
            <Calendar className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <time className="tabular" dateTime={event.startDate}>
              {format(parseISO(event.startDate), "EEE d MMM yyyy", {
                locale: dateFnsLocale(locale),
              })}
              {event.endDate && event.endDate !== event.startDate
                ? ` – ${format(parseISO(event.endDate), "d MMM", { locale: dateFnsLocale(locale) })}`
                : ""}
            </time>
          </p>
          <p className="flex items-start gap-2 text-sm font-medium">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 break-words">{placeLabel || "—"}</span>
            {directionsUrl ? (
              // The question asked most often of a race: how long to get
              // there. Google Maps starts from where you are standing and
              // plans the route itself, so this is one tap to the answer.
              <Button asChild variant="outline" size="xs" className="-my-0.5 shrink-0 font-normal">
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer" title={t.directionsHelp}>
                  <Navigation data-icon="inline-start" />
                  {t.directions}
                </a>
              </Button>
            ) : null}
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
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
                {/* Our guess from the level or discipline, not the organiser's
                    list — said so, rather than shown as fact. */}
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
                <Button
                  asChild
                  variant="outline"
                  size="xs"
                  className="max-w-full min-w-0 shrink justify-start overflow-hidden"
                >
                  <Link
                    href={`/${locale}?series=${event.series.slug}`}
                    title={event.series.name}
                    className="min-w-0"
                  >
                    <span className="truncate">{event.series.name}</span>
                  </Link>
                </Button>
              )}
            </MetaRow>
          ) : null}
        </div>


        {actionLinks.length > 0 ? (
          <ButtonGroup orientation="vertical" className="mt-4 w-full min-w-0 max-w-full">
            {actionLinks.map((link, index) => (
              <Button
                key={link.href}
                asChild
                variant={index === 0 ? "default" : "outline"}
                className="w-full min-w-0 max-w-full shrink"
              >
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEnter(link.kind)}
                  className="min-w-0"
                >
                  <ExternalLink data-icon="inline-start" />
                  <span className="truncate">{link.label}</span>
                </a>
              </Button>
            ))}
          </ButtonGroup>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{t.noOnlineEntry}</p>
        )}
        </>
        )}
      </CardContent>

      {embedded ? null : (
        <CardFooter
          className="shrink-0 justify-between gap-2 border-t px-2 py-2 [.border-t]:pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-2"
          inert={dragging || undefined}
        >
          {trustRow}
        </CardFooter>
      )}

    </Card>
  );
}

/**
 * Google Maps directions to a race, from wherever the person is. Without an
 * origin Maps asks for the current location itself — on a phone and in a
 * browser alike — and plans the drive; the coordinates are the race's own,
 * the place's name only when there are none.
 */
export function googleDirectionsUrl(
  location: { lat: number | null; lng: number | null } | null | undefined,
  placeLabel: string,
): string | null {
  const destination =
    location?.lat != null && location?.lng != null
      ? `${location.lat},${location.lng}`
      : placeLabel.trim()
        ? placeLabel.trim()
        : null;
  if (!destination) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

/**
 * The race on a phone, in the order it is read: when and where and what kind
 * of racing — one line each, under the name — then the way in, then the rest.
 *
 * The way in is one wide button of its own. Everything else you can do with
 * the race sits under it as a row of equal tiles — directions, save, share,
 * the full page — the shape a maps app gives a place, so four small things
 * are not crowded against the one big one. The organiser's other pages are
 * rows of a list at the foot, not more buttons in the pile.
 */
function EmbeddedBody({
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
}: {
  event: EventListItem;
  locale: string;
  placeLabel: string;
  directionsUrl: string | null;
  primary: { href: string; label: string; kind: string } | null;
  secondaryLinks: { href: string; label: string; kind: string }[];
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
  const dateLabel =
    format(parseISO(event.startDate), "EEE d. MMMM yyyy", { locale: df }) +
    (event.endDate && event.endDate !== event.startDate
      ? ` – ${format(parseISO(event.endDate), "d. MMMM", { locale: df })}`
      : "");
  const tile =
    "flex h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-muted/70 px-1 text-xs font-medium text-foreground touch-manipulation transition-colors active:bg-muted disabled:opacity-60 [&_svg]:size-5 [&>span]:max-w-full [&>span]:truncate";

  return (
    <div className="flex flex-col gap-3">
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

      <div className="grid grid-cols-4 gap-2">
        {directionsUrl ? (
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer" title={t.directionsHelp} className={tile}>
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
          {linkCopied ? <Check aria-hidden /> : <Share aria-hidden />}
          <span>{linkCopied ? t.linkCopied : t.actionShare}</span>
        </button>
        <Link
          href={eventPagePath(locale, event.slug)}
          aria-label={t.openRaceDetail}
          onClick={() => track("open_race_page", { slug: event.slug })}
          className={tile}
        >
          <Maximize2 aria-hidden />
          <span>{t.actionDetail}</span>
        </Link>
        <p className="sr-only" aria-live="polite">
          {linkCopied ? t.linkCopied : ""}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
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
      </div>

      {secondaryLinks.length > 0 ? (
        <ul className="-mx-4 border-y">
          {secondaryLinks.map((link) => (
            <li key={link.href} className="border-b last:border-b-0">
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEnter(link.kind)}
                className="flex h-12 items-center justify-between gap-3 px-4 text-sm font-medium transition-colors active:bg-accent"
              >
                <span className="truncate">{link.label}</span>
                <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {trustText || checkedText ? (
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
      ) : null}
    </div>
  );
}
