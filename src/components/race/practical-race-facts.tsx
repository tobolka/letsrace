import type { ReactNode } from "react";
import type { EventListItem } from "@/lib/events";
import { practicalCopy, type PracticalDetails } from "@/lib/practical-details";

export function PracticalRaceFacts({ event, locale }: { event: EventListItem; locale: string }) {
  const facts = event.practicalDetails ?? {};
  const c = practicalCopy[locale === "cs" ? "cs" : "en"];
  const venue = facts.venue?.value;
  const venueName = venue?.name || event.location?.venue;
  const location = event.location;
  const hasVenueCoordinates = location?.lat != null && location.lng != null && Number.isFinite(location.lat) && Number.isFinite(location.lng) && (!venue || venue.name === location.venue);
  const venueQuery = hasVenueCoordinates
    ? `${location.lat},${location.lng}`
    : [venueName, venue?.streetAddress, venue?.postalCode, venue?.locality || location?.municipality, venue?.countryCode || location?.countryCode].filter(Boolean).join(", ");
  const venueMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueQuery)}`;
  if (!Object.keys(facts).length && !event.location?.venue) return null;
  const date = (day: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  const source = (fact: NonNullable<PracticalDetails[keyof PracticalDetails]>) => {
    const citations = new Map<string, { url:string; quote:string }>();
    citations.set(fact.sourceUrl+fact.quote, {url:fact.sourceUrl,quote:fact.quote});
    if (Array.isArray(fact.value)) for(const item of fact.value) if(item.sourceQuote) citations.set((item.sourceUrl??fact.sourceUrl)+item.sourceQuote,{url:item.sourceUrl??fact.sourceUrl,quote:item.sourceQuote});
    return <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
    {fact.status !== "current" && <p>{fact.status === "inherited" ? c.previous : c.neutral}</p>}
    <a href={fact.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{c.source}: {new URL(fact.sourceUrl).hostname}</a>
    <details className="mt-1"><summary className="cursor-pointer">{locale === "cs" ? "Co uvádí zdroj" : "What the source says"}</summary><div className="mt-2 space-y-3">{[...citations.values()].map((citation,index)=><blockquote key={index} className="border-l-2 pl-3"><p>{citation.quote}</p>{citation.url!==fact.sourceUrl&&<a className="underline" href={citation.url} target="_blank" rel="noopener noreferrer">{new URL(citation.url).hostname}</a>}</blockquote>)}</div></details>
  </div>;
  };
  const rows: { key: string; label: string; content: ReactNode }[] = [];
  if (venue || event.location?.venue) rows.push({ key: "venue", label: c.venue, content: <><p className="font-medium"><a href={venueMapUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4" title={locale === "cs" ? "Zobrazit místo na mapě" : "View place on map"}>{venueName}</a></p>{venue?.precision === "municipality" && <p className="text-xs text-muted-foreground">{locale === "cs" ? "Pouze obec; přesný start není uvedený." : "Municipality only; the exact start is not stated."}</p>}{venue && <p>{[venue.streetAddress, [venue.postalCode, venue.locality].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>}{facts.venue && source(facts.venue)}</> });
  if (facts.organizer) rows.push({ key: "organizer", label: c.organizer, content: <><p>{facts.organizer.value.url ? <a className="underline underline-offset-4" href={facts.organizer.value.url} target="_blank" rel="noopener noreferrer">{facts.organizer.value.name}</a> : facts.organizer.value.name}</p>{facts.organizer.value.contactName || facts.organizer.value.phone || facts.organizer.value.email ? <p className="mt-1 text-sm">{c.contact}: {[facts.organizer.value.contactName, facts.organizer.value.phone ? <a key="phone" className="underline underline-offset-4" href={`tel:${facts.organizer.value.phone.replace(/[^\d+]/g, "")}`}>{facts.organizer.value.phone}</a> : null, facts.organizer.value.email ? <a key="email" className="underline underline-offset-4" href={`mailto:${facts.organizer.value.email}`}>{facts.organizer.value.email}</a> : null].filter(Boolean).flatMap((part, i) => i ? [" · ", part] : [part])}</p> : null}{source(facts.organizer)}</> });
  if (facts.categories) rows.push({ key: "categories", label: c.categories, content: <><ul className="space-y-1">{facts.categories.value.map((item, i) => <li key={i}>{item.label}{item.birthYears ? <span className="text-muted-foreground"> · {item.birthYears}</span> : null}</li>)}</ul>{source(facts.categories)}</> });
  if (facts.schedule) rows.push({ key: "schedule", label: c.schedule, content: <><ul className="space-y-1">{facts.schedule.value.map((item, i) => <li key={i}><span className="font-medium tabular-nums">{date(item.date)} · {item.approximate ? "≈ " : ""}{item.time}</span> — {item.label}</li>)}</ul>{facts.schedule.value.some(item=>item.approximate)&&<p className="mt-2 text-xs text-muted-foreground">{locale==="cs"?"Časy s ≈ uvádí pořadatel jako přibližné.":"The organiser marks times with ≈ as approximate."}</p>}{source(facts.schedule)}</> });
  if (facts.fees) rows.push({ key: "fees", label: c.fees, content: <><ul className="space-y-1">{facts.fees.value.map((item, i) => <li key={i}>{item.label}: <span className="font-medium tabular-nums">{new Intl.NumberFormat(locale, { style: "currency", currency: item.currency, maximumFractionDigits: 2 }).format(item.amount)}</span>{item.validUntil ? ` · ${c.until} ${date(item.validUntil)}` : ""}</li>)}</ul>{source(facts.fees)}</> });
  if (facts.routes) rows.push({ key: "routes", label: c.routes, content: <><ul className="space-y-3">{facts.routes.value.map((item, i) => <li key={i}><p className="font-medium">{item.name}</p><p className="text-muted-foreground">{[item.distanceKm != null ? `${new Intl.NumberFormat(locale).format(item.distanceKm)} km` : null, item.elevationM != null ? `↗ ${new Intl.NumberFormat(locale).format(item.elevationM)} m` : null, item.surface].filter(Boolean).join(" · ")}</p><p className="flex flex-wrap gap-3">{item.gpxUrl && <a className="underline underline-offset-4" href={item.gpxUrl} target="_blank" rel="noopener noreferrer">{c.gpx}</a>}{item.mapUrl && <a className="underline underline-offset-4" href={item.mapUrl} target="_blank" rel="noopener noreferrer">{c.map}</a>}</p></li>)}</ul>{source(facts.routes)}</> });
  if (facts.parking) rows.push({ key: "parking", label: c.parking, content: <><p>{facts.parking.value.note}</p>{source(facts.parking)}</> });
  return <section className="mt-8" aria-labelledby="practical-facts"><h2 id="practical-facts" className="mb-3 text-lg font-semibold">{c.title}</h2><dl className="divide-y rounded-lg border px-4">{rows.map(row => <div key={row.key} className="grid gap-2 py-4 sm:grid-cols-[9rem_1fr]"><dt className="text-sm text-muted-foreground">{row.label}</dt><dd className="min-w-0 text-sm leading-relaxed">{row.content}</dd></div>)}</dl></section>;
}
