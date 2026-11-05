import { fold } from "@/lib/text-match";

/** A broad calendar may fill gaps but cannot replace an official source's
 * identity/date/location fields. Alternative assertions remain in source evidence.
 */
export function protectOfficialFields(
  incomingKind: string | undefined,
  stored: Record<string, unknown> | null,
  proposed: Record<string, unknown>,
): string[] {
  if (!stored || incomingKind !== "aggregator") return [];
  const sources = stored.sources as { kind?: string | null }[] | undefined;
  if (!sources?.some(s => ["official", "national_federation", "series"].includes(s.kind ?? ""))) return [];
  const protectedFields: string[] = [];
  for (const field of ["name", "start_date", "end_date", "location_id", "disciplines", "event_type", "status", "level", "uci_class", "class_label"]) {
    const held = stored[field];
    if (held == null || held === "" || Array.isArray(held) && !held.length || !(field in proposed)) continue;
    if (JSON.stringify(held) === JSON.stringify(proposed[field])) continue;
    proposed[field] = held;
    protectedFields.push(field);
  }
  // The lookup key must continue to describe the values actually stored.
  if (protectedFields.some(f => ["name", "start_date", "location_id"].includes(f))) {
    if (stored.fingerprint) proposed.fingerprint = stored.fingerprint;
    if (stored.name_normalized) proposed.name_normalized = stored.name_normalized;
    if (stored.season) proposed.season = stored.season;
  }
  return protectedFields;
}

/** A default classification is not a new assertion about an already identified race. */
export function preserveUnstatedDisciplines(stored: Record<string, unknown> | null, source: { discipline?: readonly string[] }, proposed: Record<string, unknown>): void {
  if (source.discipline?.length || !Array.isArray(stored?.disciplines) || !stored.disciplines.length) return;
  proposed.disciplines = stored.disciplines;
  proposed.formats = Array.isArray(stored.formats) ? stored.formats : [];
}

/** Missing/general assertions cannot erase specific facts, even in a federation list. */
export function protectSpecificFacts(stored: Record<string, unknown> | null, proposed: Record<string, unknown>): string[] {
  if (!stored) return [];
  const kept: string[] = [];
  const keep = (field: string) => { if (JSON.stringify(proposed[field]) !== JSON.stringify(stored[field])) { proposed[field] = stored[field]; kept.push(field); } };
  for (const field of ["class_label", "uci_class", "formats", "competition_type"]) {
    const old = stored[field], next = proposed[field];
    if (!(field in proposed) || old == null || old === "" || old === "other" || old === "Local" || old === "community" || Array.isArray(old) && !old.length) continue;
    if (next == null || next === "" || next === "other" || field === "competition_type" && next === "community" || Array.isArray(next) && !next.length) keep(field);
  }
  const old = stored.disciplines, next = proposed.disciplines;
  if (Array.isArray(old) && old.length && Array.isArray(next)) {
    const families: Record<string, string[]> = { mtb: ["xco", "xcc", "xcm", "dh", "enduro", "four_cross"], road: ["tt", "criterium", "hill_climb", "stage_race"] };
    if (!next.length || next.every(d => old.includes(d) || families[d]?.some(specific => old.includes(specific)))) {
      keep("disciplines");
      if (Array.isArray(stored.formats) && stored.formats.length) keep("formats");
    }
  }
  return kept;
}

/**
 * What a re-read may do to a race's kind. Titles and series links differ per source,
 * so a guess from them must never replace a stored kind: two calendars would otherwise
 * swap it on every read. A source that states a kind outright can still correct it,
 * including a series or cup wrongly stored on what is one race. Saying only "race" does
 * not take away a championship or a ride, since listings call those races too.
 */
export function chooseEventType<T extends string>(stated: T | null | undefined, stored: T | null | undefined, guessed: T): T {
  if (!stored) return stated ?? guessed;
  if (!stated) return stored;
  return stated === "race" && stored !== "series" && stored !== "cup" ? stored : stated;
}

/**
 * Some calendars put the date in a row's id. When one record holds another race's row for
 * the date it now shows, this row is a different race joined to it by mistake, and letting
 * it set the date makes the record jump on every read. The same race moved to a new date
 * keeps its number, so a genuine reschedule still goes through.
 */
export function isDifferentDatedRace(externalId: string | undefined, startDate: string, storedDate: string | null | undefined, sources: { external_id?: string | null }[] | null | undefined): boolean {
  if (!externalId || !storedDate || startDate === storedDate) return false;
  const dated = /^(.+)-(\d{4}-\d{2}-\d{2})$/;
  const own = dated.exec(externalId);
  if (!own) return false;
  return (sources ?? []).some(source => {
    const other = dated.exec(source.external_id ?? "");
    return Boolean(other && other[1] !== own[1] && other[2] === storedDate);
  });
}

/**
 * The same calendar lists this row and the stored race as two entries with their own ids and
 * days, so they are two races however alike their names are ("Brevet 200" and "Brevet 300" of
 * one club). Two different calendars disagreeing about a day prove nothing of the kind.
 */
export function isSameCalendarOtherRace(externalId: string | undefined, startDate: string, storedDate: string | null | undefined, sources: { external_id?: string | null }[] | null | undefined): boolean {
  if (!isDifferentDatedRace(externalId, startDate, storedDate, sources)) return false;
  const calendar = (id: string | null | undefined) => id?.split("-")[0] ?? "";
  const dated = /^(.+)-(\d{4}-\d{2}-\d{2})$/;
  const own = dated.exec(externalId!)!;
  return (sources ?? []).some(source => {
    const other = dated.exec(source.external_id ?? "");
    return Boolean(other && other[1] !== own[1] && other[2] === storedDate && calendar(source.external_id) === calendar(externalId));
  });
}

export type PlaceFacts = { municipality?: string | null; name?: string | null; geocode_query?: string | null; country_code?: string | null; lat?: number | null; lng?: number | null };

/**
 * Two location rows can describe one place: older duplicates, or the same town with
 * different capitals. Moving a race between them changes nothing for a rider, and it
 * must not swap coordinates for a row that has none, so such a move is not worth a write.
 * Filling in a missing point, or a start that is really elsewhere in town, is a real change.
 */
export function isSamePlace(current: PlaceFacts | null | undefined, incoming: { query: string; country?: string | null; lat?: number | null; lng?: number | null }): boolean {
  if (!current || !incoming.query.trim()) return false;
  if (incoming.country && current.country_code && incoming.country !== current.country_code) return false;
  const label = (value: string | null | undefined) => fold(value).replace(/[^a-z0-9]+/g, " ").trim();
  const wanted = label(incoming.query);
  if (![current.geocode_query, current.municipality, current.name].some(value => label(value) === wanted)) return false;
  if (incoming.lat != null && incoming.lng != null) {
    if (current.lat == null || current.lng == null) return false;
    // About 500 m: the same row's rounding, not another venue in the same town.
    return Math.abs(current.lat - incoming.lat) <= 0.005 && Math.abs(current.lng - incoming.lng) <= 0.0075;
  }
  return true;
}
