"use client";

import { format, parseISO } from "date-fns";
import { Calendar, ChartNoAxesColumnIncreasing, Check, ExternalLink, MapPin, Maximize2, Navigation, Share, Trophy, UserRound } from "lucide-react";
import Link from "next/link";
import { track } from "@/lib/analytics";
import type { DetailLink } from "@/components/explore/event-detail-model";
import { ExplainedBadge } from "@/components/explore/explained-badge";
import { MetaRow } from "@/components/explore/meta-row";
import { SaveRaceButton } from "@/components/race/save-race-button";
import { Button } from "@/components/ui/button";
import { eventPagePath } from "@/lib/event-url";
import type { EventListItem } from "@/lib/events";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
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
}: {
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
          onClick={() => track("cta_click", { slug: event.slug, location: "race_panel", source: "full_detail" })}
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
