import { createServerSupabase } from "@/lib/supabase/server";
import {
  DEDUP_THRESHOLD,
  scoreDuplicate,
  sharesDisciplineFamily,
  spanDays,
} from "@/lib/dedup";

/**
 * Pairs worth a second pair of eyes.
 *
 * The merger acts on titles, URLs and series, and it is deliberately cautious:
 * it will not join "Časovka do vrchu Český Krumlov" to "Časovka na Kleť",
 * because nothing in either name says they are the same climb. What says it is
 * that two time trials do not start from the same square on the same morning.
 *
 * That rule is far too blunt to merge on — across the catalogue it pairs eighty
 * listings and only about half are real, because towns hold more than one bike
 * race on a Sunday. So it gathers a list instead, and a person decides. An
 * answer of "these are two races" is remembered, or the same forty non-matches
 * would be waiting again tomorrow.
 */

export type SuspiciousPair = {
  key: string;
  date: string;
  place: string;
  discipline: string;
  country: string | null;
  left: SuspiciousSide;
  right: SuspiciousSide;
  reasons: string[];
};

export type SuspiciousSide = {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  disciplines: string[];
  series: string | null;
  websiteUrl: string | null;
  registrationUrl: string | null;
  sources: number;
};

type Row = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  disciplines: string[] | null;
  website_url: string | null;
  registration_url: string | null;
  fingerprint: string | null;
  series_id: string | null;
  location: {
    lat?: number;
    lng?: number;
    name?: string;
    municipality?: string;
    country_code?: string;
  } | null;
  series: { name?: string } | null;
};

/*
 * No `sources:event_sources(id)` here.
 *
 * Counting sources for every upcoming race took the query from 0.5 seconds to
 * 7.5 — fourteen times the cost, to put a number under two names. The count is
 * fetched afterwards for the few hundred races that actually end up in a pair.
 */
const COLUMNS =
  "id, name, start_date, end_date, disciplines, website_url, registration_url, fingerprint, series_id, location:locations(lat, lng, name, municipality, country_code), series:series(name)";

/** PostgREST answers at most a thousand rows however large the limit is. */
const PAGE = 1000;

function side(row: Row): SuspiciousSide {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    disciplines: row.disciplines ?? [],
    series: row.series?.name ?? null,
    websiteUrl: row.website_url,
    registrationUrl: row.registration_url,
    sources: 0,
  };
}

function asDedup(row: Row) {
  const loc = row.location;
  return {
    startDate: row.start_date,
    endDate: row.end_date,
    name: row.name,
    lat: loc?.lat,
    lng: loc?.lng,
    placeText: loc?.municipality || loc?.name,
    seriesName: row.series?.name,
    fingerprint: row.fingerprint ?? undefined,
    urls: [row.website_url, row.registration_url],
    disciplines: row.disciplines,
  };
}

export type SuspiciousFilters = {
  fromDate?: string;
  toDate?: string;
  country?: string;
  discipline?: string;
  limit?: number;
};

export async function listSuspiciousDuplicates(
  opts?: SuspiciousFilters,
): Promise<SuspiciousPair[]> {
  const supabase = createServerSupabase();
  const fromDate = opts?.fromDate || new Date().toISOString().slice(0, 10);

  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from("events")
      .select(COLUMNS)
      .eq("visibility", "public")
      .in("status", ["scheduled", "tbc", "postponed", "registration_open"])
      .gte("start_date", fromDate);
    if (opts?.toDate) query = query.lte("start_date", opts.toDate);
    if (opts?.discipline) query = query.contains("disciplines", [opts.discipline]);
    const { data } = await query
      .order("start_date", { ascending: true })
      .range(from, from + PAGE - 1);
    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < PAGE || rows.length >= 6000) break;
  }

  const { data: reviewed } = await supabase
    .from("duplicate_reviews")
    .select("left_id, right_id");
  const dismissed = new Set(
    (reviewed ?? []).map((r) => `${r.left_id as string}:${r.right_id as string}`),
  );

  // Index by every day a race occupies, so a Saturday–Sunday listing still meets
  // the single-day mirror of its Sunday.
  const byDay = new Map<string, Row[]>();
  for (const row of rows) {
    for (const day of spanDays({ startDate: row.start_date, endDate: row.end_date })) {
      const list = byDay.get(day) ?? [];
      list.push(row);
      byDay.set(day, list);
    }
  }

  const country = (opts?.country || "").toUpperCase();
  const pairs = new Map<string, SuspiciousPair>();
  for (const [day, here] of byDay) {
    for (let i = 0; i < here.length; i++) {
      for (let j = i + 1; j < here.length; j++) {
        const a = here[i]!;
        const b = here[j]!;
        if (country && (a.location?.country_code ?? "").toUpperCase() !== country) continue;
        if (!sharesDisciplineFamily(a.disciplines, b.disciplines)) continue;
        const { score, reasons } = scoreDuplicate(asDedup(a), asDedup(b));
        if (!reasons.includes("same_place")) continue;
        if (!reasons.includes("same_discipline")) continue;
        // Anything the merger would take itself is not a question for a person.
        if (score >= DEDUP_THRESHOLD) continue;

        const [left, right] = a.id < b.id ? [a, b] : [b, a];
        const key = `${left.id}:${right.id}`;
        if (dismissed.has(key) || pairs.has(key)) continue;
        pairs.set(key, {
          key,
          date: day,
          place: a.location?.municipality || a.location?.name || "—",
          discipline: (a.disciplines ?? [])[0] ?? "—",
          country: a.location?.country_code ?? null,
          left: side(left),
          right: side(right),
          reasons,
        });
      }
    }
  }

  const shortlist = [...pairs.values()]
    .sort((x, y) => x.date.localeCompare(y.date) || x.place.localeCompare(y.place))
    .slice(0, opts?.limit ?? 200);

  // How many calendars list each race is the strongest hint about which of two
  // rows to keep, so it is worth one more query — but only for the few hundred
  // races that reached the list, not for every race in the season.
  const ids = [...new Set(shortlist.flatMap((p) => [p.left.id, p.right.id]))];
  if (ids.length) {
    const counts = new Map<string, number>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabase
        .from("event_sources")
        .select("event_id")
        .in("event_id", ids.slice(i, i + 200));
      for (const row of data ?? []) {
        const id = row.event_id as string;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    for (const pair of shortlist) {
      pair.left.sources = counts.get(pair.left.id) ?? 0;
      pair.right.sources = counts.get(pair.right.id) ?? 0;
    }
  }

  return shortlist;
}

/** Remember that a pair is two races, so it stops coming back. */
export async function dismissSuspiciousPair(leftId: string, rightId: string) {
  const supabase = createServerSupabase();
  const [left, right] = leftId < rightId ? [leftId, rightId] : [rightId, leftId];
  const { error } = await supabase
    .from("duplicate_reviews")
    .upsert({ left_id: left, right_id: right, verdict: "separate" }, { onConflict: "left_id,right_id" });
  if (error) throw new Error(error.message);
}
