"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { FACT_ICONS, FactList, FactRow, type FactListRow } from "@/components/race/fact-row";
import { RaceLinkRows, type RaceLink } from "@/components/race/race-link-rows";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryDetail, distinctCategories } from "@/lib/category-detail";
import { eventPagePath } from "@/lib/event-url";
import type { EventListItem } from "@/lib/events";
import { asLocale, messagesFor } from "@/lib/i18n/messages";
import { DOCUMENT_KINDS, FACT_COPY } from "@/lib/race-fact-copy";
// Types only: the schemas behind them stay out of the card's download.
import type { PracticalDetails } from "@/lib/practical-details";

export type CardLink = RaceLink;

/** A group of the card, set off by a line from edge to edge. */
export function CardSection({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={`-mx-4 border-t px-4 ${className ?? ""}`}>{children}</section>;
}

/**
 * The lower half of the race card: every link in one list, then the rest of
 * what the race's own page knows — the timetable, the fees, the categories,
 * the routes, the venue, the organiser, parking and a few lines about the
 * race. The map's list rows carry none of the facts, so the card asks for the
 * whole race when it opens and fills them in when it arrives; nothing above
 * waits for it.
 *
 * Long lists are cut short. The card is for deciding whether to go; the race
 * page holds every row, laid out with the same rows (`FactRow`).
 */
export function RaceMoreDetails({
  event,
  locale,
  links = [],
  onLink,
}: {
  event: EventListItem;
  locale: string;
  /** The links the card already knows; the regulations' other documents join them. */
  links?: CardLink[];
  onLink?: (kind: string) => void;
}) {
  const full = useFullRace(event.slug);
  const t = messagesFor(locale);
  const kinds = DOCUMENT_KINDS[asLocale(locale)];

  // Documents the card's links do not already point to, next to the
  // organiser's other pages; the series and the forecast after them.
  const known = new Set([event.registrationUrl, event.websiteUrl, event.regulationsUrl, event.resultsUrl, event.listingUrl, ...links.map((l) => l.href)]);
  const documents: CardLink[] = (full?.practicalDetails?.documents?.value ?? [])
    .filter((doc) => !known.has(doc.url))
    .map((doc) => ({ href: doc.url, label: kinds[doc.kind], kind: doc.kind, external: true }));
  const ours = (link: CardLink) => link.kind === "series" || link.kind === "weather";
  const allLinks = [...links.filter((l) => !ours(l)), ...documents, ...links.filter(ours)];

  const linkSection = allLinks.length ? (
    <CardSection className="py-1">
      <RaceLinkRows links={allLinks} onLink={onLink} bleed />
    </CardSection>
  ) : null;

  if (full === undefined) {
    return (
      <>
        {linkSection}
        <CardSection className="py-4">
          <div className="flex flex-col gap-3" role="status" aria-label={t.raceMoreLoading}>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </CardSection>
      </>
    );
  }
  const rows = full ? raceFactRows(full, event, locale) : [];
  return (
    <>
      {linkSection}
      {rows.length ? (
        <CardSection className="py-1">
          {rows.map((row) => (
            <FactRow key={row.key} icon={row.icon} label={row.label}>
              {row.body}
            </FactRow>
          ))}
        </CardSection>
      ) : null}
    </>
  );
}

/** The facts the card shows, in the order the race page shows them. */
function raceFactRows(full: EventListItem, event: EventListItem, locale: string) {
  const t = messagesFor(locale);
  const c = FACT_COPY[asLocale(locale)];
  const facts: PracticalDetails = full.practicalDetails ?? {};
  const fullHref = eventPagePath(locale, event.slug);
  const more = (n: number) => (
    <Link href={fullHref} className="mt-1.5 inline-block text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">
      {c.more.replace("{n}", String(n))}
    </Link>
  );
  const date = (day: string) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  const multiDay = Boolean(event.endDate && event.endDate !== event.startDate);
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  const rows: { key: string; icon: ReactNode; label: string; body: ReactNode }[] = [];
  function list<T>(items: T[], toRow: (item: T, i: number) => FactListRow) {
    return (
      <>
        <FactList rows={items.slice(0, LIMIT).map(toRow)} />
        {items.length > LIMIT ? more(items.length - LIMIT) : null}
      </>
    );
  }

  if (facts.schedule) {
    rows.push({
      key: "schedule",
      icon: FACT_ICONS.schedule,
      label: c.schedule,
      body: list(facts.schedule.value, (item, i) => ({
        key: i,
        lead: `${multiDay ? `${date(item.date)} ` : ""}${item.approximate ? "≈ " : ""}${item.time.slice(0, 5)}${item.endTime ? `–${item.endTime}` : ""}`,
        label: item.label,
      })),
    });
  }
  if (facts.fees) {
    rows.push({
      key: "fees",
      icon: FACT_ICONS.fees,
      label: c.fees,
      body: list(facts.fees.value, (item, i) => ({
        key: i,
        label: item.label,
        value: <span className="font-medium text-foreground">{money(item.amount, item.currency)}</span>,
      })),
    });
  }
  // The organiser's own category list first; the categories read from a
  // calendar only when the regulations have not been read.
  const own = facts.categories?.value ?? [];
  const listed = own.length ? [] : distinctCategories(full.categories ?? []);
  if (own.length) {
    rows.push({
      key: "categories",
      icon: FACT_ICONS.categories,
      label: c.categories,
      body: list(own, (item, i) => ({ key: i, label: item.label, value: item.birthYears })),
    });
  } else if (listed.length) {
    rows.push({
      key: "categories",
      icon: FACT_ICONS.categories,
      label: c.categories,
      body: list(listed, (item) => ({ key: item.id, label: item.name, value: categoryDetail(item, asLocale(locale)) || undefined })),
    });
  }
  if (facts.routes) {
    rows.push({
      key: "routes",
      icon: FACT_ICONS.routes,
      label: c.routes,
      body: list(facts.routes.value, (item, i) => ({
        key: i,
        label: item.name,
        value:
          [
            item.distanceKm != null ? `${new Intl.NumberFormat(locale).format(item.distanceKm)} km` : null,
            item.elevationM != null ? `↗ ${new Intl.NumberFormat(locale).format(item.elevationM)} m` : null,
          ].filter(Boolean).join(" · ") || undefined,
      })),
    });
  }

  const venue = facts.venue?.value;
  const venueName = venue?.name || full.location?.venue;
  if (venueName) {
    const address = venue
      ? [venue.streetAddress, [venue.postalCode, venue.locality].filter(Boolean).join(" ")].filter(Boolean).join(", ")
      : "";
    const query = [venueName, address || full.location?.municipality, full.location?.countryCode].filter(Boolean).join(", ");
    rows.push({
      key: "venue",
      icon: FACT_ICONS.venue,
      label: c.venue,
      body: (
        <>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline-offset-4 hover:underline"
          >
            {venueName}
          </a>
          {address && address !== venueName ? <p className="text-muted-foreground">{address}</p> : null}
        </>
      ),
    });
  }

  const organizer = facts.organizer?.value;
  if (organizer) {
    rows.push({
      key: "organizer",
      icon: FACT_ICONS.organizer,
      label: c.organizer,
      body: (
        <>
          <p className="break-words font-medium">
            {organizer.url ? (
              <a href={organizer.url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                {organizer.name}
              </a>
            ) : (
              organizer.name
            )}
          </p>
          {organizer.contactName || organizer.phone || organizer.email ? (
            <p className="break-words text-muted-foreground">
              {[
                organizer.contactName,
                organizer.phone ? (
                  <a key="phone" className="underline-offset-4 hover:underline" href={`tel:${organizer.phone.replace(/[^\d+]/g, "")}`}>
                    {organizer.phone}
                  </a>
                ) : null,
                organizer.email ? (
                  <a key="email" className="underline-offset-4 hover:underline" href={`mailto:${organizer.email}`}>
                    {organizer.email}
                  </a>
                ) : null,
              ]
                .filter(Boolean)
                .flatMap((part, i) => (i ? [" · ", part] : [part]))}
            </p>
          ) : null}
        </>
      ),
    });
  }
  if (facts.parking) {
    rows.push({ key: "parking", icon: FACT_ICONS.parking, label: c.parking, body: <p>{facts.parking.value.note}</p> });
  }
  const about = full.description?.trim();
  if (about) {
    rows.push({
      key: "about",
      icon: FACT_ICONS.about,
      label: t.raceAbout,
      body: <p className="line-clamp-4 text-pretty text-muted-foreground">{about}</p>,
    });
  }
  return rows;
}

/** How many rows of a list the card shows before pointing to the race page. */
const LIMIT = 6;

/** Whole races already fetched, kept while the page is open: back to a pin is instant. */
const fetched = new Map<string, Promise<EventListItem | null>>();

function loadFullRace(slug: string): Promise<EventListItem | null> {
  let pending = fetched.get(slug);
  if (!pending) {
    pending = fetch(`/api/events/${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? (res.json() as Promise<EventListItem>) : null))
      .catch(() => {
        fetched.delete(slug);
        return null;
      });
    fetched.set(slug, pending);
  }
  return pending;
}

/** The whole race: `undefined` while it is on its way, `null` if it could not be had. */
function useFullRace(slug: string): EventListItem | null | undefined {
  const [result, setResult] = useState<{ slug: string; race: EventListItem | null } | null>(null);
  useEffect(() => {
    let alive = true;
    void loadFullRace(slug).then((race) => {
      if (alive) setResult({ slug, race });
    });
    return () => {
      alive = false;
    };
  }, [slug]);
  return result?.slug === slug ? result.race : undefined;
}
