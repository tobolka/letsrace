/**
 * Link unlinked public events to known series, hide federated weekend
 * duplicates, collapse day-split listings.
 *
 * Usage: nvm use 22 && npx tsx scripts/cleanup-catalog.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import {
  isLikelyDuplicate,
  seriesAliasTokens,
  type DedupEvent,
} from "../src/lib/dedup";
import { isNonRaceEventName } from "../src/lib/event-visibility";
import { publicRaceUrl } from "../src/lib/watcher/public-url";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const val = m[2]!.replace(/^["']|["']$/g, "");
      if (!process.env[m[1]!]) process.env[m[1]!] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const WEAK_TOKENS = new Set([
  "series:world_cup",
  "series:uec",
  "series:bahno",
  "series:junior_cup",
]);

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type Loc = {
  name: string | null;
  country_code: string | null;
  lat: number | null;
  lng: number | null;
};

type Ev = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  series_id: string | null;
  website_url: string | null;
  location: Loc | Loc[] | null;
};

type SeriesRow = { id: string; slug: string; name: string };

function locOf(e: Ev): Loc {
  const raw = e.location;
  if (Array.isArray(raw)) return raw[0] ?? { name: null, country_code: null, lat: null, lng: null };
  return raw ?? { name: null, country_code: null, lat: null, lng: null };
}

function asDedup(e: Ev, seriesName?: string | null): DedupEvent {
  const loc = locOf(e);
  return {
    startDate: e.start_date,
    endDate: e.end_date,
    name: e.name,
    lat: loc.lat,
    lng: loc.lng,
    placeText: loc.name,
    seriesName: seriesName ?? null,
    urls: [e.website_url],
  };
}

async function main() {
  const supabase = createServerSupabase();

  const series: SeriesRow[] = [];
  {
    const { data, error } = await supabase
      .from("series")
      .select("id, slug, name")
      .eq("visibility", "public")
      .limit(2000);
    if (error) throw new Error(error.message);
    series.push(...((data ?? []) as SeriesRow[]));
  }

  const events: Ev[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, name, start_date, end_date, series_id, website_url, location:locations(name, country_code, lat, lng)",
      )
      .eq("visibility", "public")
      .gte("start_date", "2026-01-01")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Ev[];
    events.push(...rows);
    if (rows.length < 1000) break;
  }

  const byId = new Map(series.map((s) => [s.id, s]));
  const tokenToSeries = new Map<string, SeriesRow[]>();
  for (const s of series) {
    const tokens = seriesAliasTokens(`${s.name} ${s.slug.replace(/-/g, " ")}`).filter(
      (t) => !WEAK_TOKENS.has(t),
    );
    for (const t of tokens) {
      const list = tokenToSeries.get(t) ?? [];
      list.push(s);
      tokenToSeries.set(t, list);
    }
  }

  const linked = events.filter((e) => e.series_id);
  const unlinked = events.filter((e) => !e.series_id);

  let hiddenJunk = 0;
  let linkedN = 0;
  let collapsed = 0;
  let websites = 0;
  const hideIds = new Set<string>();

  for (const ev of unlinked) {
    if (isNonRaceEventName(ev.name) || ev.name.trim().length < 4) {
      hideIds.add(ev.id);
      hiddenJunk += 1;
      continue;
    }
    const a = asDedup(ev);
    const hit = linked.some((other) => {
      const s = other.series_id ? byId.get(other.series_id) : undefined;
      return isLikelyDuplicate(a, asDedup(other, s?.name));
    });
    if (hit) hideIds.add(ev.id);
  }
  const hiddenDup = hideIds.size - hiddenJunk;

  const remaining = unlinked.filter((e) => !hideIds.has(e.id));

  for (const ev of remaining) {
    const tokens = seriesAliasTokens(ev.name).filter((t) => !WEAK_TOKENS.has(t));
    const fromTokens = new Set<string>();
    for (const t of tokens) {
      for (const s of tokenToSeries.get(t) ?? []) fromTokens.add(s.id);
    }
    const folded = fold(ev.name);
    const fromName = series.filter((s) => {
      const n = fold(s.name);
      return n.length >= 10 && folded.includes(n);
    });
    const ids = new Set([...fromTokens, ...fromName.map((s) => s.id)]);
    if (ids.size !== 1) continue;
    const seriesId = [...ids][0]!;
    const { error } = await supabase
      .from("events")
      .update({ series_id: seriesId, updated_at: new Date().toISOString() })
      .eq("id", ev.id)
      .is("series_id", null);
    if (!error) {
      linkedN += 1;
      ev.series_id = seriesId;
    }
  }

  const still = remaining.filter((e) => !hideIds.has(e.id));
  const groups = new Map<string, Ev[]>();
  for (const ev of still) {
    if (hideIds.has(ev.id)) continue;
    const loc = locOf(ev);
    const key = `${fold(ev.name)}|${fold(loc.name || "").split(" ").slice(0, 2).join(" ")}|${loc.country_code || ""}`;
    const list = groups.get(key) ?? [];
    list.push(ev);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.start_date.localeCompare(b.start_date));
    let keep = list[0]!;
    for (let i = 1; i < list.length; i++) {
      const cur = list[i]!;
      const prevEnd = keep.end_date || keep.start_date;
      const gap =
        (Date.parse(`${cur.start_date}T12:00:00Z`) - Date.parse(`${prevEnd}T12:00:00Z`)) /
        86_400_000;
      if (gap <= 1) {
        hideIds.add(cur.id);
        collapsed += 1;
        const start = keep.start_date < cur.start_date ? keep.start_date : cur.start_date;
        const endA = keep.end_date || keep.start_date;
        const endB = cur.end_date || cur.start_date;
        const end = endA > endB ? endA : endB;
        if (start !== keep.start_date || end !== (keep.end_date || keep.start_date)) {
          await supabase
            .from("events")
            .update({
              start_date: start,
              end_date: end,
              updated_at: new Date().toISOString(),
            })
            .eq("id", keep.id);
          keep = { ...keep, start_date: start, end_date: end };
        }
      } else {
        keep = cur;
      }
    }
  }

  const hideList = [...hideIds];
  for (let i = 0; i < hideList.length; i += 80) {
    const chunk = hideList.slice(i, i + 80);
    await supabase
      .from("events")
      .update({ visibility: "hidden", updated_at: new Date().toISOString() })
      .in("id", chunk);
  }

  for (const ev of events) {
    if (hideIds.has(ev.id)) continue;
    const cleaned = publicRaceUrl(ev.website_url);
    if ((ev.website_url || null) !== cleaned) {
      await supabase
        .from("events")
        .update({ website_url: cleaned, updated_at: new Date().toISOString() })
        .eq("id", ev.id);
      websites += 1;
    }
  }

  console.log({
    scanned: events.length,
    unlinkedBefore: unlinked.length,
    hiddenDuplicates: hiddenDup,
    hiddenJunk,
    linkedToSeries: linkedN,
    collapsedDaySplits: collapsed,
    websitesCleared: websites,
  });

  const { geocodePendingFromGazetteer } = await import("../src/lib/geocode");
  const geo = await geocodePendingFromGazetteer();
  console.log({ gazetteer: geo });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
