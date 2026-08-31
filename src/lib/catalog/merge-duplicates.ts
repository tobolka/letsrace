import { createServerSupabase } from "@/lib/supabase/server";
import {
  DEDUP_THRESHOLD,
  distanceKm,
  preferEventName,
  scoreDuplicate,
  spanDays,
  canonicalizeForDedup,
  isGarbagePlace,
  type DedupEvent,
} from "@/lib/dedup";

export type MergeDuplicateRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  website_url: string | null;
  registration_url: string | null;
  series_id: string | null;
  fingerprint: string | null;
  location: { lat?: number; lng?: number; name?: string; municipality?: string } | null;
  series: { name?: string } | null;
  sources?: { id: string; watched_url_id: string | null; external_id: string | null }[] | null;
};

function asDedup(row: MergeDuplicateRow): DedupEvent {
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
  };
}

const JUNK_LISTING =
  /partne|proběhl|d[eě]tsk[eé]\s+z[aá]vody|kategorie prestige|junior trophy|hynek\s*musil/i;

const STAGE_RACE =
  /trilogy|etapov|stage\s*race|v[ií]cedenn|multi[- ]?day|3[- ]?day|t[rř][ií]denn/i;

const FORMAT_TAG = /\b(xco|xcc|xcm|dhi|dh|enduro|cx|road|gravel|mtbo?)\b/i;

const MTB_FORMATS = new Set(["xco", "xcc", "xcm", "dhi", "dh", "enduro", "mtb"]);

function foldName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const ORDINAL_CONFLICT =
  /\b(prvn[ií]|druh[yýeé]|tret[ií]|ctvrt[yýeé]|pat[eé]|sest[yýeé]|n[°º]?\s*\d+|no\.?\s*\d+|i{1,3}v?|vi{0,3})\.(?=\s|$)/gi;

function ordinalConflict(a: string, b: string): boolean {
  const nums = (s: string) => {
    const out = new Set<string>();
    for (const m of foldName(s).matchAll(ORDINAL_CONFLICT)) {
      out.add(m[0]!.replace(/\s+/g, ""));
    }
    // Also catch "1.kolo" / "2. kolo" style already handled by roundConflict;
    // pick bare "první/třetí" series listings.
    return out;
  };
  const aa = nums(a);
  const bb = nums(b);
  if (!aa.size || !bb.size) return false;
  for (const n of aa) if (bb.has(n)) return false;
  return true;
}

function formatTagConflict(a: string, b: string): boolean {
  const ta = a.match(FORMAT_TAG)?.[1]?.toLowerCase();
  const tb = b.match(FORMAT_TAG)?.[1]?.toLowerCase();
  if (!ta || !tb || ta === tb) return false;
  if (ta === "mtb" && MTB_FORMATS.has(tb) && tb !== "mtbo") return false;
  if (tb === "mtb" && MTB_FORMATS.has(ta) && ta !== "mtbo") return false;
  return true;
}

function hasRoundNumber(name: string): boolean {
  return /(?:^|\s)(?:#|rd\.?|round|kolo|etapa|stage|leg)\s*\d{1,2}\b|\d{1,2}\.?\s*(?:kolo|etapa|round|čp|cp)\b/i.test(
    name,
  );
}

function roundConflict(a: string, b: string): boolean {
  const roundRe =
    /(?:^|\s)(?:#|rd\.?|round|kolo|etapa|stage|leg)\s*(\d{1,2})\b|(\d{1,2})\.?\s*(?:kolo|etapa|round|čp|cp)\b/gi;
  const nums = (s: string) => {
    const out = new Set<string>();
    for (const m of s.matchAll(roundRe)) {
      out.add(m[1] || m[2] || "");
    }
    return out;
  };
  const aa = nums(a);
  const bb = nums(b);
  if (!aa.size || !bb.size) return false;
  for (const n of aa) if (bb.has(n)) return false;
  return true;
}

function dateSpansOverlap(a: MergeDuplicateRow, b: MergeDuplicateRow): boolean {
  const day = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return Date.UTC(y!, m! - 1, d!) / 86_400_000;
  };
  const a0 = day(a.start_date);
  const a1 = day(a.end_date || a.start_date);
  const b0 = day(b.start_date);
  const b1 = day(b.end_date || b.start_date);
  const lo = Math.min(a0, a1);
  const hi = Math.max(a0, a1);
  const lo2 = Math.min(b0, b1);
  const hi2 = Math.max(b0, b1);
  return !(hi < lo2 || hi2 < lo);
}

/**
 * An e-bike heat is its own race, run on the same course on the same day as the
 * analogue one. The scorer sees one extra word and calls them the same event.
 */
const EBIKE = /\be-?\s?bike\b|\bebike\b|\be-?mtb\b|\bpedelec\b/i;

/**
 * Non-competitive rides share a venue and a date with the race they accompany —
 * FCI lists "MYTHOS PRIMIERO PEDALATA ECOLOGICA" beside the Masters World
 * Championship XCM at the same place. Merging them loses the championship.
 */
const RIDE_NOT_RACE =
  /\bpedalata|ciclopedalata|cicloturistic|cicloraduno|biciclettata|randonn|escursionistic|gioco\s+ciclismo|gi?[mn]kana/i;

/**
 * FCI appends the age/gender class to the race name, so one memorial appears as
 * several races on one day — "18° MEMORIAL PARMALIANA" and the same memorial
 * "-ALLIEVI". They share a venue and a date and are still different races.
 */
const IT_CATEGORY =
  /\b(allievi|esordienti|giovanissimi|juniores?|donne|master|amatori|elite\s?sport|open)\b/i;

/**
 * Two titles that name different races even at one venue on one day.
 *
 * Each marker below cost a real race before it was added: an e-bike heat, a
 * recreational ride beside the Masters World Championship, an FCI category
 * variant of the same memorial.
 */
/**
 * A shared series prefix followed by two different specifics.
 *
 * "Jarní Bahno — Goethovka" and "Jarní Bahno — Linhart" run on one day, in one
 * series, and geocode to the same town — everything the same-round rule looks
 * at agrees, and they are still two races at two venues. When both titles
 * continue past their common prefix and continue differently, that difference
 * is the race, not noise. One title merely being shorter is not a conflict:
 * "NMNM" is "ČP MTB — NMNM — Vysočina aréna" with less said.
 */
function distinctSuffixAfterSharedPrefix(a: string, b: string): boolean {
  const split = (s: string) =>
    foldName(s)
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
  const ta = split(a);
  const tb = split(b);
  let i = 0;
  while (i < ta.length && i < tb.length && ta[i] === tb[i]) i += 1;
  if (i < 2) return false;
  const restA = ta.slice(i);
  const restB = tb.slice(i);
  if (!restA.length || !restB.length) return false;
  return restA[0] !== restB[0];
}

/**
 * A national championship co-located with an ordinary round of the same series.
 *
 * Slovak and Czech organisers run "Majstrovstvá Slovenska" on the same day and
 * course as a UCI C1/C2 GP. They share a venue, a date and a series and are
 * still two races with two results sheets.
 */
const CHAMPIONSHIP =
  /\bmistrovstv|majstrovstv[aá]|\bm[cč]r\b|\bmsr\b|national\s+champ|championship|meisterschaft|campionato\s+italiano|mistrzostwa/i;

export function isSeparateRace(a: string, b: string): boolean {
  if (EBIKE.test(a) !== EBIKE.test(b)) return true;
  if (CHAMPIONSHIP.test(a) !== CHAMPIONSHIP.test(b)) return true;
  if (distinctSuffixAfterSharedPrefix(a, b)) return true;
  if (IT_CATEGORY.test(a) !== IT_CATEGORY.test(b)) return true;
  if (RIDE_NOT_RACE.test(a) !== RIDE_NOT_RACE.test(b)) return true;
  return false;
}

function isJunkPair(a: MergeDuplicateRow, b: MergeDuplicateRow): boolean {
  if (JUNK_LISTING.test(a.name) || JUNK_LISTING.test(b.name)) return true;
  if (isSeparateRace(a.name, b.name)) return true;
  const kidsA = /\bkids\b/i.test(a.name);
  const kidsB = /\bkids\b/i.test(b.name);
  if (kidsA !== kidsB) return true;
  const ttA = /časovka|\btt\b|time.?trial/i.test(a.name);
  const ttB = /časovka|\btt\b|time.?trial/i.test(b.name);
  if (ttA !== ttB) return true;
  if (roundConflict(a.name, b.name)) return true;
  if (ordinalConflict(a.name, b.name)) return true;
  if (formatTagConflict(a.name, b.name)) return true;
  const roadA = /\broad\b|silni[cč]/i.test(a.name);
  const roadB = /\broad\b|silni[cč]/i.test(b.name);
  if (roadA !== roadB) return true;
  // Use the same comparison as above: `mtb` is the parent of `xco`, so a title
  // saying "ČP MTB" and one saying "Český pohár XCO" name one race, not two.
  // Comparing the raw tags here kept a Nové Město round split in half.
  if (a.start_date !== b.start_date && formatTagConflict(a.name, b.name)) return true;
  if (a.start_date !== b.start_date && hasRoundNumber(a.name) !== hasRoundNumber(b.name)) {
    return true;
  }
  if (
    a.start_date !== b.start_date &&
    (STAGE_RACE.test(a.name) || STAGE_RACE.test(b.name))
  ) {
    return true;
  }
  // Adjacent single-day listings of the same cup (Sat + Sun rounds) — only merge
  // when one row's date span covers the other (true multi-day listing mirror).
  if (a.start_date !== b.start_date && !dateSpansOverlap(a, b)) return true;
  // Overlapping end_dates on consecutive starts with identical titles are usually
  // stage-race days (e.g. RiderMan Sat+Sun), not a duplicate listing.
  if (
    a.start_date !== b.start_date &&
    dateSpansOverlap(a, b) &&
    canonicalizeForDedup(a.name) === canonicalizeForDedup(b.name) &&
    a.end_date &&
    b.end_date &&
    a.end_date !== a.start_date &&
    b.end_date !== b.start_date
  ) {
    return true;
  }
  const la = a.location?.lat;
  const ln = a.location?.lng;
  const lb = b.location?.lat;
  const lo = b.location?.lng;
  const garbagePlace =
    isGarbagePlace(a.location?.municipality || a.location?.name) ||
    isGarbagePlace(b.location?.municipality || b.location?.name);
  if (!garbagePlace && la != null && ln != null && lb != null && lo != null) {
    if (distanceKm({ lat: la, lng: ln }, { lat: lb, lng: lo }) > 10) return true;
  }
  return false;
}

function winner(a: MergeDuplicateRow, b: MergeDuplicateRow): MergeDuplicateRow {
  const urlScore = (url: string | null) => {
    if (!url) return 0;
    try {
      const u = new URL(url);
      const path = u.pathname.replace(/\/+$/, "");
      if (!path || path === "/") return 10;
      return 50 + Math.min(40, path.split("/").filter(Boolean).length * 10);
    } catch {
      return 10;
    }
  };
  const score = (r: MergeDuplicateRow) =>
    urlScore(r.website_url) +
    (r.registration_url ? 40 : 0) +
    (r.series_id ? 30 : 0) +
    (r.sources?.length ?? 0) * 5 +
    (preferEventName(r.name, r === a ? b.name : a.name) === r.name ? 8 : 0);
  return score(a) >= score(b) ? a : b;
}

export async function mergePublicDuplicates(opts?: {
  dry?: boolean;
  fromDate?: string;
  maxMerges?: number;
}): Promise<{
  events: number;
  pairs: number;
  merged: number;
  dry: boolean;
  preview: { date: string; keep: string; drop: string; reasons: string[] }[];
}> {
  const supabase = createServerSupabase();
  const dry = opts?.dry ?? false;
  const fromDate = opts?.fromDate ?? new Date().toISOString().slice(0, 10);
  const maxMerges = opts?.maxMerges ?? Number.POSITIVE_INFINITY;

  const rows: MergeDuplicateRow[] = [];
  for (let from = 0; from < 12000; from += 1000) {
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, name, start_date, end_date, website_url, registration_url, series_id, fingerprint, location:locations(lat, lng, name, municipality), series:series(name)",
      )
      .eq("visibility", "public")
      .in("status", ["scheduled", "tbc", "postponed", "registration_open"])
      .gte("start_date", fromDate)
      .order("start_date", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    const chunk = (data ?? []) as unknown as MergeDuplicateRow[];
    rows.push(...chunk);
    if (chunk.length < 1000) break;
  }

  // Multi-day races that began before the window but still run into it: their
  // single-day mirrors are inside the window, so both halves have to be present.
  const { data: ongoing } = await supabase
    .from("events")
    .select(
      "id, name, start_date, end_date, website_url, registration_url, series_id, fingerprint, location:locations(lat, lng, name, municipality), series:series(name)",
    )
    .eq("visibility", "public")
    .in("status", ["scheduled", "tbc", "postponed", "registration_open"])
    .lt("start_date", fromDate)
    .gte("end_date", fromDate)
    .limit(500);
  const seen = new Set(rows.map((r) => r.id));
  for (const row of (ongoing ?? []) as unknown as MergeDuplicateRow[]) {
    if (!seen.has(row.id)) rows.push(row);
  }

  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const p = parent.get(id);
    if (!p || p === id) return id;
    const r = find(p);
    parent.set(id, r);
    return r;
  };
  const unite = (a: string, b: string) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent.set(pa, pb);
  };

  // Index each row under every day it occupies. A Fri–Sun stage listing has to
  // meet the Sunday-only mirror of the same race, which a start_date-only bucket
  // (plus one adjacent day) never reaches.
  const byDay = new Map<string, MergeDuplicateRow[]>();
  for (const row of rows) {
    for (const d of spanDays({ startDate: row.start_date, endDate: row.end_date })) {
      const list = byDay.get(d) ?? [];
      list.push(row);
      byDay.set(d, list);
    }
  }

  const considerPair = (a: MergeDuplicateRow, b: MergeDuplicateRow) => {
    if (a.id === b.id) return;
    const left = a.id < b.id ? a : b;
    const right = a.id < b.id ? b : a;
    const { score, reasons } = scoreDuplicate(asDedup(left), asDedup(right));
    if (score < 50) return;
    const dayOk = reasons.includes("same_day") || reasons.includes("weekend");

    /**
     * One venue, one series, one weekend — the same race, whatever the titles say.
     *
     * Sources name a cup round after the series, the venue, the arena or nothing
     * at all: "ČP MTB — NMNM — Vysočina aréna", "Czech MTB Cup", "NMNM" and
     * "Český pohár XCO Bedřichov" were four listings of one Nové Město round,
     * and the name gate below rejected every pairing because none of them looks
     * like any other. Title similarity cannot resolve that; the series and the
     * start line can.
     *
     * The junk guards still run underneath. They are what keeps this from
     * eating the cases that genuinely share a venue and a day — an e-bike heat,
     * a category variant, a recreational ride beside a championship.
     */
    const sameSeriesRound =
      Boolean(a.series_id) &&
      a.series_id === b.series_id &&
      reasons.includes("same_place") &&
      // Overlapping spans, not identical start dates: a two-day cup round meets
      // the single-day listing of its Sunday. Adjacent-but-separate days stay
      // apart, which is what keeps two Skočice races on the 25th and 26th
      // from collapsing into one.
      dateSpansOverlap(a, b);

    const nameOk =
      reasons.includes("same_canonical_name") ||
      reasons.includes("name_sim_high") ||
      (reasons.includes("name_substring") && reasons.includes("name_sim_mid")) ||
      reasons.includes("weak_name_absorbed") ||
      reasons.includes("venue_format_mirror") ||
      sameSeriesRound;
    // Weekend mirrors need a strong title match — series alone is too loose.
    if (
      reasons.includes("weekend") &&
      !reasons.includes("same_day") &&
      !reasons.includes("same_canonical_name") &&
      !reasons.includes("name_sim_high") &&
      !sameSeriesRound
    ) {
      return;
    }
    // Same-series + mid similarity without a shared title core is too loose
    // (e.g. two Bahno venues, Bedřichov vs NMNM with bad coords).
    if (
      reasons.includes("series_alias") &&
      !reasons.includes("same_canonical_name") &&
      !reasons.includes("name_sim_high") &&
      !(reasons.includes("name_substring") && reasons.includes("name_sim_mid")) &&
      !sameSeriesRound
    ) {
      return;
    }
    if (!dayOk || !reasons.includes("same_place") || !nameOk) return;
    if (isJunkPair(left, right)) return;
    unite(left.id, right.id);
  };

  const days = [...byDay.keys()].sort();
  for (let i = 0; i < days.length; i++) {
    const day = days[i]!;
    const here = byDay.get(day) ?? [];
    for (const a of here) {
      for (const b of here) considerPair(a, b);
    }
    // Adjacent start days (multi-day race listed as Fri–Sat vs Sat-only).
    const next = days[i + 1];
    if (!next) continue;
    const gap =
      (Date.parse(`${next}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) /
      (24 * 60 * 60 * 1000);
    if (gap > 1) continue;
    const there = byDay.get(next) ?? [];
    for (const a of here) {
      for (const b of there) considerPair(a, b);
    }
  }

  const clusteredIds = new Set<string>([...parent.keys(), ...parent.values()]);
  const clusters = new Map<string, MergeDuplicateRow[]>();
  for (const row of rows) {
    if (!clusteredIds.has(row.id)) continue;
    const root = find(row.id);
    const list = clusters.get(root) ?? [];
    list.push(row);
    clusters.set(root, list);
  }

  const merges: { keep: MergeDuplicateRow; drop: MergeDuplicateRow; reasons: string[] }[] = [];
  for (const list of clusters.values()) {
    // Union-find is transitive, the scorer is not: A~B and B~C does not make A~C.
    // Members that fail the direct re-check against the keeper used to be dropped
    // on the floor and stayed duplicates forever — re-cluster them instead, so a
    // chain resolves into as many merges as the scorer actually supports.
    let pool = [...new Map(list.map((r) => [r.id, r])).values()];
    while (pool.length > 1) {
      const keep = pool.reduce((a, b) => winner(a, b));
      const rest: MergeDuplicateRow[] = [];
      for (const drop of pool) {
        if (drop.id === keep.id) continue;
        const { score, reasons } = scoreDuplicate(asDedup(keep), asDedup(drop));
        if (score < DEDUP_THRESHOLD || isJunkPair(keep, drop)) {
          rest.push(drop);
          continue;
        }
        merges.push({ keep, drop, reasons });
      }
      pool = rest;
    }
  }

  const byWebsite = new Map<string, MergeDuplicateRow[]>();
  for (const row of rows) {
    const url = (row.website_url || "").trim().toLowerCase().replace(/\/$/, "");
    if (!url || url.length < 16) continue;
    const list = byWebsite.get(url) ?? [];
    list.push(row);
    byWebsite.set(url, list);
  }
  const already = new Set(merges.flatMap((m) => [m.keep.id, m.drop.id]));
  for (const group of byWebsite.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.start_date.localeCompare(b.start_date));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i]!;
        const b = sorted[j]!;
        if (already.has(a.id) && already.has(b.id)) continue;
        const days = Math.abs(
          (Date.parse(a.start_date) - Date.parse(b.start_date)) / (24 * 60 * 60 * 1000),
        );
        if (days > 2) continue;
        // A shared website is how a series links all its rounds, so on different
        // days it says nothing: "XCO Knínice" and "Pohár Drahanské vrchoviny —
        // Benešov" are two villages one round apart. Only identical titles may
        // span days here.
        if (days > 0 && a.name.trim().toLowerCase() !== b.name.trim().toLowerCase()) continue;
        const { reasons } = scoreDuplicate(asDedup(a), asDedup(b));
        const nameClose =
          reasons.includes("same_canonical_name") ||
          reasons.includes("name_sim_high");
        if (!nameClose) continue;
        if (isJunkPair(a, b)) continue;
        const keep = winner(a, b);
        const drop = keep.id === a.id ? b : a;
        if (merges.some((m) => m.drop.id === drop.id)) continue;
        merges.push({
          keep,
          drop,
          reasons: [...new Set([...reasons, "same_website", "near_date"])],
        });
        already.add(drop.id);
      }
    }
  }

  const toApply = merges.slice(0, Number.isFinite(maxMerges) ? maxMerges : merges.length);
  const preview = toApply.map((m) => ({
    date: m.drop.start_date,
    keep: m.keep.name,
    drop: m.drop.name,
    reasons: m.reasons,
  }));
  if (dry) {
    return { events: rows.length, pairs: merges.length, merged: 0, dry: true, preview };
  }

  let merged = 0;
  for (const m of toApply) {
    await applyMerge(supabase, m.keep, m.drop);
    merged += 1;
  }

  return { events: rows.length, pairs: merges.length, merged, dry: false, preview };
}

type MergeSide = Pick<
  MergeDuplicateRow,
  "id" | "name" | "website_url" | "registration_url" | "series_id"
> & { location?: { name?: string; municipality?: string } | null };

/** Fold `drop` into `keep`: move its sources and links across, then hide it. */
async function applyMerge(
  supabase: ReturnType<typeof createServerSupabase>,
  keep: MergeSide,
  drop: MergeSide,
) {
  const { data: dropSources } = await supabase
    .from("event_sources")
    .select("id, watched_url_id, external_id, source_url, kind")
    .eq("event_id", drop.id);

  for (const src of dropSources ?? []) {
    const { error: moveErr } = await supabase
      .from("event_sources")
      .update({ event_id: keep.id })
      .eq("id", src.id);
    if (moveErr) {
      // Unique (watched_url_id, external_id) already points at the keeper.
      await supabase.from("event_sources").delete().eq("id", src.id);
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (!keep.website_url && drop.website_url) patch.website_url = drop.website_url;
  if (!keep.registration_url && drop.registration_url) {
    patch.registration_url = drop.registration_url;
  }
  if (!keep.series_id && drop.series_id) patch.series_id = drop.series_id;
  const place = keep.location?.municipality || keep.location?.name || null;
  const better = preferEventName(keep.name, drop.name, place);
  if (better !== keep.name) patch.name = better;
  if (Object.keys(patch).length > 1) {
    await supabase.from("events").update(patch).eq("id", keep.id);
  }

  // Retire the loser's fingerprint. It is the watcher's identity key, so leaving
  // it intact would let a later fetch re-match onto the hidden row and resurrect
  // the duplicate — and it is what blocks the unique index on `events`.
  // The column is NOT NULL, so we mark it rather than clear it.
  await supabase
    .from("events")
    .update({
      visibility: "hidden",
      status: "hidden",
      fingerprint: `merged:${drop.id}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", drop.id);
}

/**
 * Collapse rows that share an exact fingerprint.
 *
 * A fingerprint is date + geohash-5 + normalized name, so a collision is the
 * same race by construction — the upsert's own identity check. Rows still get
 * in behind it because the watcher runs several sources concurrently and two
 * inserts can both miss each other's row. The scorer never cleans them up: it
 * only looks at upcoming dates, and it re-derives a similarity it does not need
 * when the identity key already matches.
 *
 * Runs across the whole catalog, not just the upcoming window.
 */
export async function collapseFingerprintCollisions(opts?: {
  dry?: boolean;
}): Promise<{ collisions: number; merged: number; dry: boolean; preview: string[] }> {
  const supabase = createServerSupabase();
  const dry = opts?.dry ?? false;

  type FpRow = MergeSide & {
    fingerprint: string | null;
    start_date: string;
    visibility: string | null;
  };
  const rows: FpRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("events")
      .select("id, name, start_date, fingerprint, visibility, website_url, registration_url, series_id")
      .order("start_date")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as FpRow[]));
    if (!data || data.length < 1000) break;
  }

  const byFingerprint = new Map<string, FpRow[]>();
  for (const row of rows) {
    if (!row.fingerprint) continue;
    const list = byFingerprint.get(row.fingerprint) ?? [];
    list.push(row);
    byFingerprint.set(row.fingerprint, list);
  }

  const preview: string[] = [];
  let collisions = 0;
  let merged = 0;
  for (const [fp, group] of byFingerprint) {
    if (group.length < 2) continue;
    collisions += 1;
    // Keep the row with the most to offer; a visible row always beats a hidden one.
    const rank = (r: FpRow) =>
      (r.visibility === "public" ? 1000 : 0) +
      (r.website_url ? 100 : 0) +
      (r.registration_url ? 100 : 0) +
      (r.series_id ? 50 : 0);
    const keep = group.reduce((a, b) => (rank(a) >= rank(b) ? a : b));
    for (const drop of group) {
      if (drop.id === keep.id) continue;
      preview.push(`${fp.slice(0, 56)} — keep "${keep.name.slice(0, 40)}" drop ${drop.id.slice(0, 8)}`);
      if (dry) continue;
      await applyMerge(supabase, keep, drop);
      merged += 1;
    }
  }

  return { collisions, merged, dry, preview };
}
