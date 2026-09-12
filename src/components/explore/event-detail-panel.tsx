"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { format, parseISO } from "date-fns";
import {
  X,
  MapPin,
  Trophy,
  Calendar,
  Bike,
  ExternalLink,
  Share,
  UserRound,
  ChartNoAxesColumnIncreasing,
} from "lucide-react";
import type { EventListItem } from "@/lib/events";
import { messagesFor } from "@/lib/i18n/messages";
import {
  RACE_LEVEL_LABELS,
  UCI_CLASS_LABELS,
  formatEventCategoryLabel,
  type RaceLevel,
  type UciClass,
} from "@/lib/taxonomy";
import { disciplineColor } from "@/lib/map-visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Toggle } from "@/components/ui/toggle";
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
import { eventMapPath } from "@/lib/event-url";
import { disciplineLabel, raceLevelLabel } from "@/lib/i18n/taxonomy";
import { dateFnsLocale } from "@/lib/i18n/dates";


/** Must match the desktop list card in explore-shell (width + overlay padding + gap). */
const DEFAULT_X = 12 + 400 + 12;
const DEFAULT_Y = 12;
const DRAG_MARGIN = 12;

function clampPanelPos(x: number, y: number, el: HTMLElement | null) {
  const w = el?.offsetWidth ?? 320;
  const h = el?.offsetHeight ?? 200;
  const maxX = Math.max(DRAG_MARGIN, window.innerWidth - w - DRAG_MARGIN);
  const maxY = Math.max(DRAG_MARGIN, window.innerHeight - h - DRAG_MARGIN);
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
}: {
  event: EventListItem;
  onClose: () => void;
  locale: string;
  onSelectSeries?: (slug: string) => void;
  /** Flat layout inside the mobile bottom sheet (no outer card chrome). */
  embedded?: boolean;
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

  useEffect(() => {
    if (embedded) return;
    const onResize = () => {
      const next = clampPanelPos(offsetRef.current.x, offsetRef.current.y, cardRef.current);
      offsetRef.current = next;
      setOffset(next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [embedded]);

  function onHeaderPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (embedded || e.button !== 0) return;
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
  const whoLabel = formatEventCategoryLabel(event, {
    kids: t.kids,
    youth: t.youth,
    adults: t.adults,
  });
  const whoChips = whoLabel ? whoLabel.split(" · ").filter(Boolean) : [];
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

  const trustRow = (
    <div className="flex w-full items-center gap-2 px-1" title={t.trustExplanation}>
      <p className="sr-only" aria-live="polite">
        {linkCopied ? t.linkCopied : ""}
      </p>
      <p
        className={cn(
          "min-w-0 flex-1 text-xs leading-snug",
          trust === "low" ? "text-destructive" : "text-muted-foreground",
        )}
      >
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
      <div className="ml-auto flex items-center gap-0.5">
        <Toggle
          pressed={linkCopied}
          size="lg"
          aria-label={linkCopied ? t.linkCopied : t.shareRace}
          title={linkCopied ? t.linkCopied : t.shareRace}
          className="size-9 min-w-9 [@media(pointer:coarse)]:size-11 [@media(pointer:coarse)]:min-w-11 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          onPressedChange={() => {
            if (!linkCopied) void copyShareLink();
          }}
        >
          <Share />
        </Toggle>
      </div>
    </div>
  );

  return (
    <Card
      ref={cardRef}
      aria-labelledby="race-detail-title"
      className={cn(
        "pointer-events-auto w-full gap-0 overflow-hidden py-0",
        dragging && "select-none",
        embedded
          ? "flex h-full min-h-0 flex-col border-0 shadow-none"
          : "absolute z-10 w-[320px] max-h-[calc(100dvh-1.5rem)] shadow-lg",
      )}
      style={embedded ? undefined : { left: offset.x, top: offset.y }}
    >
      <CardHeader
        /*
         * A flex row, not the card's default grid. That grid always lays out
         * two rows and lets the close button span both, so the button centred
         * across a header the title only ever filled the top half of — which
         * is why the name sat visibly above the cross next to it.
         */
        className={cn(
          "flex shrink-0 flex-row items-center gap-2 border-b px-4 py-3 [.border-b]:pb-3",
          !embedded && "cursor-grab touch-none select-none",
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
            className="w-[3px] shrink-0 self-stretch rounded-full"
            style={{ background: disciplineColor(event.disciplines) }}
          />
          <span className="min-w-0">{event.name}</span>
        </CardTitle>
        <CardAction className="ml-auto self-center">
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
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4",
          embedded
            ? "py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "py-3",
        )}
        inert={dragging || undefined}
      >
        {/*
          On the phone the one button that matters comes first, under the
          name, where it is on screen at half height without a drag. It used
          to sit in a footer pinned below a scroll box, so the card scrolled
          inside itself and the button sat under the fold.
        */}
        {embedded && primaryHref && primaryLabel ? (
          <Button asChild size="lg" className="mb-4 h-12 w-full text-base">
            <a
              href={primaryHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEnter(primaryKind)}
            >
              <ExternalLink data-icon="inline-start" />
              {primaryLabel}
            </a>
          </Button>
        ) : null}
        <div className={cn("flex flex-col", embedded ? "gap-1" : "gap-2")}>
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
            <span className="min-w-0 break-words">{placeLabel || "—"}</span>
          </p>
        </div>

        <div className={cn("flex flex-col", embedded ? "mt-2.5 gap-1.5" : "mt-4 gap-2.5")}>
          <MetaRow icon={<UserRound />} label={t.audience}>
            {whoChips.length > 0 ? (
              whoChips.map((chip) => (
                <Badge key={chip} variant="outline">
                  {chip}
                </Badge>
              ))
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
            <Badge variant="outline">{levelLabel}</Badge>
          </MetaRow>
          {event.series ? (
            <MetaRow icon={<Trophy />} label={t.seriesFilter}>
              {onSelectSeries ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => onSelectSeries(event.series!.slug)}
                >
                  {event.series.name}
                </Button>
              ) : (
                <Button asChild variant="outline" size="xs">
                  <Link href={`/${locale}?series=${event.series.slug}`}>{event.series.name}</Link>
                </Button>
              )}
            </MetaRow>
          ) : null}
        </div>


        {actionLinks.length > 0 && !embedded ? (
          <ButtonGroup orientation="vertical" className={cn("w-full", embedded ? "mt-3" : "mt-4")}>
            {actionLinks.map((link, index) => (
              <Button
                key={link.href}
                asChild
                variant={index === 0 ? "default" : "outline"}
                className="w-full"
              >
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEnter(link.kind)}
                >
                  <ExternalLink data-icon="inline-start" />
                  {link.label}
                </a>
              </Button>
            ))}
          </ButtonGroup>
        ) : actionLinks.length === 0 ? (
          <p className={cn("text-sm text-muted-foreground", embedded ? "mt-3" : "mt-4")}>{t.noOnlineEntry}</p>
        ) : (
          <ButtonGroup orientation="vertical" className={cn("w-full", embedded ? "mt-3" : "mt-4")}>
            {secondaryLinks.map((link) => (
              <Button key={link.href} asChild variant="outline" className="w-full">
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEnter(link.kind)}
                >
                  <ExternalLink data-icon="inline-start" />
                  {link.label}
                </a>
              </Button>
            ))}
          </ButtonGroup>
        )}
        {embedded ? <div className="mt-4 border-t border-border pt-3">{trustRow}</div> : null}
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

function MetaRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-muted-foreground [&_svg]:size-4" aria-hidden>
        {icon}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <span className="sr-only">{label}</span>
        {children}
      </div>
    </div>
  );
}
