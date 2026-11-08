import type { ReactNode } from "react";
import { FACT_ICONS, FactList, FactRow } from "@/components/race/fact-row";
import type { EventListItem } from "@/lib/events";
import { asLocale } from "@/lib/i18n/messages";
import { practicalCopy, type PracticalDetails } from "@/lib/practical-details";
import { FACT_COPY } from "@/lib/race-fact-copy";

/**
 * Before you travel: the race's practical facts in the rows the map's race
 * card uses (`FactRow`), in the same order — the timetable, the fees, the
 * categories, the routes, the venue, the organiser, parking. Here every row of
 * every list is shown, each fact with the document it was read from. The
 * documents themselves are among the page's links.
 */
export function PracticalRaceFacts({ event, locale }: { event: EventListItem; locale: string }) {
  const facts = event.practicalDetails ?? {};
  const c = practicalCopy[locale === "cs" ? "cs" : "en"];
  const names = FACT_COPY[asLocale(locale)];
  const venue = facts.venue?.value;
  const venueName = venue?.name || event.location?.venue;
  const location = event.location;
  const hasVenueCoordinates = location?.lat != null && location.lng != null && Number.isFinite(location.lat) && Number.isFinite(location.lng) && (!venue || venue.name === location.venue);
  const venueQuery = hasVenueCoordinates
    ? `${location.lat},${location.lng}`
    : [venueName, venue?.streetAddress, venue?.postalCode, venue?.locality || location?.municipality, venue?.countryCode || location?.countryCode].filter(Boolean).join(", ");
  const venueMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueQuery)}`;
  const date = (day: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  const multiDay = Boolean(event.endDate && event.endDate !== event.startDate);
  const source = (fact: NonNullable<PracticalDetails[Exclude<keyof PracticalDetails, "documents">]>) => {
    const citations = new Map<string, { url: string; quote: string }>();
    citations.set(fact.sourceUrl + fact.quote, { url: fact.sourceUrl, quote: fact.quote });
    if (Array.isArray(fact.value)) for (const item of fact.value) if (item.sourceQuote) citations.set((item.sourceUrl ?? fact.sourceUrl) + item.sourceQuote, { url: item.sourceUrl ?? fact.sourceUrl, quote: item.sourceQuote });
    return (
      <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {fact.status !== "current" && <p>{fact.status === "inherited" ? c.previous : c.neutral}</p>}
        <a href={fact.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{c.source}: {new URL(fact.sourceUrl).hostname}</a>
        <details className="mt-1"><summary className="cursor-pointer">{locale === "cs" ? "Co uvádí zdroj" : "What the source says"}</summary><div className="mt-2 space-y-3">{[...citations.values()].map((citation, index) => <blockquote key={index} className="border-l-2 pl-3"><p>{citation.quote}</p>{citation.url !== fact.sourceUrl && <a className="underline" href={citation.url} target="_blank" rel="noopener noreferrer">{new URL(citation.url).hostname}</a>}</blockquote>)}</div></details>
      </div>
    );
  };

  const rows: { key: string; icon: ReactNode; label: string; content: ReactNode }[] = [];
  if (facts.schedule) rows.push({ key: "schedule", icon: FACT_ICONS.schedule, label: names.schedule, content: <>
    <FactList rows={facts.schedule.value.map((item, i) => ({ key: i, lead: `${multiDay ? `${date(item.date)} ` : ""}${item.approximate ? "≈ " : ""}${item.time.slice(0, 5)}${item.endTime ? `–${item.endTime}` : ""}`, label: item.label }))} />
    {facts.schedule.value.some(item => item.approximate) && <p className="mt-2 text-xs text-muted-foreground">{locale === "cs" ? "Časy s ≈ uvádí pořadatel jako přibližné." : "The organiser marks times with ≈ as approximate."}</p>}
    {source(facts.schedule)}
  </> });
  if (facts.fees) rows.push({ key: "fees", icon: FACT_ICONS.fees, label: names.fees, content: <>
    <FactList rows={facts.fees.value.map((item, i) => ({ key: i, label: <>{item.label}{item.validUntil ? <span className="text-muted-foreground"> · {c.until} {date(item.validUntil)}</span> : null}</>, value: <span className="font-medium text-foreground">{new Intl.NumberFormat(locale, { style: "currency", currency: item.currency, maximumFractionDigits: 2 }).format(item.amount)}</span> }))} />
    {source(facts.fees)}
  </> });
  if (facts.categories) rows.push({ key: "categories", icon: FACT_ICONS.categories, label: names.categories, content: <>
    <FactList rows={facts.categories.value.map((item, i) => ({ key: i, label: item.label, value: item.birthYears }))} />
    {source(facts.categories)}
  </> });
  if (facts.routes) rows.push({ key: "routes", icon: FACT_ICONS.routes, label: names.routes, content: <>
    <ul className="flex flex-col gap-2">{facts.routes.value.map((item, i) => <li key={i}>
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="min-w-0 flex-1 break-words">{item.name}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{[item.distanceKm != null ? `${new Intl.NumberFormat(locale).format(item.distanceKm)} km` : null, item.elevationM != null ? `↗ ${new Intl.NumberFormat(locale).format(item.elevationM)} m` : null].filter(Boolean).join(" · ")}</span>
      </div>
      {item.surface || item.gpxUrl || item.mapUrl ? <p className="flex flex-wrap gap-x-3 text-muted-foreground">{item.surface ? <span>{item.surface}</span> : null}{item.gpxUrl && <a className="underline underline-offset-4" href={item.gpxUrl} target="_blank" rel="noopener noreferrer">{c.gpx}</a>}{item.mapUrl && <a className="underline underline-offset-4" href={item.mapUrl} target="_blank" rel="noopener noreferrer">{c.map}</a>}</p> : null}
    </li>)}</ul>
    {source(facts.routes)}
  </> });
  if (venueName) rows.push({ key: "venue", icon: FACT_ICONS.venue, label: names.venue, content: <>
    <a href={venueMapUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-4 hover:underline" title={locale === "cs" ? "Zobrazit místo na mapě" : "View place on map"}>{venueName}</a>
    {venue && <p className="text-muted-foreground">{[venue.streetAddress, [venue.postalCode, venue.locality].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>}
    {venue?.precision === "municipality" && <p className="text-xs text-muted-foreground">{locale === "cs" ? "Pouze obec; přesný start není uvedený." : "Municipality only; the exact start is not stated."}</p>}
    {facts.venue && source(facts.venue)}
  </> });
  if (facts.organizer) {
    const o = facts.organizer.value;
    rows.push({ key: "organizer", icon: FACT_ICONS.organizer, label: names.organizer, content: <>
      <p className="font-medium">{o.url ? <a className="underline-offset-4 hover:underline" href={o.url} target="_blank" rel="noopener noreferrer">{o.name}</a> : o.name}</p>
      {o.contactName || o.phone || o.email ? <p className="text-muted-foreground">{[o.contactName, o.phone ? <a key="phone" className="underline-offset-4 hover:underline" href={`tel:${o.phone.replace(/[^\d+]/g, "")}`}>{o.phone}</a> : null, o.email ? <a key="email" className="underline-offset-4 hover:underline" href={`mailto:${o.email}`}>{o.email}</a> : null].filter(Boolean).flatMap((part, i) => i ? [" · ", part] : [part])}</p> : null}
      {source(facts.organizer)}
    </> });
  }
  if (facts.parking) rows.push({ key: "parking", icon: FACT_ICONS.parking, label: names.parking, content: <><p>{facts.parking.value.note}</p>{source(facts.parking)}</> });
  if (!rows.length) return null;

  return (
    <section className="mt-10" aria-labelledby="practical-facts">
      <h2 id="practical-facts" className="mb-3 text-lg font-semibold">{c.title}</h2>
      <div className="divide-y divide-border/60 rounded-xl border px-4">
        {rows.map((row) => (
          <FactRow key={row.key} icon={row.icon} label={row.label} className="py-4">
            {row.content}
          </FactRow>
        ))}
      </div>
    </section>
  );
}
