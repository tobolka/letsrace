import { ageCategoriesFromList } from "@/lib/age-bands";
import { normalizeName } from "@/lib/domain";
import { AGE_CATEGORIES, seasonForEvent, type AgeCategory } from "@/lib/taxonomy";
import { facebookPageUrl } from "@/lib/watcher/public-url";

/**
 * Races an organiser announced somewhere we cannot read automatically — a
 * Facebook poster, an Instagram story, a PDF handed over in chat. The owner
 * passes the picture and the link; whoever reads it writes this file, and
 * `scripts/add-announced-races.ts` turns it into catalogue records.
 *
 * Only what the announcement states is confirmed. Everything else comes from
 * the previous edition, is recorded as inherited, and its categories are shown
 * as "as last year". Registration, fees and regulations are never carried over.
 */
export type AnnouncedRace = {
  start: string;
  end?: string;
  name: string;
  /** The announcement's own words for this race (one poster line). */
  quote: string;
  /** Slug of the previous edition this race continues. */
  previous?: string;
  /** Slug of a record that already is this race; update it instead of creating one. */
  update?: string;
  /** Set after checking that the same-day races the script listed are different races. */
  isNew?: boolean;
  locationId?: string;
  disciplines?: string[];
  /** Classes printed in the announcement, e.g. "Bobíci (*2023 - 22)" or "odrážedla 0–6 let". */
  classes?: string[];
  /** Age categories stated by the announcement, when the classes are not written out. */
  ageCategories?: string[];
  eventType?: string;
  level?: string;
  competitionType?: string;
  registrationUrl?: string;
  regulationsUrl?: string;
};

export type Announcement = {
  /** Where the owner saw it, e.g. https://www.facebook.com/Ustimtbcup */
  source: string;
  /** Organiser's year-neutral website, if any. */
  website?: string;
  /**
   * The organiser's or race's own Facebook page. Only this, never `source`: a poster is often
   * shared by a series or a club that does not run the race.
   */
  facebook?: string;
  /** Series slug every race belongs to. */
  series?: string;
  races: AnnouncedRace[];
};

export type PreviousEdition = {
  slug: string;
  location_id: string | null;
  disciplines: string[] | null;
  formats: string[] | null;
  audience: string | null;
  level: string | null;
  competition_type: string | null;
  event_type: string | null;
  age_categories: string[] | null;
  website_url: string | null;
  timezone: string | null;
  class_label: string | null;
};

export type InheritedFact = { field: string; value: unknown; fromSlug: string };

export function validateAnnouncement(input: unknown): Announcement {
  const a = input as Announcement;
  const problems: string[] = [];
  if (!a || typeof a !== "object") throw Error("Announcement must be an object");
  if (!/^https?:\/\//.test(a.source ?? "")) problems.push("source must be a URL");
  if (a.website && !/^https?:\/\//.test(a.website)) problems.push("website must be a URL");
  if (a.facebook && !facebookPageUrl(a.facebook)) problems.push("facebook must be a facebook.com page");
  if (!Array.isArray(a.races) || a.races.length === 0) problems.push("races must be a non-empty list");
  for (const [i, r] of (a.races ?? []).entries()) {
    const at = `races[${i}]`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.start ?? "")) problems.push(`${at}.start must be YYYY-MM-DD`);
    if (r.end && (!/^\d{4}-\d{2}-\d{2}$/.test(r.end) || r.end < r.start)) problems.push(`${at}.end must be YYYY-MM-DD, not before start`);
    if (!r.name?.trim()) problems.push(`${at}.name is required`);
    if (!r.quote?.trim()) problems.push(`${at}.quote is required: the announcement's own words for this race`);
    if (!r.update && !r.previous && !(r.locationId && r.disciplines?.length)) {
      problems.push(`${at} needs previous, update, or both locationId and disciplines`);
    }
    for (const c of r.ageCategories ?? []) {
      if (!(AGE_CATEGORIES as readonly string[]).includes(c)) problems.push(`${at}.ageCategories has unknown "${c}"`);
    }
  }
  if (problems.length) throw Error(problems.join("\n"));
  return a;
}

/** The Facebook link the races get: only the page the announcement names as the organiser's. */
export function announcementFacebook(ann: Announcement): string | null {
  return facebookPageUrl(ann.facebook);
}

/** A link that names a year belongs to that edition and must not be carried over. */
export function isYearSpecificUrl(url: string): boolean {
  return /(?:^|[^\d])(?:19|20)\d{2}(?:[^\d]|$)/.test(url);
}

/** Categories the announcement itself states, or null when it states none. */
export function statedAges(race: AnnouncedRace): AgeCategory[] | null {
  if (race.classes?.length) {
    const refYear = Number(race.start.slice(0, 4));
    const found = ageCategoriesFromList(race.classes.map((name) => ({ name })), { refYear });
    return found.length ? found : null;
  }
  if (race.ageCategories?.length) return AGE_CATEGORIES.filter((c) => race.ageCategories!.includes(c));
  return null;
}

/**
 * Same-day records that may already be this race: most of the announced
 * name's words appear in theirs, or theirs in the announced name.
 */
export function likelySameRace(announced: string, existing: string): boolean {
  const a = new Set(normalizeName(announced).split(" ").filter((w) => w.length > 2));
  const b = new Set(normalizeName(existing).split(" ").filter((w) => w.length > 2));
  if (!a.size || !b.size) return false;
  const shared = [...a].filter((w) => b.has(w)).length;
  return shared / Math.min(a.size, b.size) >= 0.6;
}

/** The row for a new record and the facts it inherits from the previous edition. */
export function planNewRace(
  race: AnnouncedRace,
  ann: Announcement,
  previous: PreviousEdition | null,
): { row: Record<string, unknown>; inherited: InheritedFact[] } {
  const inherited: InheritedFact[] = [];
  const from = <T>(field: string, value: T | null | undefined): T | null => {
    if (value == null || (Array.isArray(value) && value.length === 0)) return null;
    if (previous) inherited.push({ field, value, fromSlug: previous.slug });
    return value;
  };
  const disciplines = race.disciplines ?? from("disciplines", previous?.disciplines) ?? [];
  const locationId = race.locationId ?? from("location_id", previous?.location_id);
  const stated = statedAges(race);
  const carriedAges = stated ? null : from("age_categories", previous?.age_categories);
  const prevSite = previous?.website_url && !isYearSpecificUrl(previous.website_url) ? previous.website_url : null;
  const website = ann.website ?? from("website_url", prevSite);
  const row: Record<string, unknown> = {
    name: race.name,
    name_normalized: normalizeName(race.name),
    start_date: race.start,
    end_date: race.end ?? race.start,
    location_id: locationId,
    disciplines,
    formats: race.disciplines ?? previous?.formats ?? disciplines,
    audience: previous?.audience ?? "mixed",
    level: race.level ?? previous?.level ?? "regional",
    competition_type: race.competitionType ?? previous?.competition_type ?? "regional",
    event_type: race.eventType ?? previous?.event_type ?? "race",
    class_label: previous?.class_label ?? null,
    age_categories: stated ?? carriedAges ?? [],
    age_confidence: stated ? "explicit" : carriedAges ? "previous" : "default",
    website_url: website,
    facebook_url: announcementFacebook(ann),
    registration_url: race.registrationUrl ?? null,
    regulations_url: race.regulationsUrl ?? null,
    timezone: previous?.timezone ?? "Europe/Prague",
    season: seasonForEvent(race.start, disciplines),
    status: "scheduled",
    visibility: "public",
    source_kind: "official",
  };
  return { row, inherited };
}

/**
 * Only what the announcement confirms, for a record that already exists. Stated categories
 * join the record's own: a poster's class list is often partial, and losing a category
 * hides the race from those riders.
 */
export function planUpdate(race: AnnouncedRace, ann: Announcement, existingAges: string[] = []): Record<string, unknown> {
  const patch: Record<string, unknown> = { start_date: race.start, end_date: race.end ?? race.start, status: "scheduled" };
  const stated = statedAges(race);
  if (stated) {
    const all = new Set<string>([...existingAges, ...stated]);
    Object.assign(patch, { age_categories: AGE_CATEGORIES.filter((c) => all.has(c)), age_confidence: "explicit" });
  }
  if (race.locationId) patch.location_id = race.locationId;
  if (race.disciplines) Object.assign(patch, { disciplines: race.disciplines, formats: race.disciplines });
  if (race.registrationUrl) patch.registration_url = race.registrationUrl;
  if (race.regulationsUrl) patch.regulations_url = race.regulationsUrl;
  if (ann.website) patch.website_url = ann.website;
  const facebook = announcementFacebook(ann);
  if (facebook) patch.facebook_url = facebook;
  return patch;
}
