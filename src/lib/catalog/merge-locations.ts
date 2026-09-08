/**
 * One place, one row — and no pin in a field in Cumbria.
 *
 * 987 coordinates carried more than one `locations` row, 3,309 rows in all.
 * Reading them showed three different problems wearing the same shape:
 *
 *   1. The same town spelled several ways. "Girona", "Gerona, Spain",
 *      "GIRONA, Spain" — 22 rows on one point. Nothing is lost by merging
 *      these, and 1,766 of the 2,322 surplus rows are exactly this.
 *   2. A country's own name used as a venue. Forty-nine British races sit on
 *      54.70/-3.28, which is a field near Penrith and the centre of the United
 *      Kingdom; thirty-seven French ones sit outside Châteauroux. A pin three
 *      hundred kilometres from the race is worse than no pin, because the whole
 *      point of the map is knowing where to drive on Sunday.
 *   3. Genuinely different places that happen to share a point — Všetaty
 *      pinned in Prague, Morillon at Les Gets. Merging those would carve the
 *      mistake into the data instead of fixing it, so they are left alone and
 *      counted.
 *
 * Only (1) is merged here and only (2) is unpinned. The job is written to be
 * run again because new spellings arrive with every poll.
 */
import { createServerSupabase } from "@/lib/supabase/server";
import { fold } from "@/lib/text-match";
import { EUROPE_COUNTRY_CODES } from "@/lib/geo/europe";
import { readAllRows } from "@/lib/supabase/read-all";

export type LocationRow = {
  id: string;
  name: string | null;
  municipality: string | null;
  region: string | null;
  venue: string | null;
  country_code: string | null;
  lat: number | null;
  lng: number | null;
  geocode_status: string | null;
  created_at: string | null;
};

/** Accent-free, punctuation-free, single-spaced — "GIRONA, Spain" → "girona spain". */
export function foldPlace(value: string | null | undefined): string {
  return fold(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The place as the row states it: municipality if it has one, else the name. */
export function placeOf(row: Pick<LocationRow, "name" | "municipality">): string {
  return (row.municipality || row.name || "").trim();
}

const LOCALES = ["en", "cs", "pl", "sk", "de", "it", "es", "fr"] as const;

function buildCountryNames(): Set<string> {
  const names = new Set<string>();
  for (const locale of LOCALES) {
    let display: Intl.DisplayNames;
    try {
      display = new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      continue;
    }
    for (const code of EUROPE_COUNTRY_CODES) {
      const label = display.of(code);
      if (label && label !== code) names.add(foldPlace(label));
    }
  }
  // Names the platform does not give back, and two the calendars actually use.
  for (const extra of ["czechia", "czech republic", "cesko", "ceska republika", "great britain", "holland", "england", "scotland", "wales"]) {
    names.add(foldPlace(extra));
  }
  return names;
}

let countryNames: Set<string> | null = null;

/**
 * States small enough that their centroid is a usable pin. Monaco is two square
 * kilometres and Gibraltar six; a race "in Monaco" is within walking distance
 * of the centre, so taking that pin away would lose a real one.
 */
const MICRO_STATES = new Set(["MC", "GI", "LI", "SM", "VA", "AD", "MT", "LU"]);

/**
 * True when the "venue" is nothing but a country.
 *
 * Geocoding one returns the country's centroid, which is a real coordinate for
 * a place no race is at. Such a row should hold no coordinate at all.
 */
export function isCountryOnlyPlace(
  place: string | null | undefined,
  countryCode?: string | null,
): boolean {
  const p = foldPlace(place);
  if (!p) return false;
  if (countryCode && MICRO_STATES.has(countryCode.trim().toUpperCase())) return false;
  countryNames ??= buildCountryNames();
  return countryNames.has(p);
}

const ALL_CAPS = /^[^a-z]*$/;

/**
 * The row the others should become.
 *
 * Preference in order: one the geocoder actually resolved, one that is not
 * shouting, one that kept its diacritics, the one carrying the most detail,
 * and finally the oldest — the one most rows already point at.
 */
export function pickSurvivor(rows: LocationRow[]): LocationRow {
  const score = (row: LocationRow) => {
    const place = placeOf(row);
    return (
      (row.geocode_status === "ok" ? 8 : 0) +
      (place && !ALL_CAPS.test(place) ? 4 : 0) +
      (place !== fold(place) ? 2 : 0) +
      (row.venue ? 1 : 0) +
      (row.region ? 1 : 0)
    );
  };
  return [...rows].sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    const at = a.created_at ?? "";
    const bt = b.created_at ?? "";
    if (at !== bt) return at < bt ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  })[0]!;
}

export type LocationGroup = {
  key: string;
  survivor: LocationRow;
  duplicates: LocationRow[];
};

/**
 * Rows that are the same place written differently, grouped by point, country
 * and folded name. A group needs all three to match: 18 coordinate groups span
 * two countries, which means one side is mis-geocoded rather than duplicated.
 */
export function groupMergeable(rows: LocationRow[]): LocationGroup[] {
  const byKey = new Map<string, LocationRow[]>();
  for (const row of rows) {
    if (row.lat == null || row.lng == null) continue;
    const place = foldPlace(placeOf(row));
    if (!place) continue;
    const key = `${row.lat}|${row.lng}|${(row.country_code ?? "").toUpperCase()}|${place}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(row);
    else byKey.set(key, [row]);
  }
  const groups: LocationGroup[] = [];
  for (const [key, bucket] of byKey) {
    if (bucket.length < 2) continue;
    const survivor = pickSurvivor(bucket);
    groups.push({
      key,
      survivor,
      duplicates: bucket.filter((r) => r.id !== survivor.id),
    });
  }
  return groups;
}

export type MergeLocationsResult = {
  scanned: number;
  groups: number;
  merged: number;
  eventsRepointed: number;
  unpinned: number;
  /** Points still holding two names that are not variants of one another. */
  ambiguousPoints: number;
  failed: { survivor: string; duplicate: string; error: string }[];
};

/**
 * Collapse spelling variants and take the pin off country-name venues.
 *
 * `max` bounds the groups touched in one run so a cron slot cannot overrun.
 */
export async function mergeDuplicateLocations(opts?: {
  max?: number;
  dryRun?: boolean;
}): Promise<MergeLocationsResult> {
  const supabase = createServerSupabase();
  const max = opts?.max ?? 200;
  const dry = opts?.dryRun ?? false;

  const rows = await readAllRows<LocationRow>((from, to) =>
    supabase
      .from("locations")
      .select("id, name, municipality, region, venue, country_code, lat, lng, geocode_status, created_at")
      .not("lat", "is", null)
      .order("id", { ascending: true })
      .range(from, to),
  );

  const result: MergeLocationsResult = {
    scanned: rows.length,
    groups: 0,
    merged: 0,
    eventsRepointed: 0,
    unpinned: 0,
    ambiguousPoints: 0,
    failed: [],
  };

  // (2) A country name is not a venue. Do this first: an unpinned row leaves
  // the coordinate groups, so the merge below sees a smaller, truer picture.
  const countryOnly = rows.filter((r) => isCountryOnlyPlace(placeOf(r), r.country_code));
  if (!dry) {
    for (const row of countryOnly) {
      const { error } = await supabase
        .from("locations")
        .update({
          lat: null,
          lng: null,
          geog: null,
          // Terminal on purpose: re-asking the geocoder returns the centroid
          // again. Only a better place name from the source can fix this.
          geocode_status: "skipped",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) result.failed.push({ survivor: row.id, duplicate: row.id, error: error.message });
      else result.unpinned += 1;
    }
  } else {
    result.unpinned = countryOnly.length;
  }

  const unpinned = new Set(countryOnly.map((r) => r.id));
  const stillPinned = rows.filter((r) => !unpinned.has(r.id));

  // (3) Count what is left sharing a point under two different names, so the
  // number is visible rather than quietly merged away.
  const namesPerPoint = new Map<string, Set<string>>();
  for (const row of stillPinned) {
    const key = `${row.lat}|${row.lng}`;
    const place = foldPlace(placeOf(row));
    if (!place) continue;
    const set = namesPerPoint.get(key) ?? new Set<string>();
    set.add(place);
    namesPerPoint.set(key, set);
  }
  for (const set of namesPerPoint.values()) if (set.size > 1) result.ambiguousPoints += 1;

  // (1) The safe merge.
  const groups = groupMergeable(stillPinned);
  result.groups = groups.length;
  if (dry) return result;

  for (const group of groups.slice(0, max)) {
    let ok = true;
    for (const duplicate of group.duplicates) {
      const { data, error } = await supabase
        .from("events")
        .update({ location_id: group.survivor.id, updated_at: new Date().toISOString() })
        .eq("location_id", duplicate.id)
        .select("id");
      if (error) {
        result.failed.push({
          survivor: group.survivor.id,
          duplicate: duplicate.id,
          error: error.message,
        });
        ok = false;
        continue;
      }
      result.eventsRepointed += data?.length ?? 0;
      const { error: deleteError } = await supabase
        .from("locations")
        .delete()
        .eq("id", duplicate.id);
      if (deleteError) {
        result.failed.push({
          survivor: group.survivor.id,
          duplicate: duplicate.id,
          error: deleteError.message,
        });
        ok = false;
      }
    }
    if (ok) result.merged += 1;
  }
  return result;
}
