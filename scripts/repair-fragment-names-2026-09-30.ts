/**
 * Repair events named with a slice of page text instead of a race name.
 *
 * `scrape-doplnene-html-2026-09-17.ts` named each row with the ~100 characters
 * around a date on a calendar page ("> Sa, | 09.00&ndash;17.00 Uhr MUD MASTER
 * CYCLOCROSS Mittelk&auml;rnten von Mountain Sport Union Kl"), and the generic
 * extractor read cyklosvec.cz as UTF-8 and kept listing the shop itself as
 * "CYKLO�VEC s.r.o.". Where a dedup pass later folded the watcher's cleanly
 * named row into one of these, it kept the fragment's name.
 *
 * For each such row, in order:
 *   rename — to the best clean name among the rows merged into it, or one read
 *            back out of the fragment (entities decoded, Cycling Austria's
 *            "… Uhr <name> von <club>" layout);
 *   merge  — into a cleanly named row for the same race on the same date, when
 *            one already exists (a rename would only make a duplicate);
 *   hide   — when no name can be recovered.
 * Rows with an admin-locked name or visibility are left alone.
 *
 * Usage: npx tsx scripts/repair-fragment-names-2026-09-30.ts          # dry run
 *        npx tsx scripts/repair-fragment-names-2026-09-30.ts --apply
 *        … [--json plan.json]  writes the full plan
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as cheerio from "cheerio";

function loadEnv() {
  // Worktrees keep their .env.local in the main checkout, a few levels up.
  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    const file = resolve(dir, ".env.local");
    if (existsSync(file)) {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
      }
      return;
    }
    if (dirname(dir) === dir) return;
  }
}
loadEnv();

const APPLY = process.argv.includes("--apply");
const jsonIdx = process.argv.indexOf("--json");
const JSON_OUT = jsonIdx >= 0 ? process.argv[jsonIdx + 1] : null;
const TODAY = new Date().toISOString().slice(0, 10);
const UPDATED_BY = "repair-fragment-names-2026-09-30";

type Row = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  visibility: string | null;
  status: string | null;
  source_kind: string | null;
  created_at: string;
  competition_type: string | null;
  level: string | null;
  series_id: string | null;
  merged_into_id: string | null;
};

type Action =
  | { kind: "rename"; to: string; via: "merged" | "fragment" }
  | { kind: "merge"; into: Row; via: string }
  | { kind: "hide" }
  | { kind: "skip"; why: string };

type Plan = { row: Row; reason: string; action: Action };

function decodeEntities(s: string): string {
  return cheerio.load(`<p>${s.replace(/</g, "&lt;")}</p>`)("p").text();
}

/** Read a race name back out of a fragment, or give up. */
function recoverFromFragment(raw: string): string | null {
  const text = decodeEntities(raw).replace(/\s+/g, " ").trim();
  if (text.includes("�")) return null;
  // Cycling Austria event card: "Sa, 31. Oktober 2026 | 09.00–17.00 Uhr <name> von <club>".
  const at = text.match(/\bUhr\s+(.+?)\s+von\s+\S/);
  if (at?.[1]) return at[1].trim();
  return null;
}

function usableName(name: string | null | undefined, looksLikeTextFragment: (n: string) => boolean) {
  if (!name) return false;
  const n = name.trim();
  return n.length >= 4 && n.length <= 90 && !looksLikeTextFragment(n);
}

async function readAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

async function main() {
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { looksLikeTextFragment } = await import("../src/lib/text");
  const { preferEventName, nameSimilarity, canonicalizeForDedup } = await import("../src/lib/dedup");
  const { normalizeName } = await import("../src/lib/domain");
  const { mergeEventPair } = await import("../src/lib/catalog/merge-duplicates");
  const sb = createServerSupabase();

  const cols =
    "id, name, start_date, end_date, visibility, status, source_kind, created_at, competition_type, level, series_id, merged_into_id";
  const all = await readAll<Row>((a, b) =>
    sb.from("events").select(cols).order("id").range(a, b),
  );
  const sourced = new Set(
    (
      await readAll<{ event_id: string }>((a, b) =>
        sb.from("event_sources").select("event_id").order("id").range(a, b),
      )
    ).map((s) => s.event_id),
  );
  const overrides = await readAll<{ event_id: string; locked_fields: string[] | null }>((a, b) =>
    sb.from("event_overrides").select("event_id, locked_fields").order("event_id").range(a, b),
  );
  const locked = new Map(overrides.map((o) => [o.event_id, o.locked_fields ?? []]));

  const live = all.filter((r) => !r.merged_into_id);
  const mergedInto = new Map<string, Row[]>();
  for (const r of all) {
    if (!r.merged_into_id) continue;
    mergedInto.set(r.merged_into_id, [...(mergedInto.get(r.merged_into_id) ?? []), r]);
  }

  /*
   * The bulk scrape capped names at 100 characters and a name that fills the
   * window is the window. Its other rows are the shape it wrote: official,
   * regional series rounds with no source behind them.
   */
  const fromBulkScrape = (r: Row) =>
    r.created_at.slice(0, 10) === "2026-09-17" &&
    r.source_kind === "official" &&
    r.competition_type === "series_round" &&
    r.level === "regional" &&
    !sourced.has(r.id) &&
    r.name.length >= 95;

  const candidates = live.filter((r) => looksLikeTextFragment(r.name) || fromBulkScrape(r));
  const candidateIds = new Set(candidates.map((c) => c.id));
  const byDate = new Map<string, Row[]>();
  for (const r of live) {
    if (candidateIds.has(r.id) || r.visibility === "hidden") continue;
    byDate.set(r.start_date, [...(byDate.get(r.start_date) ?? []), r]);
  }

  const shiftDay = (iso: string, d: number) =>
    new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);
  const sameRaceNearby = (row: Row, name: string | null): { into: Row; via: string } | null => {
    const near = [-1, 0, 1].flatMap((d) => byDate.get(shiftDay(row.start_date, d)) ?? []);
    const hay = canonicalizeForDedup(decodeEntities(row.name));
    let best: { into: Row; via: string; score: number } | null = null;
    for (const other of near) {
      if (other.id === row.id) continue;
      const sim = name ? nameSimilarity(name, other.name) : 0;
      const canon = canonicalizeForDedup(other.name);
      // The clean row's whole title, found inside the fragment, on that date.
      const contained =
        canon.length >= 10 && canon.split(" ").length >= 2 && hay.includes(canon) ? 0.9 : 0;
      const score = Math.max(sim, contained);
      if (score >= 0.85 && (!best || score > best.score)) {
        best = { into: other, via: sim >= contained ? `name ${sim.toFixed(2)}` : "title inside fragment", score };
      }
    }
    return best;
  };

  const plans: Plan[] = [];
  for (const row of candidates) {
    const reason = looksLikeTextFragment(row.name) ? "fragment-text" : "bulk-scrape-window";
    const locks = locked.get(row.id) ?? [];
    if (locks.includes("name") || locks.includes("visibility")) {
      plans.push({ row, reason, action: { kind: "skip", why: `admin-locked ${locks.join(",")}` } });
      continue;
    }

    const mergedNames = (mergedInto.get(row.id) ?? [])
      .map((m) => m.name.trim())
      .filter((n) => usableName(n, looksLikeTextFragment));
    let recovered: string | null = null;
    let via: "merged" | "fragment" = "merged";
    if (mergedNames.length) {
      recovered = mergedNames.reduce((a, b) => preferEventName(a, b));
    } else {
      const fromText = recoverFromFragment(row.name);
      if (usableName(fromText, looksLikeTextFragment)) {
        recovered = fromText;
        via = "fragment";
      }
    }

    const twin = sameRaceNearby(row, recovered);
    if (twin) {
      plans.push({ row, reason, action: { kind: "merge", into: twin.into, via: twin.via } });
    } else if (recovered) {
      plans.push({ row, reason, action: { kind: "rename", to: recovered, via } });
    } else if (row.visibility === "hidden") {
      plans.push({ row, reason, action: { kind: "skip", why: "already hidden, no name to recover" } });
    } else {
      plans.push({ row, reason, action: { kind: "hide" } });
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const upcoming = (r: Row) => (r.end_date ?? r.start_date) >= TODAY;
  const tag = (r: Row) =>
    `${r.start_date} ${r.visibility === "hidden" ? "hidden" : "public"}${upcoming(r) ? " UPCOMING" : ""}`;
  const clip = (s: string, n = 70) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const order = { rename: 0, merge: 1, hide: 2, skip: 3 } as const;
  plans.sort(
    (a, b) =>
      order[a.action.kind] - order[b.action.kind] ||
      Number(upcoming(b.row)) - Number(upcoming(a.row)) ||
      a.row.start_date.localeCompare(b.row.start_date),
  );

  for (const kind of ["rename", "merge", "hide", "skip"] as const) {
    const group = plans.filter((p) => p.action.kind === kind);
    const up = group.filter((p) => upcoming(p.row) && p.row.visibility !== "hidden").length;
    console.log(`\n=== ${kind.toUpperCase()} (${group.length}, ${up} upcoming+public) ===`);
    for (const p of group) {
      const a = p.action;
      const detail =
        a.kind === "rename"
          ? `→ "${a.to}"  [from ${a.via}]`
          : a.kind === "merge"
            ? `→ into ${a.into.id.slice(0, 8)} "${clip(a.into.name, 50)}" (${a.into.start_date}) [${a.via}]`
            : a.kind === "skip"
              ? `(${a.why})`
              : "";
      // Hides are many and alike; list the ones anyone can still see coming up.
      if (kind === "hide" && !(upcoming(p.row) && p.row.visibility !== "hidden")) continue;
      if (kind === "skip") continue;
      console.log(`  ${p.row.id.slice(0, 8)} ${tag(p.row)}  "${clip(p.row.name)}"\n      ${detail}`);
    }
    if (kind === "hide") {
      const rest = group.length - up;
      if (rest) console.log(`  … plus ${rest} past or already-hidden rows (see --json)`);
    }
  }
  console.log(
    `\ncandidates=${plans.length} rename=${plans.filter((p) => p.action.kind === "rename").length}` +
      ` merge=${plans.filter((p) => p.action.kind === "merge").length}` +
      ` hide=${plans.filter((p) => p.action.kind === "hide").length}` +
      ` skip=${plans.filter((p) => p.action.kind === "skip").length}  ${APPLY ? "APPLY" : "DRY RUN"}`,
  );

  if (JSON_OUT) {
    writeFileSync(
      JSON_OUT,
      JSON.stringify(
        plans.map((p) => ({
          id: p.row.id,
          name: p.row.name,
          start_date: p.row.start_date,
          visibility: p.row.visibility,
          reason: p.reason,
          action: p.action.kind,
          to: p.action.kind === "rename" ? p.action.to : undefined,
          into: p.action.kind === "merge" ? p.action.into.id : undefined,
          into_name: p.action.kind === "merge" ? p.action.into.name : undefined,
          why: p.action.kind === "skip" ? p.action.why : undefined,
        })),
        null,
        2,
      ),
    );
    console.log(`plan written to ${JSON_OUT}`);
  }

  if (!APPLY) return;

  // ── Apply ─────────────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  let done = 0;
  for (const p of plans) {
    const a = p.action;
    if (a.kind === "rename") {
      const { error } = await sb
        .from("events")
        .update({ name: a.to, name_normalized: normalizeName(a.to), updated_at: now })
        .eq("id", p.row.id);
      if (error) throw new Error(`${p.row.id}: ${error.message}`);
    } else if (a.kind === "merge") {
      await mergeEventPair(a.into.id, p.row.id);
    } else if (a.kind === "hide") {
      const { error } = await sb
        .from("events")
        .update({ visibility: "hidden", updated_at: now })
        .eq("id", p.row.id);
      if (error) throw new Error(`${p.row.id}: ${error.message}`);
    } else {
      continue;
    }
    done += 1;
  }
  console.log(`applied ${done} changes (${UPDATED_BY})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
