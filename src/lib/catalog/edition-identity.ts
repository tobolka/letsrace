import { raceIdentityName } from "@/lib/race-identity-name";
import { differentInstalment } from "./merge-duplicates";

/**
 * A race's name without the parts that change every year: the year, the
 * edition ("32. ročník", "XXXIX", "#3", "N°1"), the words for "edition".
 * "32. ročník Českopetrovická koolna 2026" and "31. ročník Českopetrovická
 * koolna 2025" are the same race.
 */
export function editionKey(name: string): string {
  return raceIdentityName(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\b(19|20)\d{2}\b(\s*[/-]\s*(19|20)?\d{2}\b)?/g, " ")
    .replace(/[-_]\d{2}\b/g, " ")
    .replace(/#\s*\d+|n[°º]\s*\d+|\b\d+\s*\.\s*(rocnik|edycja|ausgabe|edizione|edition|kolo|zavod|round)?/g, " ")
    .replace(/\b(rocnik|rocniku|edycja|edycji|ausgabe|edizione|edition|jahrgang)\b/g, " ")
    .replace(/\b[ivxlc]{2,}\b/g, " ")
    .replace(/\b\d+(st|nd|rd|th|e|er|eme|°)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
}

export type EditionIdentity = {
  id: string; name: string; start_date: string; series_id: string | null;
  disciplines: string[] | null;
  location: { lat: number | null; lng: number | null; country_code: string | null; municipality: string | null } | null;
};

/** Shared annual identity for inheritance and public edition links. Never merges editions. */
export function findPreviousEdition<T extends EditionIdentity>(event: EditionIdentity, candidates: T[], yearsBack = 1): T | null {
  const here = event.location;
  const key = editionKey(event.name);
  const eligible = candidates.filter(previous => {
    const days = (Date.parse(event.start_date) - Date.parse(previous.start_date)) / 86400_000;
    const there = previous.location;
    const annualOffset = 365 * (yearsBack - 1);
    if (previous.id === event.id || days < 300 + annualOffset || days > 430 + annualOffset) return false;
    if (!here?.country_code || here.country_code !== there?.country_code) return false;
    // Annual edition numbers may change; round and stage numbers may not.
    const withoutEdition = (name: string) => name.replace(/\b\d+\.?\s*(?:ročník|rocnik|edition|edycja|edizione|ausgabe)\b/gi, "");
    if (differentInstalment(withoutEdition(previous.name), withoutEdition(event.name))) return false;
    if (previous.disciplines?.length && event.disciplines?.length && !previous.disciplines.some(d => event.disciplines!.includes(d))) return false;
    return here.lat != null && here.lng != null && there?.lat != null && there.lng != null
      ? km({lat:here.lat,lng:here.lng},{lat:there.lat,lng:there.lng}) <= 15
      : Boolean(here.municipality && there?.municipality && editionKey(here.municipality) === editionKey(there.municipality));
  });
  const byName = key.length >= 5 ? eligible.filter(p => editionKey(p.name) === key) : [];
  if (byName.length) return byName.length === 1 ? byName[0] : null;
  const bySeries = event.series_id && here?.lat != null ? eligible.filter(p => p.series_id === event.series_id && p.location?.lat != null) : [];
  return bySeries.length === 1 ? bySeries[0] : null;
}

/** Reverse the same identity check; ambiguous future editions never become links. */
export function findNextEdition<T extends EditionIdentity>(event: EditionIdentity, candidates: T[], yearsAhead = 1): T | null {
  const pool: EditionIdentity[] = candidates.some(row => row.id === event.id) ? candidates : [...candidates, event];
  const offset = 365 * (yearsAhead - 1);
  const matches = candidates.filter(candidate => {
    const days = (Date.parse(candidate.start_date) - Date.parse(event.start_date)) / 86400_000;
    return days >= 300 + offset && days <= 430 + offset &&
      findPreviousEdition(candidate, pool, yearsAhead)?.id === event.id;
  });
  return matches.length === 1 ? matches[0] : null;
}
