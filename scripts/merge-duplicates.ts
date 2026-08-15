/**
 * Merge public events that the soft-dedup scorer considers the same race.
 * Usage: nvm use 22 && npx tsx scripts/merge-duplicates.ts
 *        nvm use 22 && npx tsx scripts/merge-duplicates.ts --dry
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import {
  distanceKm,
  preferEventName,
  scoreDuplicate,
  type DedupEvent,
} from "../src/lib/dedup";

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

const DRY = process.argv.includes("--dry");

type Row = {
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
  sources: { id: string; watched_url_id: string | null; external_id: string | null }[] | null;
};

function asDedup(row: Row): DedupEvent {
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

function formatTagConflict(a: string, b: string): boolean {
  const ta = a.match(FORMAT_TAG)?.[1]?.toLowerCase();
  const tb = b.match(FORMAT_TAG)?.[1]?.toLowerCase();
  if (!ta || !tb || ta === tb) return false;
  // "MTB" is a family label — compatible with XCO/XCC/etc., not with MTBO/CX/road.
  if (ta === "mtb" && MTB_FORMATS.has(tb) && tb !== "mtbo") return false;
  if (tb === "mtb" && MTB_FORMATS.has(ta) && ta !== "mtbo") return false;
  return true;
}

function hasRoundNumber(name: string): boolean {
  return /(?:^|\s)(?:#|rd\.?|round|kolo|etapa|stage|leg)\s*\d{1,2}\b|\d{1,2}\.\s*(?:kolo|etapa|round|čp|cp)\b/i.test(
    name,
  );
}

function isJunkPair(a: Row, b: Row): boolean {
  if (JUNK_LISTING.test(a.name) || JUNK_LISTING.test(b.name)) return true;
  const kidsA = /\bkids\b/i.test(a.name);
  const kidsB = /\bkids\b/i.test(b.name);
  if (kidsA !== kidsB) return true;
  const ttA = /časovka|\btt\b|time.?trial/i.test(a.name);
  const ttB = /časovka|\btt\b|time.?trial/i.test(b.name);
  if (ttA !== ttB) return true;
  if (roundConflict(a.name, b.name)) return true;
  if (formatTagConflict(a.name, b.name)) return true;
  const tagA = a.name.match(FORMAT_TAG)?.[1]?.toLowerCase();
  const tagB = b.name.match(FORMAT_TAG)?.[1]?.toLowerCase();
  // Same venue weekend can host XCO + MTB as separate listings — only merge same day.
  if (a.start_date !== b.start_date && tagA && tagB && tagA !== tagB) return true;
  // Don't absorb a numbered round into a generic series label on another day.
  if (
    a.start_date !== b.start_date &&
    hasRoundNumber(a.name) !== hasRoundNumber(b.name)
  ) {
    return true;
  }
  // Stage/multi-day listings on adjacent days are usually distinct stages, not clones.
  if (
    a.start_date !== b.start_date &&
    (STAGE_RACE.test(a.name) || STAGE_RACE.test(b.name))
  ) {
    return true;
  }
  const la = a.location?.lat;
  const ln = a.location?.lng;
  const lb = b.location?.lat;
  const lo = b.location?.lng;
  if (la != null && ln != null && lb != null && lo != null) {
    if (distanceKm({ lat: la, lng: ln }, { lat: lb, lng: lo }) > 10) return true;
  }
  return false;
}

function roundConflict(a: string, b: string): boolean {
  const roundRe =
    /(?:^|\s)(?:#|rd\.?|round|kolo|etapa|stage|leg)\s*(\d{1,2})\b|(\d{1,2})\.\s*(?:kolo|etapa|round|čp|cp)\b/gi;
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

function winner(a: Row, b: Row): Row {
  const score = (r: Row) =>
    (r.website_url ? 50 : 0) +
    (r.series_id ? 30 : 0) +
    (r.sources?.length ?? 0) * 5 +
    (preferEventName(r.name, a.name === r.name ? b.name : a.name) === r.name ? 8 : 0);
  return score(a) >= score(b) ? a : b;
}

async function main() {
  const supabase = createServerSupabase();
  const rows: Row[] = [];
  for (let from = 0; from < 12000; from += 1000) {
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, name, start_date, end_date, website_url, registration_url, series_id, fingerprint, location:locations(lat, lng, name, municipality), series:series(name), sources:event_sources(id, watched_url_id, external_id)",
      )
      .eq("visibility", "public")
      .in("status", ["scheduled", "tbc", "postponed", "registration_open"])
      .gte("start_date", "2026-01-01")
      .order("start_date", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    const chunk = (data ?? []) as unknown as Row[];
    rows.push(...chunk);
    if (chunk.length < 1000) break;
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

  const byDay = new Map<string, Row[]>();
  for (const row of rows) {
    const d = row.start_date.slice(0, 10);
    const list = byDay.get(d) ?? [];
    list.push(row);
    byDay.set(d, list);
  }

  let compared = 0;
  for (const here of byDay.values()) {
    for (const a of here) {
      for (const b of here) {
        if (a.id >= b.id) continue;
        compared += 1;
        const { score, reasons } = scoreDuplicate(asDedup(a), asDedup(b));
        if (score < 50) continue;
        const nameOk =
          reasons.includes("same_canonical_name") ||
          reasons.includes("name_sim_high") ||
          (reasons.includes("name_substring") && reasons.includes("name_sim_mid")) ||
          reasons.includes("weak_name_absorbed");
        if (!reasons.includes("same_day") || !reasons.includes("same_place") || !nameOk) continue;
        if (isJunkPair(a, b)) continue;
        unite(a.id, b.id);
      }
    }
  }

  const clusteredIds = new Set<string>([...parent.keys(), ...parent.values()]);
  const clusters = new Map<string, Row[]>();
  for (const row of rows) {
    if (!clusteredIds.has(row.id)) continue;
    const root = find(row.id);
    const list = clusters.get(root) ?? [];
    list.push(row);
    clusters.set(root, list);
  }

  const merges: { keep: Row; drop: Row; reasons: string[] }[] = [];
  for (const list of clusters.values()) {
    const uniq = [...new Map(list.map((r) => [r.id, r])).values()];
    if (uniq.length < 2) continue;
    const keep = uniq.reduce((a, b) => winner(a, b));
    for (const drop of uniq) {
      if (drop.id === keep.id) continue;
      const { reasons } = scoreDuplicate(asDedup(keep), asDedup(drop));
      merges.push({ keep, drop, reasons });
    }
  }

  // Same official website + similar name within ±21 days → date-scrape clones
  const byWebsite = new Map<string, Row[]>();
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
        const days =
          Math.abs(
            (Date.parse(a.start_date) - Date.parse(b.start_date)) / (24 * 60 * 60 * 1000),
          );
        if (days > 21) continue;
        const { score, reasons } = scoreDuplicate(asDedup(a), asDedup(b));
        const nameClose =
          reasons.includes("same_canonical_name") ||
          reasons.includes("name_sim_high") ||
          (reasons.includes("name_substring") && reasons.includes("series_alias"));
        // Website clones must be clearly the same race — not adjacent series rounds.
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

  console.log({ events: rows.length, compared, pairs: merges.length, dry: DRY });
  for (const m of merges) {
    console.log(
      `${DRY ? "DRY" : "MERGE"} ${m.drop.start_date}  ${m.keep.name}  ←  ${m.drop.name}  [${m.reasons.join(",")}]`,
    );
    if (DRY) continue;

    const { data: dropSources } = await supabase
      .from("event_sources")
      .select("id, watched_url_id, external_id, source_url, kind")
      .eq("event_id", m.drop.id);

    for (const src of dropSources ?? []) {
      const { error: moveErr } = await supabase
        .from("event_sources")
        .update({ event_id: m.keep.id })
        .eq("id", src.id);
      if (moveErr) {
        await supabase.from("event_sources").delete().eq("id", src.id);
      }
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (!m.keep.website_url && m.drop.website_url) patch.website_url = m.drop.website_url;
    if (!m.keep.registration_url && m.drop.registration_url) {
      patch.registration_url = m.drop.registration_url;
    }
    if (!m.keep.series_id && m.drop.series_id) patch.series_id = m.drop.series_id;
    const better = preferEventName(m.keep.name, m.drop.name);
    if (better !== m.keep.name) patch.name = better;
    if (Object.keys(patch).length > 1) {
      await supabase.from("events").update(patch).eq("id", m.keep.id);
    }

    await supabase
      .from("events")
      .update({
        visibility: "hidden",
        status: "hidden",
        updated_at: new Date().toISOString(),
      })
      .eq("id", m.drop.id);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
