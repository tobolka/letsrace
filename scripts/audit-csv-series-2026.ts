/**
 * Audit CSV series against DB. Read-only.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
loadEnv();

import { createServerSupabase } from "../src/lib/supabase/server";

type CsvRow = {
  nazev: string;
  disciplina: string;
  podtyp: string;
  region: string;
  pocet: string;
  web: string;
  poznamka: string;
  stav: string;
};

function parseCsv(path: string): CsvRow[] {
  const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = raw.split("\n").filter(Boolean);
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of lines[i]!) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ";" && !inQ) { parts.push(cur); cur = ""; continue; }
      cur += ch;
    }
    parts.push(cur);
    rows.push({
      nazev: parts[0]!.trim(),
      disciplina: parts[1]!.trim(),
      podtyp: parts[2]!.trim(),
      region: parts[3]!.trim(),
      pocet: parts[4]!.trim(),
      web: parts[5]!.trim(),
      poznamka: parts[6]!.trim(),
      stav: parts[7]!.trim(),
    });
  }
  return rows;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// Known canonical mappings from handoff / parsers
const KNOWN: Record<string, string> = {
  "cesky-pohar-mtb-xco": "cesky-pohar-mtb",
  "cesky-pohar-mtb-xcm": "cesky-pohar-mtb-xcm", // may not exist separately
  "kolo-pro-zivot": "kolo-pro-zivot",
  "prima-cup": "primacup",
  "skoda-prazsky-mtb-pohar": "prazsky-mtb-pohar",
  "talent-cup": "talent-cup",
  "pkk-hk-pohar-karlovarskeho-kraje-horskych-kol": "pohar-kv-kraje-hk",
  "ppkbike-pohar-plzenskeho-kraje-mtb-xco": "ppkbike",
  "sumavsky-pohar-mtb": "sumavsky-mtb-pohar",
  "peklo-severu-mtb": "peklo-severu",
  "detsky-mtb-cup-libereckeho-kraje": "detsky-mtb-cup",
  "ceska-enduro-serie": "czech-enduro-series",
  "zapadoceska-amaterska-liga-zal": "zal",
  "cpp-extraliga-masters": "cpp-extraliga-masters",
  "janev-cup": "janev-cup",
  "tbc-serie": "tbc-cyclocross",
  "autovinkler-jihocesky-mtb-pohar": "jihocesky-mtb-pohar",
  "skoda-cup": "skoda-cup",
  "mnd-cup": "mnd-cup",
};

async function main() {
  const csv = parseCsv("/Users/radektobolka/Downloads/cyklisticke_serialy_CR_2026.csv");
  console.log("CSV rows:", csv.length);

  const supabase = createServerSupabase();
  const { data: series, error } = await supabase
    .from("series")
    .select("id, slug, name, website_url");
  if (error) throw error;
  console.log("DB series rows:", series!.length);

  const bySlug = new Map(series!.map((s) => [s.slug, s]));
  const byHost = new Map<string, typeof series>();
  for (const s of series!) {
    const h = hostOf(s.website_url || "");
    if (!h) continue;
    if (!byHost.has(h)) byHost.set(h, []);
    byHost.get(h)!.push(s);
  }

  // Count 2026 events per series
  const { data: events } = await supabase
    .from("events")
    .select("id, series_id, start_date, status, name, merged_into_id")
    .gte("start_date", "2026-01-01")
    .lte("start_date", "2026-12-31")
    .is("merged_into_id", null);
  
  const countBySeries = new Map<string, { total: number; visible: number; names: string[] }>();
  for (const e of events || []) {
    if (!e.series_id) continue;
    const c = countBySeries.get(e.series_id) || { total: 0, visible: 0, names: [] };
    c.total++;
    if (e.status !== "hidden" && e.status !== "cancelled") {
      c.visible++;
      if (c.names.length < 20) c.names.push(`${e.start_date} ${e.name}`);
    }
    countBySeries.set(e.series_id, c);
  }

  // watched urls
  const { data: watched } = await supabase
    .from("watched_urls")
    .select("id, url, active, kind")
    .eq("active", true);

  const watchedHosts = new Set(
    (watched || []).map((w) => hostOf(w.url)).filter(Boolean),
  );

  type Out = {
    csvName: string;
    csvWeb: string;
    csvPocet: string;
    host: string;
    guessedSlug: string;
    match: string | null;
    matchName: string | null;
    matchWeb: string | null;
    dbVisible: number;
    dbTotal: number;
    watched: boolean;
    status: "ok" | "mismatch_count" | "missing_series" | "no_web" | "partial";
  };
  const outs: Out[] = [];

  for (const row of csv) {
    const host = hostOf(row.web);
    const guessed = slugify(row.nazev);
    const known = KNOWN[guessed];
    
    let match =
      (known && bySlug.get(known)) ||
      bySlug.get(guessed) ||
      null;
    
    // host match
    if (!match && host) {
      const candidates = byHost.get(host) || [];
      if (candidates.length === 1) match = candidates[0]!;
      else if (candidates.length > 1) {
        // pick best name overlap
        const key = slugify(row.nazev).split("-").slice(0, 3).join("-");
        match =
          candidates.find((c) => c.slug.includes(key) || key.includes(c.slug)) ||
          candidates[0]!;
      }
    }

    // fuzzy name
    if (!match) {
      const tokens = slugify(row.nazev).split("-").filter((t) => t.length > 3);
      for (const s of series!) {
        const hit = tokens.filter((t) => s.slug.includes(t) || slugify(s.name).includes(t));
        if (hit.length >= 2) {
          match = s;
          break;
        }
      }
    }

    const counts = match ? countBySeries.get(match.id) : null;
    let status: Out["status"] = "ok";
    if (!row.web) status = "no_web";
    else if (!match) status = "missing_series";
    else if (row.stav.includes("částečně")) status = "partial";
    else {
      const expected = parseInt(row.pocet, 10);
      if (!Number.isNaN(expected) && counts && Math.abs(counts.visible - expected) > 1) {
        status = "mismatch_count";
      }
    }

    outs.push({
      csvName: row.nazev,
      csvWeb: row.web,
      csvPocet: row.pocet,
      host,
      guessedSlug: known || guessed,
      match: match?.slug ?? null,
      matchName: match?.name ?? null,
      matchWeb: match?.website_url ?? null,
      dbVisible: counts?.visible ?? 0,
      dbTotal: counts?.total ?? 0,
      watched: host ? watchedHosts.has(host) : false,
      status,
    });
  }

  const byStatus = (s: string) => outs.filter((o) => o.status === s);
  console.log("\n=== SUMMARY ===");
  console.log("ok:", byStatus("ok").length);
  console.log("mismatch_count:", byStatus("mismatch_count").length);
  console.log("missing_series:", byStatus("missing_series").length);
  console.log("no_web:", byStatus("no_web").length);
  console.log("partial:", byStatus("partial").length);

  console.log("\n=== ALL ===");
  for (const o of outs) {
    console.log(
      JSON.stringify({
        status: o.status,
        csv: o.csvName,
        expect: o.csvPocet,
        db: `${o.dbVisible}/${o.dbTotal}`,
        slug: o.match,
        web: o.csvWeb,
        watched: o.watched,
      }),
    );
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
