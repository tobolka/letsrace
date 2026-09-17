/**
 * The major Czech series read exactly like their official calendars.
 *
 * Each of them had drifted the same way TBC did: a second series row minted
 * from an aggregator's label, the same weekend held three times over (Hynek's
 * Saturday and Sunday rows beside the official one), partner events and
 * awards nights filed as rounds, and — for Kolo pro život — thirty rows of nav
 * links scraped off race pages and all dated the first of May.
 *
 * This is the ground truth, round by round, taken from the series' own
 * calendar pages on 2026-09-17. For every series it:
 *   1. folds duplicate series rows into the canonical one,
 *   2. re-reads the official source so every round has an official row,
 *   3. merges everything in a round's date window into one keeper and gives
 *      it the official name, dates and website, locked so the watcher keeps
 *      them,
 *   4. detaches what is in the series but not a round (partner races keep
 *      their own life; junk and ceremonies are hidden).
 *
 * Usage: nvm use 22 && npx tsx scripts/repair-major-series-2026-09-17.ts [--dry]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { mergeEventPair } from "../src/lib/catalog/merge-duplicates";
import { watchOne } from "../src/lib/watcher/run";
import { normalizeName } from "../src/lib/domain";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* env may already be set */
  }
}
loadEnv();

const DRY = process.argv.includes("--dry");
const TODAY = new Date().toISOString().slice(0, 10);
const UPDATED_BY = "major series repair 2026-09-17";

type Round = {
  start: string;
  end?: string;
  name: string;
  place: string;
  website?: string;
  /** Pull a row from outside the series when the window holds nothing. */
  adopt?: RegExp;
};

type SeriesPlan = {
  slug: string;
  name: string;
  /** Series rows to fold into this one. */
  duplicates: string[];
  /** Official calendar source to re-read before repairing. */
  sourceUrl: string;
  officialHost: RegExp;
  rounds: Round[];
  /** Rows in the series that are not rounds of it at all. */
  foreign?: { test: RegExp; seriesSlug: string | null; hide?: boolean }[];
  /** Rows dated like this are scraping debris, not races. */
  junk?: (e: EventRow) => boolean;
};

type EventRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: string;
  website_url: string | null;
  series_id: string | null;
  created_at: string;
};

const PLANS: SeriesPlan[] = [
  {
    slug: "cesky-pohar-mtb",
    name: "Český pohár MTB",
    duplicates: ["cp-mtb", "cesky-pohar-horskych-kol", "mcr-mtb"],
    sourceUrl: "https://www.poharmtb.cz/cross-country",
    officialHost: /poharmtb\.cz/i,
    rounds: [
      { start: "2026-04-18", end: "2026-04-19", name: "ČP MTB — Město Touškov — Touškovská rokle", place: "Město Touškov" },
      { start: "2026-05-09", end: "2026-05-10", name: "ČP MTB — Vimperk — Vodník", place: "Vimperk" },
      { start: "2026-05-31", name: "MČR — Praha — Motol", place: "Praha" },
      { start: "2026-06-06", end: "2026-06-07", name: "ČP MTB — Bedřichov — Jizerská 50 aréna", place: "Bedřichov" },
      { start: "2026-07-17", end: "2026-07-19", name: "MČR — Stupno — Ultramarínka", place: "Stupno" },
      { start: "2026-08-15", end: "2026-08-16", name: "ČP MTB — Ostrava — Hulváky", place: "Ostrava" },
      { start: "2026-09-05", end: "2026-09-06", name: "ČP MTB — Nové Město na Moravě — Vysočina aréna", place: "Nové Město na Moravě" },
    ],
    foreign: [
      { test: /allwyn|bmx czech cup|bmx racing/i, seriesSlug: "cesky-pohar-bmx" },
      { test: /\bf?bmx\b/i, seriesSlug: null },
    ],
  },
  {
    slug: "primacup",
    name: "Prima Cup",
    duplicates: ["prima-cup", "prima-cup-xcm"],
    sourceUrl: "https://www.iprimacup.cz/zavody-2026/",
    officialHost: /iprimacup\.cz/i,
    rounds: [
      { start: "2026-04-11", name: "BEST Hradec Králové", place: "Hradec Králové", website: "https://www.iprimacup.cz/26-hk/" },
      { start: "2026-05-09", name: "BEST Harrachov – Szklarska Poręba, Jakuszyce", place: "Harrachov", website: "https://www.iprimacup.cz/freedom-race/", adopt: /harrachov/i },
      { start: "2026-05-16", name: "Silesia Bike Marathon", place: "Opava", website: "https://www.iprimacup.cz/26-op/", adopt: /silesia bike/i },
      { start: "2026-06-06", name: "BAIC Dolní Morava", place: "Dolní Morava", website: "https://www.iprimacup.cz/26-dm/" },
      { start: "2026-06-13", name: "TCHIBO COFFIZZ Sázava", place: "Sázava", website: "https://www.iprimacup.cz/26-sa/" },
      { start: "2026-07-04", end: "2026-07-06", name: "KupKolo.cz MTB Trilogy", place: "Teplice nad Metují", website: "https://www.iprimacup.cz/26-te/", adopt: /mtb trilogy/i },
      { start: "2026-08-01", name: "FILIPA Podkrkonošský maraton", place: "Lázně Bělohrad", website: "https://www.iprimacup.cz/pm-2026/", adopt: /podkrkono/i },
      { start: "2026-08-08", name: "LEADER FOX Karlovy Vary", place: "Karlovy Vary", website: "https://www.iprimacup.cz/26-kv/" },
      { start: "2026-08-22", name: "BAIC Valtice", place: "Valtice", website: "https://www.iprimacup.cz/26-va/" },
      { start: "2026-09-05", name: "Českopetrovická koolna", place: "České Petrovice", website: "https://www.iprimacup.cz/26-ck/", adopt: /koolna/i },
      { start: "2026-09-28", name: "YATE Gočárovy schody", place: "Hradec Králové", website: "https://www.iprimacup.cz/26-gs/" },
    ],
    foreign: [
      { test: /vyhlášení|vyhlaseni/i, seriesSlug: null, hide: true },
      { test: /šumavsk|sumavsk/i, seriesSlug: null },
    ],
  },
  {
    slug: "kolo-pro-zivot",
    name: "Kolo pro život",
    duplicates: [],
    sourceUrl: "https://www.kolopro.cz/zavody",
    officialHost: /kolopro\.cz/i,
    rounds: [
      { start: "2026-04-25", name: "Bikemaraton Beroun", place: "Beroun", website: "https://www.kolopro.cz/zavody/bikemaraton-beroun/" },
      { start: "2026-05-09", name: "Oderská mlýnice", place: "Odry", website: "https://www.kolopro.cz/zavody/oderska-mlynice/" },
      { start: "2026-05-16", name: "Mladá Boleslav Tour", place: "Mladá Boleslav", website: "https://www.kolopro.cz/zavody/mlada-boleslav-tour/" },
      { start: "2026-06-07", name: "Soumar Trophy Prachatice", place: "Prachatice", website: "https://www.kolopro.cz/zavody/soumar-trophy-prachatice/" },
      { start: "2026-06-27", name: "Bikemaraton Drásal", place: "Holešov", website: "https://www.kolopro.cz/zavody/bikemaraton-drasal-27-06/" },
      { start: "2026-08-15", name: "Manitou Železné hory", place: "Třemošnice", website: "https://www.kolopro.cz/zavody/manitou-zelezne-hory/" },
      { start: "2026-09-05", end: "2026-09-06", name: "Znojmo Burčák Tour", place: "Znojmo", website: "https://www.kolopro.cz/zavody/znojmo-burcak-tour-5-6-9/" },
      { start: "2026-09-26", name: "Ralsko MTB Tour", place: "Ralsko", website: "https://www.kolopro.cz/zavody/ralsko-mtb-tour-26-9/" },
    ],
    // Partner events are listed beside the series, not in it.
    foreign: [
      { test: /malevil|fanatik|salzkammergut|lawi tour/i, seriesSlug: null },
    ],
    // Nav links scraped off race pages: every one dated the first of May.
    junk: (e) => e.start_date === "2026-05-01",
  },
  {
    slug: "detsky-mtb-cup",
    name: "Dětský MTB Cup",
    duplicates: [],
    sourceUrl: "https://www.detskymtbcup.cz/",
    officialHost: /detskymtbcup\.cz/i,
    rounds: [
      { start: "2026-04-26", name: "Dětský MTB Cup — Sobotka", place: "Sobotka" },
      { start: "2026-05-01", name: "Dětský MTB Cup — Turnov Rohozec", place: "Turnov" },
      { start: "2026-05-03", name: "Dětský MTB Cup — Turnov Struhy", place: "Turnov" },
      { start: "2026-06-14", name: "Dětský MTB Cup — Bedřichov", place: "Bedřichov" },
      { start: "2026-06-27", name: "Dětský MTB Cup — Tanvald", place: "Tanvald" },
      { start: "2026-09-13", name: "Dětský MTB Cup — Vratislavice nad Nisou", place: "Vratislavice nad Nisou" },
      { start: "2026-09-20", name: "Dětský MTB Cup — Liberec", place: "Liberec" },
      { start: "2026-09-27", name: "Dětský MTB Cup — Nové Město pod Smrkem", place: "Nové Město pod Smrkem" },
    ],
  },
  {
    slug: "prazsky-mtb-pohar",
    name: "Pražský MTB pohár",
    duplicates: ["prazsky-pohar-mtb"],
    sourceUrl: "https://prahamtb.cz/",
    officialHost: /prahamtb\.cz/i,
    rounds: [
      { start: "2026-04-11", name: "Pražský MTB pohár — 1. kolo Motol XCC", place: "Praha" },
      { start: "2026-04-12", name: "Pražský MTB pohár — 2. kolo Motol XCO", place: "Praha" },
      { start: "2026-05-16", name: "Pražský MTB pohár — 3. kolo Letňany", place: "Praha" },
      { start: "2026-05-17", name: "Pražský MTB pohár — 4. kolo Kbely", place: "Praha" },
    ],
    foreign: [{ test: /slavnostní|vyhlášení/i, seriesSlug: null, hide: true }],
  },
];

/** Empty series rows that only duplicate a populated one. */
const EMPTY_DUPLICATE_SERIES = [
  "cyklo-x",
  "gravel",
  "silnice",
  "silnice-ml-z",
  "prima-cup-xcm",
  "autovinkler-jihocesky-mtb-pohar",
];

function hostOf(url: string | null): string {
  try {
    return url ? new URL(url).hostname : "";
  } catch {
    return "";
  }
}

async function main() {
  const supabase = createServerSupabase();
  const now = () => new Date().toISOString();
  const log = (...a: unknown[]) => console.log(...a);

  const seriesIdBySlug = async (slug: string) => {
    const { data } = await supabase.from("series").select("id").eq("slug", slug).maybeSingle();
    return (data?.id as string | undefined) ?? null;
  };

  for (const plan of PLANS) {
    log(`\n===== ${plan.name} (${plan.slug})`);
    const canonicalId = await seriesIdBySlug(plan.slug);
    if (!canonicalId) throw new Error(`series ${plan.slug} missing`);

    // 1. Fold duplicate series rows.
    for (const dupSlug of plan.duplicates) {
      const dupId = await seriesIdBySlug(dupSlug);
      if (!dupId) continue;
      const { count } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("series_id", dupId);
      log(`fold ${dupSlug} (${count} events) into ${plan.slug}`);
      if (DRY) continue;
      const { error } = await supabase
        .from("events")
        .update({ series_id: canonicalId, updated_at: now() })
        .eq("series_id", dupId);
      if (error) throw new Error(error.message);
      const { error: delErr } = await supabase.from("series").delete().eq("id", dupId);
      if (delErr) throw new Error(delErr.message);
    }

    // 2. Re-read the official calendar so every round has an official row.
    const { data: source } = await supabase
      .from("watched_urls")
      .select("id,url,kind")
      .or(
        `url.eq.${plan.sourceUrl},url.eq.${plan.sourceUrl.replace(/\/$/, "")},url.eq.${plan.sourceUrl}/`,
      )
      .limit(1)
      .maybeSingle();
    if (source && !DRY) {
      const outcome = await watchOne({ id: source.id, url: source.url, kind: source.kind });
      log(`re-read ${source.url}: ok=${outcome.ok} extracted=${outcome.eventsExtracted ?? "?"} upserted=${outcome.eventsUpserted} ${outcome.error ?? ""}`);
    } else {
      log(`source ${plan.sourceUrl}: ${source ? "dry, skipped" : "not watched"}`);
    }

    // Everything the series holds this season.
    const loadSeries = async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id,name,start_date,end_date,status,website_url,series_id,created_at")
        .eq("series_id", canonicalId)
        .is("merged_into_id", null)
        .gte("start_date", "2026-01-01")
        .order("start_date");
      if (error) throw new Error(error.message);
      return (data ?? []) as EventRow[];
    };
    let rows = await loadSeries();

    // Foreign rows leave before the windows are read, or a BMX cup on the
    // same weekend would be merged into the MTB round.
    const claimed = new Set<string>();
    for (const e of rows) {
      const rule = plan.foreign?.find((f) => f.test.test(e.name));
      if (!rule) continue;
      claimed.add(e.id);
      const target = rule.seriesSlug ? await seriesIdBySlug(rule.seriesSlug) : null;
      log(`  foreign: ${e.start_date} ${e.name} → ${rule.seriesSlug ?? "no series"}${rule.hide ? ", hidden" : ""}`);
      if (DRY) continue;
      const patch: Record<string, unknown> = { series_id: target, updated_at: now() };
      if (rule.hide || plan.junk?.(e)) patch.status = "hidden";
      const { error } = await supabase.from("events").update(patch).eq("id", e.id);
      if (error) throw new Error(error.message);
    }
    rows = rows.filter((e) => !claimed.has(e.id));

    // 3. One keeper per round.
    for (const round of plan.rounds) {
      // Exact windows: Pražský rides Saturday and Sunday as two rounds, so a
      // day of spill would fold one into the other. Weekend rounds carry
      // their Sunday in `end`.
      const windowEnd = round.end ?? round.start;
      let inWindow = rows.filter(
        (e) => !claimed.has(e.id) && e.start_date >= round.start && e.start_date <= windowEnd,
      );
      // The partner race exists as its own event; adopt it into the series.
      if (!inWindow.length && round.adopt) {
        const { data } = await supabase
          .from("events")
          .select("id,name,start_date,end_date,status,website_url,series_id,created_at")
          .is("merged_into_id", null)
          .gte("start_date", round.start)
          .lte("start_date", windowEnd);
        inWindow = ((data ?? []) as EventRow[]).filter((e) => round.adopt!.test(e.name));
        if (inWindow.length) log(`  adopt ${inWindow.map((e) => e.name).join(" + ")}`);
      }
      if (!inWindow.length) {
        log(`  MISSING ${round.start} ${round.name} — nothing to keep`);
        continue;
      }
      const ranked = [...inWindow].sort((a, b) => {
        const ao = plan.officialHost.test(hostOf(a.website_url)) ? 0 : 1;
        const bo = plan.officialHost.test(hostOf(b.website_url)) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        const ah = a.status === "hidden" ? 1 : 0;
        const bh = b.status === "hidden" ? 1 : 0;
        if (ah !== bh) return ah - bh;
        return a.created_at.localeCompare(b.created_at);
      });
      const keeper = ranked[0]!;
      const drops = ranked.slice(1);
      log(
        `  ${round.start} ${round.name}: keep ${keeper.id.slice(0, 8)} "${keeper.name}"` +
          (drops.length ? ` + merge ${drops.map((d) => `"${d.name}"`).join(", ")}` : ""),
      );
      for (const e of inWindow) claimed.add(e.id);
      if (DRY) continue;
      for (const d of drops) {
        try {
          await mergeEventPair(keeper.id, d.id);
        } catch (err) {
          log(`    merge failed for ${d.id}: ${(err as Error).message}`);
        }
      }
      const status =
        keeper.status === "hidden"
          ? (round.end ?? round.start) < TODAY
            ? "completed"
            : "scheduled"
          : keeper.status;
      const fields: Record<string, unknown> = {
        name: round.name,
        name_normalized: normalizeName(round.name),
        start_date: round.start,
        end_date: round.end ?? round.start,
        series_id: canonicalId,
        status,
        visibility: "public",
      };
      if (round.website) fields.website_url = round.website;
      const { error } = await supabase
        .from("events")
        .update({ ...fields, updated_at: now() })
        .eq("id", keeper.id);
      if (error) throw new Error(error.message);

      const lockFields: Record<string, unknown> = {
        name: round.name,
        start_date: round.start,
        end_date: round.end ?? round.start,
        series_id: canonicalId,
      };
      if (round.website) lockFields.website_url = round.website;
      const { data: existing } = await supabase
        .from("event_overrides")
        .select("fields,locked_fields")
        .eq("event_id", keeper.id)
        .maybeSingle();
      const merged = { ...((existing?.fields as Record<string, unknown>) ?? {}), ...lockFields };
      const locked = [
        ...new Set([...((existing?.locked_fields as string[]) ?? []), ...Object.keys(lockFields)]),
      ];
      const { error: ovErr } = await supabase
        .from("event_overrides")
        .upsert(
          { event_id: keeper.id, fields: merged, locked_fields: locked, updated_by: UPDATED_BY },
          { onConflict: "event_id" },
        );
      if (ovErr) throw new Error(ovErr.message);
    }

    // 4. Whatever is left in the series is not a round of it.
    for (const e of rows) {
      if (claimed.has(e.id)) continue;
      const junk = plan.junk?.(e) ?? false;
      log(`  detach: ${e.start_date} ${e.status} ${e.name}${junk ? " (junk, hidden)" : ""}`);
      if (DRY) continue;
      const patch: Record<string, unknown> = { series_id: null, updated_at: now() };
      if (junk) patch.status = "hidden";
      const { error } = await supabase.from("events").update(patch).eq("id", e.id);
      if (error) throw new Error(error.message);
    }

    const after = await loadSeries();
    log(`  → ${plan.slug} now: ${after.filter((e) => e.status !== "hidden").length} races`);
    for (const e of after) log(`     ${e.start_date}  ${e.status.padEnd(9)} ${e.name}`);
  }

  for (const slug of EMPTY_DUPLICATE_SERIES) {
    const id = await seriesIdBySlug(slug);
    if (!id) continue;
    const { count } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("series_id", id);
    if (count) {
      log(`keep ${slug}: ${count} events`);
      continue;
    }
    log(`delete empty series ${slug}`);
    if (!DRY) await supabase.from("series").delete().eq("id", id);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
