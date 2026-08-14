/**
 * One-off: fill series taxonomy from linked events + names.
 * Usage: npx tsx scripts/backfill-series.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeName } from "../src/lib/domain";
import {
  audienceFromAgeCategories,
  inferClassification,
  inferSeriesSourceKind,
  inferSeriesType,
  isKidsPrimarySeries,
  type AgeCategory,
} from "../src/lib/taxonomy";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const val = m[2].replace(/^["']|["']$/g, "");
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

/** CSC generic buckets and empty stubs — keep rows, hide from public lists. */
const HIDDEN_SLUGS = new Set([
  "zavod",
  "uci-zavod",
  "dhi",
  "xcc",
  "xcr-xcc-e-dhi",
  "dhi-edr",
  "cp-mtb",
  "galaxy-serie",
]);

type SeriesRow = {
  id: string;
  slug: string;
  name: string;
  website_url: string | null;
  country_code: string | null;
};

type EventRow = {
  series_id: string;
  disciplines: string[] | null;
  age_categories: string[] | null;
  level: string | null;
  competition_type: string | null;
  season: string | null;
  last_seen_at: string | null;
  location: { country_code: string | null } | null;
};

function mode(values: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: string | undefined;
  let n = 0;
  for (const [k, c] of counts) {
    if (c > n) {
      best = k;
      n = c;
    }
  }
  return best;
}

function union(values: (string[] | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const list of values) {
    for (const v of list ?? []) if (v) out.add(v);
  }
  return [...out];
}

async function fetchAll<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  const page = 200;
  for (;;) {
    const res = await fetch(`${url}/rest/v1/${path}${path.includes("?") ? "&" : "?"}offset=${offset}&limit=${page}`, {
      headers,
    });
    if (!res.ok) throw new Error(`fetch ${res.status}: ${await res.text()}`);
    const chunk = (await res.json()) as T[];
    rows.push(...chunk);
    if (chunk.length < page) break;
    offset += page;
  }
  return rows;
}

async function main() {
  const series = await fetchAll<SeriesRow>(
    "series?select=id,slug,name,website_url,country_code&order=name",
  );
  const events = await fetchAll<EventRow>(
    "events?select=series_id,disciplines,age_categories,level,competition_type,season,last_seen_at,location:locations(country_code)&series_id=not.is.null",
  );

  const bySeries = new Map<string, EventRow[]>();
  for (const ev of events) {
    const list = bySeries.get(ev.series_id) ?? [];
    list.push(ev);
    bySeries.set(ev.series_id, list);
  }

  let updated = 0;
  let hidden = 0;
  for (const row of series) {
    const linked = bySeries.get(row.id) ?? [];
    const eventDisciplines = union(linked.map((e) => e.disciplines));
    const named = inferClassification({
      name: row.name,
      seriesName: row.name,
      seriesSlug: row.slug,
      disciplines: eventDisciplines,
      startDate: "2026-06-15",
    });
    const disciplinesAll = union([named.disciplines, ...linked.map((e) => e.disciplines)]);
    const ageCategories = union([named.ageCategories, ...linked.map((e) => e.age_categories)]);
    const seriesType = inferSeriesType({
      name: row.name,
      slug: row.slug,
      disciplines: disciplinesAll,
      ageCategories,
    });
    const visibility =
      HIDDEN_SLUGS.has(row.slug) || linked.length === 0 ? "hidden" : "public";
    const lastSeen = linked
      .map((e) => e.last_seen_at)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1);

    const eventLevel = mode(linked.map((e) => e.level ?? "")) || "local";
    const eventCompetition = mode(linked.map((e) => e.competition_type ?? "")) || "other";
    const level = named.level !== "local" ? named.level : eventLevel;
    const worldish = new Set([
      "world_cup",
      "world_championship",
      "european_championship",
      "continental",
      "international",
    ]);
    const payload: Record<string, unknown> = {
      name_normalized: normalizeName(row.name),
      disciplines: disciplinesAll,
      age_categories: ageCategories,
      series_type: seriesType,
      level,
      competition_type:
        named.competitionType !== "other" ? named.competitionType : eventCompetition,
      season:
        mode(linked.map((e) => e.season ?? "").filter((s) => s.includes("/"))) ||
        mode(linked.map((e) => e.season ?? "")) ||
        null,
      country_code: worldish.has(level)
        ? null
        : row.country_code || mode(linked.map((e) => e.location?.country_code ?? "")) || null,
      source_url: row.website_url,
      source_kind: inferSeriesSourceKind({
        name: row.name,
        slug: row.slug,
        url: row.website_url,
      }),
      visibility,
      updated_at: new Date().toISOString(),
    };
    if (ageCategories.length) {
      payload.audience_hint = audienceFromAgeCategories(ageCategories as AgeCategory[]);
    }
    if (isKidsPrimarySeries(`${row.name} ${row.slug}`)) {
      payload.audience_hint = "kids";
      if (!ageCategories.includes("kids")) {
        payload.age_categories = ["kids", ...ageCategories];
      }
    }
    if (lastSeen) payload.last_seen_at = lastSeen;

    const up = await fetch(`${url}/rest/v1/series?id=eq.${row.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });
    if (!up.ok) {
      console.error(row.slug, await up.text());
      continue;
    }
    updated += 1;
    if (visibility === "hidden") hidden += 1;
    console.log(
      `${row.slug.padEnd(28)} ${seriesType.padEnd(18)} ${String(payload.level).padEnd(14)} ${visibility} n=${linked.length}`,
    );
  }

  console.log(`Done. Updated ${updated} series (${hidden} hidden).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
