/**
 * Ingest races from regional-2026-doplneny-kalendar-url.csv (kalendar_url column).
 * Skips federation bulk-attach hosts; seeds via preview → watchOne when possible.
 *
 * Usage: npx tsx scripts/ingest-doplnene-kalendare-2026-09-17.ts [--dry] [--limit N] [--only slug]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { previewUrl, watchOne } from "../src/lib/watcher/run";
import { listEvents } from "../src/lib/events";
import { attachEventSeries, attachSecondarySeries } from "../src/lib/catalog/event-series";
import { fingerprint, normalizeName } from "../src/lib/domain";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const DRY = process.argv.includes("--dry");
const onlyIdx = process.argv.indexOf("--only");
const ONLY = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null;
const limitIdx = process.argv.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) : Infinity;

const CSV =
  "/Users/radektobolka/Downloads/regional-2026-doplneny-kalendar-url.csv";

/** Already seeded earlier today — skip unless --only. */
const ALREADY_DONE = new Set(["cyklomanek", "kuklik-xco", "kolo-kolem-komina"]);

/** Hosts that return mixed federation calendars — preview OK, never bulk-attach all. */
const FED_HOSTS = new Set([
  "cyklistikaszc.sk",
  "pzkol.pl",
  "rad-net.de",
  "classic.rad-net.de",
  "xco-nrw-cup.de",
  "ooe-radsportverband.at",
  "dzkol.pl",
  "cycling.sportsoft.cz",
  "ucigravelworldseries.com",
]);

function parseCsv(path: string) {
  const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = raw.split("\n").filter(Boolean);
  const rows: Record<string, string>[] = [];
  const headers = splitLine(lines[0]!, ",");
  for (let i = 1; i < lines.length; i++) {
    const parts = splitLine(lines[i]!, ",");
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (parts[idx] || "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function splitLine(line: string, delim: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === delim && !inQ) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function parseExpected(v: string): number | null {
  const m = v.match(/^\d+$/);
  if (!m) return null;
  const n = Number(m[0]);
  if (n === 2026 || n > 50) return null; // bogus
  return n;
}

async function ensureWatched(url: string, notes: string) {
  const sb = createServerSupabase();
  const { data: row } = await sb.from("watched_urls").select("*").eq("url", url).maybeSingle();
  if (row) {
    if (row.status !== "active") {
      await sb
        .from("watched_urls")
        .update({
          status: "active",
          next_poll_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
    return row;
  }
  const { data, error } = await sb
    .from("watched_urls")
    .insert({
      url,
      kind: "series",
      status: "active",
      added_by: "doplnene-kalendare-2026-09-17",
      notes,
      next_poll_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(`${url}: ${error.message}`);
  return data!;
}

async function safeAttach(
  sb: ReturnType<typeof createServerSupabase>,
  seriesId: string,
  events: { startDate?: string; name?: string; lat?: number; lng?: number }[],
  expected: number | null,
) {
  // Reject fat mixed calendars
  if (expected != null && events.length > expected + 5 && events.length > 20) return 0;
  if (expected == null && events.length > 25) return 0;

  let attached = 0;
  for (const ev of events) {
    if (!ev.startDate || !ev.name) continue;
    const fp = fingerprint({ startDate: ev.startDate, name: ev.name, lat: ev.lat, lng: ev.lng });
    let eventId: string | null = null;
    const { data: byFp } = await sb
      .from("events")
      .select("id, series_id")
      .eq("fingerprint", fp)
      .is("merged_into_id", null)
      .maybeSingle();
    if (byFp) eventId = byFp.id as string;
    if (!eventId) {
      const tokens = normalizeName(ev.name)
        .split(" ")
        .filter((t) => t.length > 3)
        .slice(0, 2);
      if (tokens.length) {
        const { data: day } = await sb
          .from("events")
          .select("id, name")
          .eq("start_date", ev.startDate)
          .is("merged_into_id", null)
          .ilike("name", `%${tokens.join("%")}%`)
          .limit(8);
        const hit =
          (day || []).find((d) => normalizeName(d.name) === normalizeName(ev.name)) ||
          ((day || []).length === 1 ? day![0] : null);
        if (hit) eventId = hit.id as string;
      }
    }
    if (!eventId) continue;
    const { data: cur } = await sb.from("events").select("series_id").eq("id", eventId).maybeSingle();
    if (!cur?.series_id) {
      await attachEventSeries(sb, eventId, seriesId, { primary: true, source: "doplnene-kalendare" });
    } else if (cur.series_id !== seriesId) {
      await attachSecondarySeries(sb, eventId, seriesId, "doplnene-kalendare");
    } else {
      await attachEventSeries(sb, eventId, seriesId, { primary: true, source: "doplnene-kalendare" });
    }
    await sb
      .from("events")
      .update({ visibility: "public", updated_at: new Date().toISOString() })
      .eq("id", eventId)
      .eq("visibility", "hidden");
    attached++;
  }
  return attached;
}

async function main() {
  const rows = parseCsv(CSV);
  const sb = createServerSupabase();
  const report: Record<string, unknown>[] = [];
  let processed = 0;

  for (const row of rows) {
    const slug = row.slug;
    if (!slug) continue;
    if (ONLY && slug !== ONLY) continue;
    if (!ONLY && ALREADY_DONE.has(slug)) continue;
    if (processed >= LIMIT) break;

    const calUrl = row.kalendar_url?.trim();
    if (!calUrl) continue;

    const { data: series } = await sb.from("series").select("id, website_url").eq("slug", slug).maybeSingle();
    if (!series?.id) {
      console.log(`MISSING SERIES ${slug}`);
      report.push({ slug, status: "missing_series" });
      continue;
    }

    const expected = parseExpected(row.ocekavano_zavodu || "");
    let before = 0;
    try {
      before = (await listEvents({ seriesSlug: slug })).length;
    } catch {
      before = 0;
    }
    if (expected != null && before >= expected) {
      console.log(`SKIP complete ${slug} db=${before}/${expected}`);
      report.push({ slug, status: "already_complete", before });
      continue;
    }

    processed++;
    const host = hostOf(calUrl);
    const isFed = FED_HOSTS.has(host);
    let previewCount = 0;
    let upserted = 0;
    let attached = 0;
    let strategy: string | null = null;
    let status = "no_calendar";

    try {
      const p = await previewUrl(calUrl);
      previewCount = p.events?.length ?? 0;
      strategy = p.strategy || null;

      if (previewCount > 0 && !DRY) {
        // Update series source to calendar URL when better than generic federation hub
        if (!isFed || !series.website_url) {
          await sb
            .from("series")
            .update({
              source_url: calUrl,
              website_url: series.website_url || row.oficialni_web || calUrl,
              updated_at: new Date().toISOString(),
              last_seen_at: new Date().toISOString(),
            })
            .eq("id", series.id);
        }

        const watched = await ensureWatched(calUrl, `Doplněný kalendář — ${row.serie}`);
        const result = await watchOne({
          id: watched.id as string,
          url: watched.url as string,
          etag: (watched.etag as string | null) ?? null,
          last_modified: (watched.last_modified as string | null) ?? null,
          content_hash: (watched.content_hash as string | null) ?? null,
          kind: (watched.kind as string | undefined) ?? "series",
          last_extract_status: (watched.last_extract_status as string | null) ?? null,
        });
        upserted = result?.eventsUpserted ?? 0;

        if (!isFed && p.events) {
          attached = await safeAttach(sb, series.id, p.events, expected);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      strategy = `error:${msg.slice(0, 100)}`;
    }

    let after = before;
    try {
      after = (await listEvents({ seriesSlug: slug })).length;
    } catch {
      /* keep */
    }

    if (expected != null && after >= expected) status = "complete";
    else if (after > before) status = "improved";
    else if (after > 0) status = "partial";
    else if (previewCount > 0 && isFed) status = "fed_preview_no_attach";
    else if (previewCount > 0) status = "preview_no_link";
    else status = "no_calendar";

    console.log(
      `${row.stat} ${status.padEnd(22)} db=${String(after).padStart(2)} prev=${String(previewCount).padStart(2)} up=${String(upserted).padStart(2)} att=${String(attached).padStart(2)} ${slug}`,
    );
    report.push({
      stat: row.stat,
      serie: row.serie,
      slug,
      calUrl,
      expected,
      before,
      after,
      previewCount,
      upserted,
      attached,
      strategy,
      status,
      isFed,
    });
  }

  writeFileSync("/tmp/doplnene-kalendare-report.json", JSON.stringify(report, null, 2));
  const counts: Record<string, number> = {};
  for (const r of report) counts[String(r.status)] = (counts[String(r.status)] || 0) + 1;
  console.log("\n=== SUMMARY ===");
  console.log({ processed, dry: DRY, counts, totalReport: report.length });
  console.log("wrote /tmp/doplnene-kalendare-report.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
