import { load } from "cheerio";
import type { Json } from "@/lib/supabase/database.types";
import { practicalDetailsForEvent } from "@/lib/practical-details";
import { racePlace } from "@/lib/race-place";
import { formatPlaceName, joinPlace, splitPlace } from "@/lib/places";
import { repairText } from "@/lib/text";

export type Publication = { revision: string; slug: string; previousSlugs?: string[]; expected: Record<string, Json | undefined> };
export function publicationPayload(value: Json): Publication {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.revision !== "string" || typeof value.slug !== "string" || !value.expected || typeof value.expected !== "object" || Array.isArray(value.expected)) throw Error("Invalid publication payload");
  return value as unknown as Publication;
}

/** A current database row is not proof that the public page carries its revision. */
export function verifyPublicRevision(html: string, status: number, publication: Publication, expectedVisible: boolean) {
  if (!expectedVisible) {
    if (status !== 404 && status !== 410) throw Error(`Hidden race still publicly available (HTTP ${status})`);
    return;
  }
  if (status !== 200) throw Error(`Race page returned HTTP ${status}`);
  const $ = load(html), article = $("article[data-race-revision]").first();
  if (article.attr("data-race-revision") !== publication.revision || article.attr("data-race-id") !== publication.expected.id) throw Error("Public race revision does not match the saved change");
  const events: Record<string, unknown>[] = [];
  function collect(value: unknown) {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    if (item["@type"] === "SportsEvent") events.push(item);
    if (item["@graph"]) collect(item["@graph"]);
  }
  $('script[type="application/ld+json"]').each((_, element) => {
    try { collect(JSON.parse($(element).text())); } catch { /* A broken block must not count as evidence. */ }
  });
  const expected = publication.expected;
  const actual = events.find(event => event.name === repairText(String(expected.name)));
  if (!actual || actual.startDate !== expected.start_date || actual.endDate !== (expected.end_date ?? expected.start_date)) throw Error("Public race name or dates do not match the saved change");
  const schemaStatus = expected.status === "cancelled" ? "EventCancelled" : expected.status === "postponed" ? "EventPostponed" : "EventScheduled";
  if (actual.eventStatus !== `https://schema.org/${schemaStatus}`) throw Error("Public race status does not match the saved change");
  const wantedPlace = expected.public_location;
  if (wantedPlace && typeof wantedPlace === "object" && !Array.isArray(wantedPlace)) {
    const actualPlace = actual.location as Record<string, unknown> | undefined;
    const address = actualPlace?.address as Record<string, unknown> | undefined;
    const normalize = (value: unknown) => String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
    if (normalize(actualPlace?.name) !== normalize(wantedPlace.name)) throw Error("Public race location does not match the saved change");
    for (const key of ["streetAddress", "postalCode"]) if (wantedPlace[key] && normalize(address?.[key]) !== normalize(wantedPlace[key])) throw Error("Public race address does not match the saved change");
    const geo = actualPlace?.geo as Record<string, unknown> | undefined;
    if (wantedPlace.lat != null && (Number(geo?.latitude) !== Number(wantedPlace.lat) || Number(geo?.longitude) !== Number(wantedPlace.lng))) throw Error("Public race coordinates do not match the saved change");
    const visible = $.root().clone(); visible.find("script,style").remove();
    const text = normalize(visible.text());
    for (const key of ["name", "streetAddress", "postalCode"]) if (wantedPlace[key] && !text.includes(normalize(wantedPlace[key]))) throw Error("Saved race location is missing from the visible page");
  }
  if (expected.registration_url && !$('a[href]').toArray().some(link => $(link).attr('href') === expected.registration_url)) throw Error("Saved registration link is missing from the public page");
}

/** Independent current-row snapshot, fetched with the task revision before checking HTML. */
export function publicationLocation(row: { name: string; start_date: string; end_date: string | null; practical_details: unknown; location: { id: string; name: string; municipality: string | null; venue: string | null; country_code: string | null; lat: number | null; lng: number | null } | null }) {
  const venue = practicalDetailsForEvent(row.practical_details, row.start_date, row.end_date).venue?.value;
  const place = row.location;
  const town = racePlace({ name: repairText(row.name), location: place ? { id: place.id, name: joinPlace(splitPlace(formatPlaceName(repairText(place.name)) ?? place.name)), municipality: splitPlace(formatPlaceName(repairText(place.municipality))).town, countryCode: place.country_code ?? "", lat: place.lat, lng: place.lng } : null });
  const name = venue?.name || place?.venue || town;
  if (!name) return null;
  return { name, ...(venue?.streetAddress ? { streetAddress: venue.streetAddress } : {}), ...(venue?.postalCode ? { postalCode: venue.postalCode } : {}), ...(!venue && place?.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : {}) };
}
