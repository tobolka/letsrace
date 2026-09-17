/**
 * Seed / attach curated rounds from official sites when parsers can't read them.
 * Dedupes by fingerprint; attaches series via event_series (secondary if needed).
 *
 * Usage: nvm use 22 && npx tsx scripts/seed-csv-official-rounds-2026-09-17.ts [--dry]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { fingerprint, normalizeName, slugifyEvent } from "../src/lib/domain";
import { attachEventSeries, attachSecondarySeries } from "../src/lib/catalog/event-series";

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

type Round = {
  start: string;
  end?: string;
  name: string;
  place: string;
  website?: string;
  disciplines?: string[];
  /** Also count toward these series (M:N). */
  also?: string[];
};

type Plan = {
  slug: string;
  website: string;
  source: string;
  rounds: Round[];
  disciplines: string[];
};

/** Ground truth read from official sites on 2026-09-17. */
const PLANS: Plan[] = [
  {
    slug: "cesky-pohar-mtb-xcm",
    website: "https://www.poharmtb.cz/maraton",
    source: "poharmtb.cz/maraton",
    disciplines: ["mtb", "xcm"],
    rounds: [
      { start: "2026-05-16", name: "Silesia Bike Marathon", place: "Opava", website: "https://www.silesiaopava.cz/bikenew/", also: ["primacup"] },
      { start: "2026-06-13", name: "Malevil Cup", place: "Jablonné v Podještědí", website: "https://malevilcup.cz/" },
      {
        start: "2026-07-25",
        name: "Šumavský MTB maraton — Tchibo Coffizz MČR XCM",
        place: "Zadov",
        website: "https://www.skisumava.cz/mtb",
      },
      { start: "2026-09-12", name: "Rallye Sudety", place: "Teplice nad Metují", website: "https://redpointteam.cz/rallye-sudety/" },
    ],
  },
  {
    slug: "author-maraton-tour",
    website: "https://cz.author.eu/maraton-tour/author-maraton-tour-2026",
    source: "cz.author.eu",
    disciplines: ["mtb", "xcm"],
    rounds: [
      { start: "2026-05-30", name: "AUTHOR KRÁL ŠUMAVY MTB", place: "Klatovy" },
      { start: "2026-06-13", name: "MALEVIL CUP BY AUTHOR", place: "Jablonné v Podještědí", also: ["cesky-pohar-mtb-xcm"] },
      { start: "2026-06-27", name: "AUTHOR VINAŘSKÁ 50", place: "Kobylí" },
      { start: "2026-09-19", name: "AUTHOR PRAŽSKÁ 50", place: "Praha" },
      { start: "2026-10-10", name: "ČT AUTHOR CUP", place: "Bedřichov" },
    ],
  },
  {
    slug: "pohar-drahanske-vrchoviny",
    website: "https://www.pohardrahanskevrchoviny.cz/",
    source: "pohardrahanskevrchoviny.cz",
    disciplines: ["mtb", "xco"],
    rounds: [
      { start: "2026-05-16", name: "Pohár Drahanské vrchoviny — Nížkovice", place: "Nížkovice" },
      { start: "2026-06-13", name: "Pohár Drahanské vrchoviny — Knínice", place: "Knínice" },
      { start: "2026-06-27", name: "Pohár Drahanské vrchoviny — Benešov", place: "Benešov" },
      { start: "2026-08-01", name: "Pohár Drahanské vrchoviny — Boskovice", place: "Boskovice" },
      { start: "2026-08-29", name: "Pohár Drahanské vrchoviny — Bořitov", place: "Bořitov" },
      { start: "2026-09-12", name: "Pohár Drahanské vrchoviny — Velenov", place: "Velenov" },
      { start: "2026-09-19", name: "Pohár Drahanské vrchoviny — Blansko", place: "Blansko" },
    ],
  },
  {
    slug: "valassky-pohar-mtb-xc",
    website: "https://www.edieteam.cz/mtb-mladeze",
    source: "edieteam.cz",
    disciplines: ["mtb", "xco"],
    rounds: [
      { start: "2026-06-13", name: "Valašský pohár — Jablůnka", place: "Jablůnka" },
      { start: "2026-08-22", name: "Valašský pohár — Semetín", place: "Vsetín" },
      { start: "2026-08-23", name: "Valašský pohár — Semetín (2)", place: "Vsetín" },
      { start: "2026-09-12", name: "Valašský pohár — Pustevny", place: "Pustevny" },
    ],
  },
  {
    slug: "czech-downhill-top-on-trail-cup",
    website: "https://www.topontrail.cz/czech-downhill-top-on-trail-cup",
    source: "topontrail.cz",
    disciplines: ["mtb", "dh"],
    rounds: [
      { start: "2026-06-07", name: "Czech Downhill — 1. kolo Bílá", place: "Bílá" },
      { start: "2026-07-19", name: "Czech Downhill — 2. kolo Liberec Ještěd", place: "Liberec" },
      { start: "2026-08-23", name: "Czech Downhill — 3. kolo Klínovec", place: "Klínovec" },
      { start: "2026-09-06", name: "Czech Downhill — 4. kolo Czarna Góra", place: "Czarna Góra" },
      { start: "2026-10-10", name: "Czech Downhill — 5. kolo Kouty nad Desnou", place: "Kouty nad Desnou" },
    ],
  },
  {
    slug: "wood-bikerally-series",
    website: "https://woodbikerallyseries.cz/",
    source: "woodbikerallyseries.cz",
    disciplines: ["mtb", "dh"],
    rounds: [
      { start: "2026-03-28", name: "WBS — Tošovice", place: "Tošovice" },
      { start: "2026-05-01", name: "WBS — Mostkovice", place: "Mostkovice" },
      { start: "2026-05-30", name: "WBS — Valašské Klobouky", place: "Valašské Klobouky" },
      { start: "2026-06-20", name: "WBS — Želechovice", place: "Želechovice" },
      { start: "2026-08-30", name: "WBS — Otrokovice", place: "Otrokovice" },
      { start: "2026-09-12", name: "WBS — Trnava", place: "Trnava" },
      { start: "2026-10-17", name: "WBS — Karolinka", place: "Karolinka" },
    ],
  },
];

async function seriesId(supabase: ReturnType<typeof createServerSupabase>, slug: string) {
  const { data } = await supabase.from("series").select("id").eq("slug", slug).maybeSingle();
  return data?.id as string | undefined;
}

async function findOrCreate(
  supabase: ReturnType<typeof createServerSupabase>,
  plan: Plan,
  round: Round,
): Promise<string | null> {
  const fp = fingerprint({ startDate: round.start, name: round.name });
  const slug = slugifyEvent(round.name, round.start);

  const { data: byFp } = await supabase
    .from("events")
    .select("id, series_id")
    .eq("fingerprint", fp)
    .is("merged_into_id", null)
    .maybeSingle();
  if (byFp?.id) return byFp.id as string;

  const { data: bySlug } = await supabase
    .from("events")
    .select("id")
    .eq("slug", slug)
    .is("merged_into_id", null)
    .maybeSingle();
  if (bySlug?.id) return bySlug.id as string;

  // Soft match: same day + overlapping name tokens
  const token = normalizeName(round.name).split(" ").filter((t) => t.length > 3).slice(0, 2).join("%");
  if (token) {
    const { data: day } = await supabase
      .from("events")
      .select("id, name, series_id")
      .eq("start_date", round.start)
      .is("merged_into_id", null)
      .ilike("name", `%${token}%`)
      .limit(5);
    if (day?.length === 1) return day[0]!.id as string;
    const exact = (day || []).find((d) => normalizeName(d.name) === normalizeName(round.name));
    if (exact) return exact.id as string;
  }

  if (DRY) {
    console.log("  WOULD CREATE", round.start, round.name);
    return null;
  }

  const now = new Date().toISOString();
  const insertOnce = async (useSlug: string, useFp: string) => {
    const { data, error } = await supabase
      .from("events")
      .insert({
        slug: useSlug,
        name: round.name,
        name_normalized: normalizeName(round.name),
        start_date: round.start,
        end_date: round.end ?? null,
        fingerprint: useFp,
        disciplines: round.disciplines || plan.disciplines,
        audience: "mixed",
        status: round.start < now.slice(0, 10) ? "completed" : "scheduled",
        visibility: "public",
        website_url: round.website || plan.website,
        source_kind: "official",
        event_type: "race",
        competition_type: "series_round",
        season: "2026",
        level: "national",
        created_at: now,
        updated_at: now,
        last_seen_at: now,
      })
      .select("id")
      .single();
    return { data, error };
  };

  let { data, error } = await insertOnce(slug, fp);
  if (error) {
    const suffix = Date.now().toString(36);
    ({ data, error } = await insertOnce(`${slug}-${suffix}`, `${fp}:${suffix}`));
    if (error) {
      console.log("  CREATE ERR", error.message, round.name);
      return null;
    }
  }
  return data!.id as string;
}

async function main() {
  const supabase = createServerSupabase();
  let created = 0;
  let linked = 0;

  for (const plan of PLANS) {
    console.log(`\n===== ${plan.slug} (${plan.source})`);
    const sid = await seriesId(supabase, plan.slug);
    if (!sid) {
      console.log("  MISSING SERIES");
      continue;
    }
    for (const round of plan.rounds) {
      const id = await findOrCreate(supabase, plan, round);
      if (!id) continue;
      if (!DRY) {
        const { data: ev } = await supabase.from("events").select("series_id").eq("id", id).maybeSingle();
        if (!ev?.series_id) {
          await attachEventSeries(supabase, id, sid, { primary: true, source: "csv-seed" });
          created++;
        } else if (ev.series_id !== sid) {
          await attachSecondarySeries(supabase, id, sid, "csv-seed");
          linked++;
        } else {
          await attachEventSeries(supabase, id, sid, { primary: true, source: "csv-seed" });
          linked++;
        }
        for (const also of round.also || []) {
          const aid = await seriesId(supabase, also);
          if (aid) await attachSecondarySeries(supabase, id, aid, "csv-seed-also");
        }
      }
      console.log("  OK", round.start, round.name);
    }
  }
  console.log(`\nDone createdish=${created} linked=${linked} dry=${DRY}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
