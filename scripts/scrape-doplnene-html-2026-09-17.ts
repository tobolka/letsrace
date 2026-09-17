/**
 * Aggressive HTML date scraper for doplněné kalendar_url pages.
 * Extracts 2026 dates + nearby title text, seeds/attaches to series.
 *
 * Usage: npx tsx scripts/scrape-doplnene-html-2026-09-17.ts [--dry] [--limit N] [--stat CZ]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { fingerprint, normalizeName, slugifyEvent } from "../src/lib/domain";
import { attachEventSeries, attachSecondarySeries } from "../src/lib/catalog/event-series";
import { listEvents } from "../src/lib/events";

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
const limitIdx = process.argv.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) : Infinity;
const statIdx = process.argv.indexOf("--stat");
const ONLY_STAT = statIdx >= 0 ? process.argv[statIdx + 1]!.toUpperCase() : null;

const CSV =
  process.env.DOPLNENE_CSV ||
  "/Users/radektobolka/Downloads/regional-2026-doplneny-kalendar-url.csv";
const SKIP = new Set([
  "cyklomanek",
  "kuklik-xco",
  "kolo-kolem-komina",
  "blinduro-king-queen",
  "japa-cup",
  "stredecni-pohar",
  "jesenicky-snek",
  "sumpersky-pohar-mtb",
  "severoceska-amaterska-liga",
]);

const MONTHS: Record<string, number> = {
  leden: 1,
  ledna: 1,
  januar: 1,
  january: 1,
  unor: 2,
  unora: 2,
  únor: 2,
  února: 2,
  februar: 2,
  february: 2,
  brezen: 3,
  brezna: 3,
  březen: 3,
  března: 3,
  marz: 3,
  märz: 3,
  march: 3,
  marec: 3,
  marca: 3,
  duben: 4,
  dubna: 4,
  april: 4,
  kveten: 5,
  kvetna: 5,
  květen: 5,
  května: 5,
  mai: 5,
  may: 5,
  maj: 5,
  maja: 5,
  cerven: 6,
  cervna: 6,
  červen: 6,
  června: 6,
  juni: 6,
  june: 6,
  jun: 6,
  cervenec: 7,
  cervence: 7,
  červenec: 7,
  července: 7,
  juli: 7,
  july: 7,
  jul: 7,
  srpen: 8,
  srpna: 8,
  august: 8,
  aug: 8,
  zari: 9,
  září: 9,
  september: 9,
  sept: 9,
  wrzesien: 9,
  września: 9,
  wrzesnia: 9,
  rijen: 10,
  rijna: 10,
  říjen: 10,
  října: 10,
  oktober: 10,
  october: 10,
  pazdziernik: 10,
  października: 10,
  pazdziernika: 10,
  listopada: 11,
  listopad: 11,
  listopadu: 11,
  november: 11,
  nov: 11,
  prosinec: 12,
  prosince: 12,
  december: 12,
  dezember: 12,
  grudzien: 12,
  grudnia: 12,
  // Polish nominative / genitive extras (marca already above)
  stycznia: 1,
  styczen: 1,
  lutego: 2,
  luty: 2,
  marzec: 3,
  kwietnia: 4,
  kwiecien: 4,
  czerwca: 6,
  czerwiec: 6,
  lipca: 7,
  lipiec: 7,
  sierpnia: 8,
  sierpien: 8,
};

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

function parseCsv(path: string) {
  const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = raw.split("\n").filter(Boolean);
  const headers = splitLine(lines[0]!, ",");
  return lines.slice(1).map((line) => {
    const parts = splitLine(line, ",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (parts[i] || "").trim();
    });
    return row;
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n");
}

type Found = { start: string; end?: string; name: string };

function extractEvents(text: string, seriesName: string): Found[] {
  const out: Found[] = [];
  const seen = new Set<string>();

  const push = (start: string, name: string, end?: string) => {
    if (!/^2026-\d{2}-\d{2}$/.test(start)) return;
    const clean = name
      .replace(/\s+/g, " ")
      .replace(/^[\s\-–—|:·•]+|[\s\-–—|:·•]+$/g, "")
      .slice(0, 120);
    if (clean.length < 4) return;
    if (/cookie|privacy|newsletter|login|registr|javascript|browser/i.test(clean)) return;
    if (/vyhlášení|vyhlaseni|galavečer|galavec|abschlussfeier|awards night/i.test(clean) && !/závod|race|cup|maraton/i.test(clean))
      return;
    const key = `${start}|${normalizeName(clean).slice(0, 40)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ start, end, name: clean || `${seriesName} — ${start}` });
  };

  // ISO / YMD
  for (const m of text.matchAll(/\b(2026)-(\d{1,2})-(\d{1,2})\b/g)) {
    const start = `2026-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
    const idx = m.index ?? 0;
    const window = text.slice(Math.max(0, idx - 80), idx + 160).replace(/\n/g, " ");
    const name = window.replace(m[0]!, " ").replace(/\s+/g, " ").trim();
    push(start, name.slice(0, 100) || `${seriesName} ${start}`);
  }

  // D.M.2026 or D. M. 2026
  for (const m of text.matchAll(/\b(\d{1,2})\.\s*(\d{1,2})\.\s*2026\b/g)) {
    const start = `2026-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    const idx = m.index ?? 0;
    const window = text.slice(Math.max(0, idx - 40), idx + 140).replace(/\n/g, " ");
    const name = window.replace(m[0]!, " ").replace(/\s+/g, " ").trim();
    push(start, name.slice(0, 100) || `${seriesName} ${start}`);
  }

  // D/M/2026
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/2026\b/g)) {
    const start = `2026-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    const idx = m.index ?? 0;
    const window = text.slice(Math.max(0, idx - 40), idx + 140).replace(/\n/g, " ");
    push(start, window.replace(m[0]!, " ").replace(/\s+/g, " ").trim().slice(0, 100));
  }

  // 08-10.05.2026 range
  for (const m of text.matchAll(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.2026\b/g)) {
    const start = `2026-${m[3]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    const end = `2026-${m[3]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
    const idx = m.index ?? 0;
    const window = text.slice(idx, idx + 120).replace(/\n/g, " ");
    push(start, window.replace(m[0]!, " ").replace(/\s+/g, " ").trim().slice(0, 100), end);
  }

  // 25. dubna 2026 / 25. April 2026
  const monthAlt = Object.keys(MONTHS).join("|");
  const resolveMonth = (raw: string) => {
    const key = raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace("ä", "a")
      .replace("ö", "o")
      .replace("ü", "u");
    return MONTHS[raw.toLowerCase()] || MONTHS[key];
  };

  const reMonth = new RegExp(`\\b(\\d{1,2})\\.\\s*(${monthAlt})\\s*2026\\b`, "gi");
  for (const m of text.matchAll(reMonth)) {
    const month = resolveMonth(m[2]!);
    if (!month) continue;
    const start = `2026-${String(month).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    const idx = m.index ?? 0;
    const window = text.slice(Math.max(0, idx - 30), idx + 140).replace(/\n/g, " ");
    push(start, window.replace(m[0]!, " ").replace(/\s+/g, " ").trim().slice(0, 100));
  }

  // Polish / Slovak without trailing dot: 19 lipca 2026, 1 maja 2026, 23. máj 2026 (dot optional)
  const reMonthSpaced = new RegExp(`\\b(\\d{1,2})\\.?\\s+(${monthAlt})\\s+2026\\b`, "gi");
  for (const m of text.matchAll(reMonthSpaced)) {
    const month = resolveMonth(m[2]!);
    if (!month) continue;
    const start = `2026-${String(month).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    const idx = m.index ?? 0;
    const window = text.slice(Math.max(0, idx - 50), idx + 140).replace(/\n/g, " ");
    push(start, window.replace(m[0]!, " ").replace(/\s+/g, " ").trim().slice(0, 100));
  }

  // Range with month name: 27–28 czerwca 2026 / 4-5 września 2026 / 30 kwietnia - 3 maja 2026
  const reRangeMonth = new RegExp(
    `\\b(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})\\s+(${monthAlt})\\s+2026\\b`,
    "gi",
  );
  for (const m of text.matchAll(reRangeMonth)) {
    const month = resolveMonth(m[3]!);
    if (!month) continue;
    const start = `2026-${String(month).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    const end = `2026-${String(month).padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
    const idx = m.index ?? 0;
    const window = text.slice(Math.max(0, idx - 60), idx + 100).replace(/\n/g, " ");
    push(start, window.replace(m[0]!, " ").replace(/\s+/g, " ").trim().slice(0, 100), end);
  }

  // English Month DD-DD: April 04-05 / May 16-17 (year nearby or page is 2026)
  const reEnRange = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[-–]\s*(\d{1,2})\b/gi;
  for (const m of text.matchAll(reEnRange)) {
    const month = resolveMonth(m[1]!);
    if (!month) continue;
    const start = `2026-${String(month).padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
    const end = `2026-${String(month).padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
    const idx = m.index ?? 0;
    const window = text.slice(Math.max(0, idx - 60), idx + 80).replace(/\n/g, " ");
    push(start, window.replace(m[0]!, " ").replace(/\s+/g, " ").trim().slice(0, 100), end);
  }

  // DD.MM. Place (year omitted, CX autumn calendars): 11.10. Borna
  if (/\b2026\b/.test(text)) {
    for (const m of text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.\s*([A-ZÁÄÖÜŠČŘŽŁ][\wÁÄÖÜŠČŘŽŁáäöüßščřžł\- ]{2,40})/g)) {
      const month = Number(m[2]);
      const day = Number(m[1]);
      if (month < 1 || month > 12 || day < 1 || day > 31) continue;
      // Prefer late-season CX / autumn dates when year omitted
      if (month < 9 && month > 5) continue;
      const start = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      push(start, m[3]!.trim().slice(0, 100));
    }
  }

  // Cap per series to avoid garbage
  return out.slice(0, 40);
}

async function fetchText(url: string): Promise<string> {
  const ctrl = AbortSignal.timeout(25000);
  const res = await fetch(url, {
    signal: ctrl,
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,text/calendar,*/*",
      "accept-language": "cs,sk,de,pl,en;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  const buf = await res.text();
  if (ct.includes("text/calendar") || buf.startsWith("BEGIN:VCALENDAR")) return buf;
  if (url.toLowerCase().endsWith(".pdf") || ct.includes("pdf")) {
    // skip binary PDF for now
    throw new Error("pdf");
  }
  return stripHtml(buf);
}

function eventsFromIcs(ics: string): Found[] {
  const out: Found[] = [];
  const blocks = ics.split("BEGIN:VEVENT").slice(1);
  for (const b of blocks) {
    const sum = b.match(/SUMMARY(?:;[^:]*)?:(.+)/)?.[1]?.trim();
    const dt = b.match(/DTSTART(?:;[^:]*)?:(\d{8})/)?.[1];
    const dtEnd = b.match(/DTEND(?:;[^:]*)?:(\d{8})/)?.[1];
    if (!sum || !dt || !dt.startsWith("2026")) continue;
    const start = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
    const end = dtEnd?.startsWith("2026")
      ? `${dtEnd.slice(0, 4)}-${dtEnd.slice(4, 6)}-${dtEnd.slice(6, 8)}`
      : undefined;
    out.push({ start, end, name: sum.replace(/\\,/g, ",").replace(/\\n/g, " ") });
  }
  return out;
}

async function findOrCreate(
  sb: ReturnType<typeof createServerSupabase>,
  seriesId: string,
  website: string,
  round: Found,
  disciplines: string[],
) {
  const fp = fingerprint({ startDate: round.start, name: round.name });
  const slug = slugifyEvent(round.name, round.start);
  const { data: byFp } = await sb
    .from("events")
    .select("id, series_id")
    .eq("fingerprint", fp)
    .is("merged_into_id", null)
    .maybeSingle();
  if (byFp?.id) return byFp.id as string;

  const tokens = normalizeName(round.name)
    .split(" ")
    .filter((t) => t.length > 3)
    .slice(0, 2);
  if (tokens.length) {
    const { data: day } = await sb
      .from("events")
      .select("id, name")
      .eq("start_date", round.start)
      .is("merged_into_id", null)
      .ilike("name", `%${tokens.join("%")}%`)
      .limit(5);
    const exact = (day || []).find((d) => normalizeName(d.name) === normalizeName(round.name));
    if (exact) return exact.id as string;
  }

  if (DRY) return null;
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("events")
    .insert({
      slug,
      name: round.name,
      name_normalized: normalizeName(round.name),
      start_date: round.start,
      end_date: round.end && round.end !== round.start ? round.end : null,
      fingerprint: fp,
      disciplines,
      audience: "mixed",
      status: round.start < now.slice(0, 10) ? "completed" : "scheduled",
      visibility: "public",
      website_url: website,
      source_kind: "official",
      event_type: "race",
      competition_type: "series_round",
      season: "2026",
      level: "regional",
      created_at: now,
      updated_at: now,
      last_seen_at: now,
    })
    .select("id")
    .single();
  if (error) {
    const suffix = Date.now().toString(36);
    const { data: d2, error: e2 } = await sb
      .from("events")
      .insert({
        slug: `${slug}-${suffix}`,
        name: round.name,
        name_normalized: normalizeName(round.name),
        start_date: round.start,
        end_date: round.end && round.end !== round.start ? round.end : null,
        fingerprint: `${fp}:${suffix}`,
        disciplines,
        audience: "mixed",
        status: "scheduled",
        visibility: "public",
        website_url: website,
        source_kind: "official",
        event_type: "race",
        competition_type: "series_round",
        season: "2026",
        level: "regional",
        created_at: now,
        updated_at: now,
        last_seen_at: now,
      })
      .select("id")
      .single();
    if (e2) return null;
    return d2!.id as string;
  }
  return data!.id as string;
}

function disciplinesGuess(disciplina: string, podtyp: string): string[] {
  const blob = `${disciplina} ${podtyp}`.toLowerCase();
  const out = new Set<string>();
  if (/gravel/.test(blob)) out.add("gravel");
  if (/cx|cyklokros|cyclo/.test(blob)) out.add("cx");
  if (/silnic|road|stra/.test(blob)) out.add("road");
  if (/časov|zeitfahr|tt\b/.test(blob)) out.add("tt");
  if (/enduro/.test(blob)) out.add("enduro");
  if (/\bdh\b|downhill/.test(blob)) out.add("dh");
  if (/xcm|maraton/.test(blob)) {
    out.add("mtb");
    out.add("xcm");
  }
  if (/xco|xcc|xc\b|mtb|hors/.test(blob)) {
    out.add("mtb");
    if (/xco/.test(blob)) out.add("xco");
  }
  if (!out.size) out.add("mtb");
  return [...out];
}

async function main() {
  const rows = parseCsv(CSV);
  const sb = createServerSupabase();
  const report: Record<string, unknown>[] = [];
  let processed = 0;

  for (const row of rows) {
    const slug = row.slug;
    if (!slug || SKIP.has(slug)) continue;
    if (ONLY_STAT && row.stat !== ONLY_STAT) continue;
    if (processed >= LIMIT) break;

    const url = row.kalendar_url?.trim();
    if (!url) continue;

    const { data: series } = await sb.from("series").select("id").eq("slug", slug).maybeSingle();
    if (!series?.id) {
      console.log(`MISS ${slug}`);
      continue;
    }

    let before = 0;
    try {
      before = (await listEvents({ seriesSlug: slug })).length;
    } catch {
      before = 0;
    }
    const expected = /^\d+$/.test(row.ocekavano_zavodu || "") ? Number(row.ocekavano_zavodu) : null;
    if (expected && expected < 50 && before >= expected) {
      console.log(`OK already ${slug} ${before}`);
      continue;
    }

    processed++;
    let found: Found[] = [];
    let err: string | null = null;
    try {
      const text = await fetchText(url);
      found = text.includes("BEGIN:VCALENDAR") ? eventsFromIcs(text) : extractEvents(text, row.serie);
    } catch (e: unknown) {
      err = (e instanceof Error ? e.message : String(e)).slice(0, 80) || "fetch";
    }

    // If too many garbage hits relative to expected, trim
    if (expected && expected < 50 && found.length > expected * 3) {
      found = found.slice(0, expected + 2);
    }

    let created = 0;
    const discs = disciplinesGuess(row.disciplina || "", row.podtyp || "");
    if (!DRY) {
      await sb
        .from("series")
        .update({
          source_url: url,
          website_url: row.oficialni_web || url,
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", series.id);
    }

    for (const round of found) {
      const id = await findOrCreate(sb, series.id, url, round, discs);
      if (!id || DRY) {
        if (DRY) console.log("  WOULD", round.start, round.name);
        continue;
      }
      const { data: ev } = await sb.from("events").select("series_id").eq("id", id).maybeSingle();
      if (!ev?.series_id) {
        await attachEventSeries(sb, id, series.id, { primary: true, source: "html-scrape" });
        created++;
      } else if (ev.series_id !== series.id) {
        await attachSecondarySeries(sb, id, series.id, "html-scrape");
      } else {
        await attachEventSeries(sb, id, series.id, { primary: true, source: "html-scrape" });
      }
    }

    let after = before;
    try {
      after = (await listEvents({ seriesSlug: slug })).length;
    } catch {
      /* */
    }

    const status =
      after > before ? "improved" : found.length ? "found_no_new" : err ? `error:${err}` : "empty";
    console.log(
      `${row.stat} ${String(status).padEnd(18)} db=${String(after).padStart(2)} found=${String(found.length).padStart(2)} +${created} ${slug}`,
    );
    report.push({
      stat: row.stat,
      slug,
      url,
      before,
      after,
      found: found.length,
      created,
      status,
      sample: found.slice(0, 3),
    });
  }

  writeFileSync("/tmp/html-scrape-report.json", JSON.stringify(report, null, 2));
  const counts: Record<string, number> = {};
  for (const r of report) {
    const k = String(r.status).startsWith("error") ? "error" : String(r.status);
    counts[k] = (counts[k] || 0) + 1;
  }
  console.log("\n=== SUMMARY ===", { processed, dry: DRY, counts });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
