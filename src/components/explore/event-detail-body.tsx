"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowUpRight, Bike, Calendar, ChartNoAxesColumnIncreasing, ExternalLink, MapPin, Navigation, Trophy, UserRound } from "lucide-react";
import Link from "next/link";
import type { DetailLink } from "@/components/explore/event-detail-model";
import { ExplainedBadge } from "@/components/explore/explained-badge";
import { MetaRow } from "@/components/explore/meta-row";
import { RaceWeather } from "@/components/race/race-weather";
import { ExplainedHint } from "@/components/explore/explained-badge";
import { currentSeriesRound, roundOf, type RoundPosition, type SeriesRound } from "@/lib/series-rounds";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import type { EventListItem } from "@/lib/events";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { localePath } from "@/lib/localized-paths";

/** The card on the map: date and place, who it is for, what kind of racing, and the way in. */
export function EventDetailBody({
  event,
  locale,
  placeLabel,
  directionsUrl,
  whoChips,
  ageHintFor,
  levelLabel,
  levelHelp,
  discChips,
  actionLinks,
  onSelectSeries,
  trackEnter,
}: {
  event: EventListItem;
  locale: string;
  placeLabel: string;
  directionsUrl: string | null;
  whoChips: string[];
  ageHintFor: (label: string) => string;
  levelLabel: string;
  levelHelp: string;
  discChips: string[];
  actionLinks: DetailLink[];
  onSelectSeries?: (slug: string) => void;
  trackEnter: (kind: string) => void;
}) {
  const t = messagesFor(locale);
  const round = useSeriesRound(event);
  const seriesHint = event.series
    ? [event.series.name, round ? (round.of == null ? (ROUND[locale] ?? ROUND.en) : (ROUND_OF[locale] ?? ROUND_OF.en)).replace("{n}", String(round.n)).replace("{of}", String(round.of ?? "")) : null].filter(Boolean).join(" · ")
    : "";
  return (
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
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer" title={t.directionsHelp} onClick={() => trackEnter("directions")}>
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
              {/* The tag narrows to the series; the arrow opens its page. */}
              <div className="flex max-w-full min-w-0 items-center gap-1">
                <ExplainedHint explanation={seriesHint} className="flex min-w-0 max-w-full cursor-default">
                {onSelectSeries ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
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
                      className="min-w-0"
                    >
                      <span className="truncate">{event.series.name}</span>
                    </Link>
                  </Button>
                )}
                </ExplainedHint>
                <Button asChild variant="outline" size="icon-xs" className="shrink-0">
                  <Link
                    href={localePath(locale, `series/${event.series.slug}`)}
                    aria-label={`${t.seriesFilter}: ${event.series.name}`}
                    title={event.series.name}
                  >
                    <ArrowUpRight />
                  </Link>
                </Button>
              </div>
            </MetaRow>
          ) : null}
          {event.location?.lat != null && event.location.lng != null && event.status !== "cancelled" &&
          (event.endDate ?? event.startDate) >= new Date().toISOString().slice(0, 10) ? (
            <RaceWeather key={event.id} lat={event.location.lat} lng={event.location.lng} date={event.startDate} locale={locale} />
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
  );
}

const ROUND: Record<string, string> = { cs: "{n}. kolo", sk: "{n}. kolo", pl: "Runda {n}", de: "Lauf {n}", en: "Round {n}" };
const ROUND_OF: Record<string, string> = { cs: "{n}. kolo · {of} v kalendáři", sk: "{n}. kolo · {of} v kalendári", pl: "Runda {n} · {of} w kalendarzu", de: "Lauf {n} · {of} im Kalender", en: "Round {n} · {of} listed" };

function useSeriesRound(event: EventListItem) {
  const [result, setResult] = useState<{ key: string; value: RoundPosition | null } | null>(null);
  const slug = event.series?.slug;
  const key = `${event.id}:${slug ?? ""}`;
  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    fetch(`/api/series/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() as Promise<{ events: SeriesRound[] }> : null)
      .then(data => { if (!controller.signal.aborted && data) setResult({ key, value: roundOf(event.id, data.events) }); })
      .catch(() => {});
    return () => controller.abort();
  }, [slug, event.id, key]);
  return currentSeriesRound(result, key);
}
