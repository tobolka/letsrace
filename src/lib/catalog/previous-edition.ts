import { lockedFieldsOf, type OverridesEmbed } from "./overrides";
import { differentInstalment } from "./merge-duplicates";
import { createServerSupabase } from "@/lib/supabase/server";
import { audienceFromAgeCategories, type AgeCategory } from "@/lib/taxonomy";
import type { Update } from "@/lib/supabase/tables";

const PAGE = 1000;
const MAX_KM = 15;

/**
 * A race's name without the parts that change every year: the year, the
 * edition ("32. ročník", "XXXIX", "#3", "N°1"), the words for "edition".
 * "32. ročník Českopetrovická koolna 2026" and "31. ročník Českopetrovická
 * koolna 2025" are the same race.
 */
export function editionKey(name: string): string {
  return name
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

type Row = {
  id: string;
  name: string;
  start_date: string;
  updated_at: string;
  overrides: OverridesEmbed;
  series_id: string | null;
  age_categories: string[] | null;
  age_confidence: string | null;
  disciplines: string[] | null;
  class_label: string | null;
  uci_class: string | null;
  website_url: string | null;
  location: { lat: number | null; lng: number | null; country_code: string | null; municipality: string | null } | null;
};

const COLUMNS =
  "id, name, start_date, updated_at, overrides:event_overrides(locked_fields), series_id, age_categories, age_confidence, disciplines, class_label, uci_class, website_url, location:locations(lat, lng, country_code, municipality)";

async function readRange(from: string, to: string): Promise<Row[]> {
  const supabase = createServerSupabase();
  const out: Row[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("events")
      .select(COLUMNS)
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .gte("start_date", from)
      .lte("start_date", to)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Carry what last year's edition knew to this year's.
 *
 * Races come back every year, mostly unchanged: the same classes, the same
 * discipline, the same organiser's site. This year's listing is often thin —
 * a date and a place, months before the propozice are out — while last
 * year's row holds everything we learned. Where the new edition has nothing,
 * it gets last year's:
 *
 *  - stated categories, marked `previous` so they read as "as last year" and
 *    never rule a race out of a filter;
 *  - the discipline, the class;
 *  - the website, unless last year's address names last year.
 *
 * The same race is the same series or the same name without its year and
 * edition number, within 15 km, 300 to 430 days earlier.
 */
export async function carryForwardFromPreviousEditions(opts?: {
  dryRun?: boolean;
  log?: (line: string) => void;
}): Promise<{ considered: number; matched: number; ages: number; disciplines: number; websites: number }> {
  const supabase = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (await readRange(today, addDays(today, 500))).filter(
    (r) =>
      !(r.age_categories ?? []).length ||
      r.age_confidence === "default" ||
      !(r.disciplines ?? []).length ||
      !r.website_url,
  );
  const past = await readRange(addDays(today, -430), addDays(today, 200));

  const byKey = new Map<string, Row[]>();
  const bySeries = new Map<string, Row[]>();
  for (const p of past) {
    const key = editionKey(p.name);
    if (key.length >= 5) byKey.set(key, [...(byKey.get(key) ?? []), p]);
    if (p.series_id) bySeries.set(p.series_id, [...(bySeries.get(p.series_id) ?? []), p]);
  }

  const result = { considered: upcoming.length, matched: 0, ages: 0, disciplines: 0, websites: 0 };
  for (const ev of upcoming) {
    const here = ev.location?.lat != null && ev.location?.lng != null ? { lat: ev.location.lat, lng: ev.location.lng } : null;
    const lo = addDays(ev.start_date, -430);
    const hi = addDays(ev.start_date, -300);
    const key = editionKey(ev.name);
    const near = (p: Row) => {
      if (p.id === ev.id || p.start_date < lo || p.start_date > hi) return false;
      const there = p.location?.lat != null && p.location?.lng != null ? { lat: p.location.lat, lng: p.location.lng } : null;
      if (p.location?.country_code !== ev.location?.country_code || !ev.location?.country_code) return false;
      if (differentInstalment(p.name, ev.name)) return false;
      if (p.disciplines?.length && ev.disciplines?.length && !p.disciplines.some(d => ev.disciplines!.includes(d))) return false;
      return here && there ? km(here, there) <= MAX_KM : Boolean(ev.location?.municipality && p.location?.municipality && editionKey(ev.location.municipality) === editionKey(p.location.municipality));
    };
    // The same name without its year, near. A series alone is not enough: a
    // cup runs several rounds at one venue (Motol XCC and XCO), so a series
    // match counts only when it is the one round of that series there.
    let candidates = key.length >= 5 ? (byKey.get(key) ?? []).filter(near) : [];
    if (!candidates.length && ev.series_id && here) {
      const rounds = (bySeries.get(ev.series_id) ?? []).filter(
        (p) => near(p) && p.location?.lat != null,
      );
      if (rounds.length === 1) candidates = rounds;
    }
    // Ambiguity is never resolved by guessing the nearest anniversary.
    if (candidates.length !== 1) continue;
    const prev = candidates[0]!;

    const patch: Update<"events"> = {};
    const hasAges = (ev.age_categories ?? []).length > 0;
    if ((prev.age_categories ?? []).length && prev.age_confidence === "explicit" && (!hasAges || ev.age_confidence === "default")) {
      patch.age_categories = prev.age_categories ?? [];
      patch.age_confidence = "previous";
      patch.audience = audienceFromAgeCategories(prev.age_categories as AgeCategory[]);
    }
    if (!(ev.disciplines ?? []).length && (prev.disciplines ?? []).length) patch.disciplines = prev.disciplines ?? [];
    if (!ev.class_label && prev.class_label) patch.class_label = prev.class_label;
    if (!ev.uci_class && prev.uci_class) patch.uci_class = prev.uci_class;
    const prevYear = prev.start_date.slice(0, 4);
    if (!ev.website_url && prev.website_url && !prev.website_url.includes(prevYear) && !/-\d{2}\/?$/.test(prev.website_url)) {
      patch.website_url = prev.website_url;
    }
    const locks = lockedFieldsOf(ev.overrides);
    if (["categories", "age_categories", "age_confidence", "audience"].some(f => locks.includes(f))) {
      delete patch.age_categories; delete patch.age_confidence; delete patch.audience;
    }
    for (const field of locks) Reflect.deleteProperty(patch, field);
    if (!Object.keys(patch).length) continue;
    if (!opts?.dryRun) {
      const { data: applied, error } = await supabase.rpc("app_carry_previous_edition", {
        target_id: ev.id, previous_id: prev.id,
        expected: { updated_at: ev.updated_at, start_date: ev.start_date }, patch,
      });
      if (error) throw new Error(`Applying inherited facts: ${error.message}`);
      if (!applied) { opts?.log?.(`DEFER changed or locked: ${ev.id}`); continue; }
    }

    result.matched += 1;
    if (patch.age_categories) result.ages += 1;
    if (patch.disciplines) result.disciplines += 1;
    if (patch.website_url) result.websites += 1;
    opts?.log?.(
      `${opts?.dryRun ? "DRY" : "SET"}  ${ev.start_date}  ${ev.name}\n      ← ${prev.start_date}  ${prev.name}  [${Object.keys(patch).filter((k) => k !== "audience").join(", ")}]${patch.age_categories ? `  ${(patch.age_categories as string[]).join(", ")}` : ""}`,
    );

  }
  return result;
}
