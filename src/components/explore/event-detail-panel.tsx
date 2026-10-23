"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
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
import { eventTrustLevel, lastCheckedLabel, trustLabel } from "@/lib/trust";
import { eventMapPath, eventPagePath } from "@/lib/event-url";
import { ageCategoryHelp, ageCategoryLabel, disciplineLabel, raceLevelLabel, uciClassHelp } from "@/lib/i18n/taxonomy";
import { dateFnsLocale } from "@/lib/i18n/dates";


/** Must match the desktop list panel in explore-shell (width + gap). */
const DEFAULT_X = 400 + 12;
const DEFAULT_Y = 12;
const DRAG_MARGIN = 12;

/**
 * The room the card floats in — the map's own box, not the window. With a rail
 * down the left edge the map is narrower than the window, and a card placed by
 * window width sat under the map's right edge.
 */
function stageSize(el: HTMLElement | null) {
  const stage = el?.offsetParent as HTMLElement | null;
  return {
    w: stage?.clientWidth || window.innerWidth,
    h: stage?.clientHeight || window.innerHeight,
  };
}

function clampPanelPos(x: number, y: number, el: HTMLElement | null) {
  const w = el?.offsetWidth ?? 320;
  const h = el?.offsetHeight ?? 200;
  const stage = stageSize(el);
  const maxX = Math.max(DRAG_MARGIN, stage.w - w - DRAG_MARGIN);
  const maxY = Math.max(DRAG_MARGIN, stage.h - h - DRAG_MARGIN);
  return {
    x: Math.min(maxX, Math.max(DRAG_MARGIN, x)),
    y: Math.min(maxY, Math.max(DRAG_MARGIN, y)),
  };
}

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
  leftX = DEFAULT_X,
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
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const offsetRef = useRef({ x: DEFAULT_X, y: DEFAULT_Y });
  const [offset, setOffset] = useState({ x: DEFAULT_X, y: DEFAULT_Y });
  const [dragging, setDragging] = useState(false);
  const prevEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (embedded || anchored) return;
    // Docked: the list leaves a strip on the right, so start there. Undocked
    // returns to the default beside the 400px panel. Dragging still works.
    const x = dockRight ? Math.max(12, stageSize(cardRef.current).w - 320 - 12) : leftX;
    // Docked, it starts below the account button that floats top-right.
    const next = clampPanelPos(x, dockRight ? dockTop : DEFAULT_Y, cardRef.current);
    offsetRef.current = next;
    setOffset(next);
  }, [dockRight, dockTop, embedded, anchored, leftX]);

  useEffect(() => {
    if (embedded || anchored) return;
    const onResize = () => {
      const next = clampPanelPos(offsetRef.current.x, offsetRef.current.y, cardRef.current);
      offsetRef.current = next;
      setOffset(next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [embedded, anchored]);

  // Brief y-axis hop when the selected race changes — same card, new content.
  // Skip in the mobile sheet: Vaul already moved it, and a keyframe hop on
  // every pin tap fights the sheet and restarts from zero mid-browse.
  useEffect(() => {
    if (embedded || anchored) return;
    const el = cardRef.current;
    if (!el) return;
    if (prevEventIdRef.current === event.id) return;
    prevEventIdRef.current = event.id;
    if (dragging || dragRef.current) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    el.classList.remove("event-detail-jump");
    // Restart the keyframes even when the class was already applied.
    void el.offsetWidth;
    el.classList.add("event-detail-jump");
  }, [event.id, dragging, embedded, anchored]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onEnd = (e: AnimationEvent) => {
      if (e.animationName !== "event-detail-jump") return;
      el.classList.remove("event-detail-jump");
    };
    el.addEventListener("animationend", onEnd);
    return () => el.removeEventListener("animationend", onEnd);
  }, []);

  function onHeaderPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (embedded || anchored || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, a, input")) return;
    const pos = offsetRef.current;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    setDragging(true);
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    // Don't let a leftover jump transform fight the drag translate.
    cardRef.current?.classList.remove("event-detail-jump");
  }

  function onHeaderPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const next = clampPanelPos(
      drag.origX + (e.clientX - drag.startX),
      drag.origY + (e.clientY - drag.startY),
      cardRef.current,
    );
    const el = cardRef.current;
    if (el) el.style.transform = `translate(${next.x - drag.origX}px, ${next.y - drag.origY}px)`;
  }

  function endHeaderDrag(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const next = clampPanelPos(
      drag.origX + (e.clientX - drag.startX),
      drag.origY + (e.clientY - drag.startY),
      cardRef.current,
    );
    dragRef.current = null;
    offsetRef.current = next;
    setOffset(next);
    setDragging(false);
    const el = cardRef.current;
    if (el) el.style.transform = "";
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

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
          embedded && "px-3 pt-0 pb-2 [.border-b]:pb-2",
          !embedded && !anchored && "cursor-grab touch-none select-none",
          dragging && "cursor-grabbing",
        )}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endHeaderDrag}
        onPointerCancel={endHeaderDrag}
        onLostPointerCapture={endHeaderDrag}
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
            ? "px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
 * The desktop card spends a row on each fact. Here the discipline rides on
 * the place's line instead of a row of its own, saving, sharing and the
 * entry button share one row, and the race's own page is a link at the foot
 * rather than a third icon beside them — so at the preview's half height the
 * entry button is on screen without a drag.
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-base font-medium">
          <Calendar className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <time className="tabular-nums first-letter:uppercase" dateTime={event.startDate}>
            {dateLabel}
          </time>
        </p>
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 break-words">
            <span className="font-medium">{placeLabel || "—"}</span>
            {discChips.length > 0 ? (
              <span className="text-muted-foreground">
                <span aria-hidden> · </span>
                <span className="sr-only">{t.formatLabel}: </span>
                {discChips.join(", ")}
              </span>
            ) : null}
          </p>
          {directionsUrl ? (
            // The question asked most often of a race: how long to get there.
            <Button asChild variant="outline" size="sm" className="-my-1 h-9 shrink-0 font-normal">
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer" title={t.directionsHelp}>
                <Navigation data-icon="inline-start" />
                {t.directions}
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {primary ? (
          <Button asChild size="lg" className="h-11 min-w-0 flex-1 text-base">
            <a href={primary.href} target="_blank" rel="noopener noreferrer" onClick={() => trackEnter(primary.kind)}>
              <ExternalLink data-icon="inline-start" />
              <span className="truncate">{primary.label}</span>
            </a>
          </Button>
        ) : (
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">{t.noOnlineEntry}</p>
        )}
        <SaveRaceButton
          eventId={event.id}
          raceName={event.name}
          locale={locale}
          className="size-11 shrink-0 rounded-md border"
        />
        <Toggle
          pressed={linkCopied}
          size="lg"
          variant="outline"
          aria-label={linkCopied ? t.linkCopied : t.shareRace}
          className="size-11 min-w-11 shrink-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          onPressedChange={() => {
            if (!linkCopied) onShare();
          }}
        >
          <Share />
        </Toggle>
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
        <div className="flex flex-wrap gap-1.5">
          {secondaryLinks.map((link) => (
            <Button key={link.href} asChild variant="outline" size="sm" className="h-10 min-w-0 max-w-full">
              <a href={link.href} target="_blank" rel="noopener noreferrer" onClick={() => trackEnter(link.kind)}>
                <ExternalLink data-icon="inline-start" />
                <span className="truncate">{link.label}</span>
              </a>
            </Button>
          ))}
        </div>
      ) : null}

      <div className="flex min-w-0 items-center gap-2 border-t pt-2" title={t.trustExplanation}>
        <p className={cn("min-w-0 flex-1 truncate text-xs leading-snug", trustLow ? "text-destructive" : "text-muted-foreground")}>
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
        <Button asChild variant="ghost" size="sm" className="-mr-2 h-10 shrink-0 text-sm">
          <Link
            href={eventPagePath(locale, event.slug)}
            onClick={() => track("open_race_page", { slug: event.slug })}
          >
            <Maximize2 data-icon="inline-start" />
            {t.openRaceDetail}
          </Link>
        </Button>
      </div>
    </div>
  );
}
