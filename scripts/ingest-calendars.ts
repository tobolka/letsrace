/**
 * Registers newly found national calendars and reads each one once.
 * Usage: nvm use 22 && npx tsx scripts/ingest-calendars.ts [url-fragment]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { watchOne } from "../src/lib/watcher/run";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const TARGETS = [
  {
    url: "https://pzkol.pl/kalendarz",
    kind: "federation",
    notes: "PZKol — Polish federation calendar; the adapter pulls ?v=l&season=YYYY",
  },
  {
    url: "https://dostartu.pl/lista-zawodow",
    kind: "aggregator",
    notes: "dostartu.pl entry platform — cycling sports 31/36 off its JSON API",
  },
  {
    url: "https://odjazd.pl/",
    kind: "aggregator",
    notes: "odjazd.pl — largest Polish race search; week pages list, race pages name",
  },
  {
    url: "https://kalendarzrowerowy.pl/kalendarz/",
    kind: "aggregator",
    notes: "kalendarzrowerowy.pl — Polish gravel and ultra calendar, pins included",
  },
  {
    url: "https://bikeboard.at/termine",
    kind: "aggregator",
    notes: "Bikeboard — AT and DE calendar, tagged by discipline, links the organiser",
  },
  {
    url: "https://turbo-sport.eu/events",
    kind: "aggregator",
    notes: "BRV Timing — the only public register of Bavarian road racing",
  },
];

async function main() {
  const supabase = createServerSupabase();
  for (const t of TARGETS) {
    let { data: row, error } = await supabase
      .from("watched_urls")
      .select("*")
      .eq("url", t.url)
      .maybeSingle();

    if (!row) {
      const inserted = await supabase
        .from("watched_urls")
        .insert({
          url: t.url,
          kind: t.kind,
          status: "active",
          added_by: "admin",
          notes: t.notes,
          next_poll_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      row = inserted.data;
      error = inserted.error;
    }
    if (error || !row) {
      console.log("missing", t.url, error?.message);
      continue;
    }

    console.log("watching", t.url, "…");
    const started = Date.now();
    const out = await watchOne({
      id: row.id,
      url: row.url,
      etag: null,
      last_modified: null,
      content_hash: null,
      kind: row.kind,
      last_extract_status: row.last_extract_status,
    });
    console.log({
      url: out.url,
      ok: out.ok,
      events: out.eventsUpserted,
      strategy: out.strategy,
      error: out.error,
      ms: Date.now() - started,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
