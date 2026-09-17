/**
 * Seed official 2026 calendars supplied for CZ series that were missing/partial.
 * Sources (priority: official pages / ICS as given 2026-09-17).
 *
 * Usage: npx tsx scripts/seed-official-calendars-user-urls-2026-09-17.ts [--dry]
 */
import { readFileSync } from "node:fs";
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

type Round = {
  start: string;
  name: string;
  place: string;
  website?: string;
  disciplines?: string[];
  also?: string[];
  cancelled?: boolean;
};

type Plan = {
  slug: string;
  website: string;
  source: string;
  disciplines: string[];
  rounds: Round[];
};

const PLANS: Plan[] = [
  {
    slug: "jesenicky-snek",
    website: "https://jesenickysnek.cz/calendar",
    source: "jesenickysnek.cz/calendar",
    disciplines: ["mtb", "xco", "xcm", "road", "tt"],
    rounds: [
      { start: "2026-04-25", name: "Časovka Velká Kraš — Mistrovství Olomouckého kraje", place: "Velká Kraš", disciplines: ["road", "tt"] },
      { start: "2026-05-08", name: "Rychlebská 30 MTB", place: "Javorník", disciplines: ["mtb", "xcm"] },
      { start: "2026-05-16", name: "MTB po Jesenické magistrále", place: "Rýmařov", disciplines: ["mtb", "xcm"] },
      { start: "2026-05-23", name: "VC Losiny", place: "Velké Losiny", disciplines: ["mtb", "xco"] },
      { start: "2026-05-30", name: "MND dětský závod", place: "Kouty nad Desnou", disciplines: ["mtb"] },
      { start: "2026-06-06", name: "MTB short track Jeseník", place: "Jeseník", disciplines: ["mtb", "xcc"] },
      { start: "2026-06-13", name: "Křížová stezka", place: "Zlaté Hory", disciplines: ["mtb", "xco"] },
      { start: "2026-06-14", name: "Buldočí časovka", place: "Rapotín", disciplines: ["road", "tt"] },
      { start: "2026-06-27", name: "Čas-OFF-kA na Šerák", place: "Bělá pod Pradědem", disciplines: ["mtb", "tt"] },
      { start: "2026-08-09", name: "O cenu Rapotína", place: "Rapotín", disciplines: ["mtb", "xco"] },
      { start: "2026-08-22", name: "XC Hynčice", place: "Hynčice pod Sušinou", disciplines: ["mtb", "xco"] },
      { start: "2026-09-05", name: "Českopetrovická koolna", place: "České Petrovice", disciplines: ["mtb", "xco"] },
      { start: "2026-09-12", name: "XC Loko Krnov", place: "Krnov", disciplines: ["mtb", "xco"] },
      { start: "2026-09-19", name: "Jesenický MTB minimaraton", place: "Jeseník", disciplines: ["mtb", "xcm"] },
      { start: "2026-10-03", name: "XC Jeseník", place: "Jeseník", disciplines: ["mtb", "xco"] },
    ],
  },
  {
    slug: "cyklomanek",
    website: "https://www.cykloman.cz/cyklomanek-2026",
    source: "cykloman.cz/cyklomanek-2026",
    disciplines: ["mtb", "road", "tt"],
    rounds: [
      { start: "2026-05-24", name: "Cyklománek — Terénní časovka", place: "Moravská Třebová", disciplines: ["mtb", "tt"] },
      { start: "2026-06-07", name: "Cyklománek — MCC", place: "Moravská Třebová", disciplines: ["mtb"] },
      { start: "2026-06-13", name: "Cyklománek — Bredy Maraton", place: "Moravská Třebová", disciplines: ["mtb", "xcm"] },
      { start: "2026-08-01", name: "Cyklománek — Triatlon", place: "Moravská Třebová", disciplines: ["other"] },
      { start: "2026-08-22", name: "Cyklománek — Duatlon Powerman Kunčina", place: "Kunčina", disciplines: ["other"] },
      { start: "2026-09-12", name: "Cyklománek — Babí léto", place: "Moravská Třebová", disciplines: ["mtb"] },
      { start: "2026-10-11", name: "Cyklománek — Silniční časovka", place: "Moravská Třebová", disciplines: ["road", "tt"] },
      { start: "2026-10-17", name: "Cyklománek — Jízda do vrchu", place: "Moravská Třebová", disciplines: ["road"] },
    ],
  },
  {
    slug: "sumpersky-pohar-mtb",
    website: "https://www.spmtb.cz/",
    source: "vysledky.spmtb.cz/sezona/2026 + ICS",
    disciplines: ["mtb", "xco", "xcm", "tt"],
    rounds: [
      { start: "2026-04-25", name: "MTB Křižák 2026", place: "Břevenec", website: "https://www.spmtb.cz/kalendar-akce/mtb-krizak-brevenec/", disciplines: ["mtb", "xco"] },
      { start: "2026-05-02", name: "Grand Prix Šumperk 2026", place: "Šumperk", website: "https://www.spmtb.cz/kalendar-akce/grand-prix-sumperk/", disciplines: ["mtb", "xco"] },
      { start: "2026-05-16", name: "Tessuti Sport Bike race 2026", place: "Dluhoňovice", website: "https://www.spmtb.cz/kalendar-akce/tessuti-sport-bike-race/", disciplines: ["mtb", "xco"] },
      { start: "2026-05-23", name: "VC Velké Losiny 2026", place: "Velké Losiny", website: "https://www.spmtb.cz/kalendar-akce/vc-velke-losiny/", disciplines: ["mtb", "xco"], also: ["jesenicky-snek"] },
      { start: "2026-05-30", name: "XC Troubelice 2026", place: "Troubelice", website: "https://www.spmtb.cz/kalendar-akce/xc-troubelice/", disciplines: ["mtb", "xco"] },
      { start: "2026-06-20", name: "VC Kolšova 2026", place: "Kolšov", website: "https://www.spmtb.cz/kalendar-akce/vc-kolsova-mtb/", disciplines: ["mtb", "xco"] },
      { start: "2026-07-05", name: "Časovka na Senovou 2026", place: "Hrabenov", website: "https://www.spmtb.cz/kalendar-akce/casovka-na-senovou/", disciplines: ["mtb", "tt"] },
      { start: "2026-07-18", name: "Jeřáb 1003 2026", place: "Červená Voda", website: "https://www.spmtb.cz/kalendar-akce/jerab-1003/", disciplines: ["mtb", "xcm"] },
      { start: "2026-07-26", name: "Králecký úvoz 2026", place: "Králec", website: "https://www.spmtb.cz/kalendar-akce/kralecky-uvoz/", disciplines: ["mtb", "xco"] },
      { start: "2026-08-01", name: "CBA Paprsek XC 2026", place: "Paprsek", website: "https://www.spmtb.cz/kalendar-akce/cba-paprsek-xc/", disciplines: ["mtb", "xco"] },
      { start: "2026-08-09", name: "O cenu Rapotína 2026", place: "Rapotín", website: "https://www.spmtb.cz/kalendar-akce/o-cenu-rapotina/", disciplines: ["mtb", "xco"], also: ["jesenicky-snek"] },
      { start: "2026-08-22", name: "Hynčice 2026", place: "Hynčice pod Sušinou", website: "https://www.spmtb.cz/kalendar-akce/hyncice/", disciplines: ["mtb", "xco"], also: ["jesenicky-snek"] },
      { start: "2026-09-06", name: "Mohelnický půlmaraton 2026", place: "Mohelnice", website: "https://www.spmtb.cz/kalendar-akce/mohelnicky-1-2-maraton/", disciplines: ["mtb", "xcm"] },
    ],
  },
  {
    slug: "severoceska-amaterska-liga",
    website: "https://www.amaterskaliga.cz/zavody/2026",
    source: "amaterskaliga.cz/zavody/2026",
    disciplines: ["road", "tt"],
    rounds: [
      { start: "2026-04-18", name: "Bílinská časovka", place: "Bílina", disciplines: ["road", "tt"] },
      { start: "2026-04-25", name: "Peklo Severu Road N°1 / Velká cena Nobilis Tilia", place: "Krásná Lípa", disciplines: ["road"], also: ["peklo-severu-road"] },
      { start: "2026-04-26", name: "Peklo Severu Road N°2 / Česká Kamenice", place: "Česká Kamenice", disciplines: ["road"], also: ["peklo-severu-road"] },
      { start: "2026-05-17", name: "Krupka — Komáří Vížka", place: "Krupka", disciplines: ["road"] },
      { start: "2026-05-28", name: "Praha — Doksy", place: "Doksy", disciplines: ["road"] },
      { start: "2026-05-31", name: "Tuchořice", place: "Tuchořice", disciplines: ["road"] },
      { start: "2026-06-07", name: "Velká cena Bíliny — O Radovesickou kostku", place: "Bílina", disciplines: ["road"] },
      { start: "2026-07-18", name: "Mistrovství ČR Masters / SAC — časovka jednotlivců", place: "Česko", disciplines: ["road", "tt"] },
      { start: "2026-07-19", name: "Mistrovství ČR a SR Masters / SAC — silniční závod", place: "Česko", disciplines: ["road"] },
      { start: "2026-08-02", name: "Kolem Posázaví", place: "Posázaví", disciplines: ["road"] },
      { start: "2026-08-09", name: "Most — Lesná 2026", place: "Most", disciplines: ["road"] },
      { start: "2026-08-22", name: "Svinčice — Mistrovství SAL 2026", place: "Svinčice", disciplines: ["road"] },
      { start: "2026-09-05", name: "Tour de Zeleňák 54/106 km", place: "Zeleňák", disciplines: ["road"] },
      { start: "2026-09-13", name: "Klikovy vrchy", place: "Klikovy vrchy", disciplines: ["road"] },
      { start: "2026-09-20", name: "Kraslické dny cyklistiky 2026 — Kraslický šíp", place: "Kraslice", disciplines: ["road"] },
      { start: "2026-09-27", name: "Maraton Česká Lípa — Memoriál Josefa Vlasáka", place: "Česká Lípa", disciplines: ["road"] },
    ],
  },
  {
    slug: "kuklik-xco",
    website: "https://www.kuklikxco.cz/kuklikxco2025/",
    source: "kuklikxco.cz (stránka 2026)",
    disciplines: ["mtb", "xco"],
    rounds: [
      { start: "2026-04-08", name: "KUKLÍK XCO — 1. závod", place: "Kuklík, Kutná Hora" },
      { start: "2026-04-22", name: "KUKLÍK XCO — 2. závod", place: "Kuklík, Kutná Hora" },
      { start: "2026-05-06", name: "KUKLÍK XCO — 3. závod", place: "Kuklík, Kutná Hora" },
      { start: "2026-05-20", name: "KUKLÍK XCO — 4. závod", place: "Kuklík, Kutná Hora" },
      { start: "2026-06-03", name: "KUKLÍK XCO — 5. závod", place: "Kuklík, Kutná Hora" },
      { start: "2026-06-07", name: "KUKLÍK XCO — 6. závod / Mistrovství Kutné Hory", place: "Kuklík, Kutná Hora" },
    ],
  },
  {
    slug: "kolo-kolem-komina",
    website: "https://www.kolokolemkomina.cz/zavody/",
    source: "kolokolemkomina.cz/zavody",
    disciplines: ["mtb", "xco"],
    rounds: [
      { start: "2026-05-16", name: "Kotvinské pedály", place: "Kotvina" },
      { start: "2026-06-06", name: "Čejkovická pohodovka", place: "Čejkovice" },
      { start: "2026-08-29", name: "Wembloudovy hrby", place: "Klášterec nad Ohří" },
      { start: "2026-09-26", name: "O věnec buřtů", place: "Klášterec nad Ohří" },
      { start: "2026-09-28", name: "Žatecký cyklista", place: "Žatec" },
      { start: "2026-10-03", name: "Mýtinka Cup", place: "Klášterec nad Ohří" },
      { start: "2026-10-10", name: "Cestou pěti potoků", place: "Klášterec nad Ohří" },
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
    .select("id")
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

  const tokens = normalizeName(round.name)
    .split(" ")
    .filter((t) => t.length > 3)
    .slice(0, 2);
  if (tokens.length) {
    const { data: day } = await supabase
      .from("events")
      .select("id, name")
      .eq("start_date", round.start)
      .is("merged_into_id", null)
      .ilike("name", `%${tokens.join("%")}%`)
      .limit(8);
    const exact = (day || []).find((d) => normalizeName(d.name) === normalizeName(round.name));
    if (exact) return exact.id as string;
    if (day?.length === 1) return day[0]!.id as string;
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
        fingerprint: useFp,
        disciplines: round.disciplines || plan.disciplines,
        audience: plan.slug === "cyklomanek" || plan.slug === "kuklik-xco" ? "kids" : "mixed",
        status: round.start < now.slice(0, 10) ? "completed" : "scheduled",
        visibility: "public",
        website_url: round.website || plan.website,
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
  const now = new Date().toISOString();
  let created = 0;
  let linked = 0;

  for (const plan of PLANS) {
    console.log(`\n===== ${plan.slug} (${plan.source})`);
    const sid = await seriesId(supabase, plan.slug);
    if (!sid) {
      console.log("  MISSING SERIES");
      continue;
    }

    if (!DRY) {
      await supabase
        .from("series")
        .update({
          website_url: plan.website,
          source_url: plan.website,
          source_kind: "official",
          updated_at: now,
          last_seen_at: now,
        })
        .eq("id", sid);
    }

    for (const round of plan.rounds) {
      if (round.cancelled) {
        console.log("  SKIP cancelled", round.start, round.name);
        continue;
      }
      const id = await findOrCreate(supabase, plan, round);
      if (!id) continue;
      if (!DRY) {
        const { data: ev } = await supabase.from("events").select("series_id").eq("id", id).maybeSingle();
        if (!ev?.series_id) {
          await attachEventSeries(supabase, id, sid, { primary: true, source: "official-calendar-seed" });
          created++;
        } else if (ev.series_id !== sid) {
          await attachSecondarySeries(supabase, id, sid, "official-calendar-seed");
          linked++;
        } else {
          await attachEventSeries(supabase, id, sid, { primary: true, source: "official-calendar-seed" });
          linked++;
        }
        for (const also of round.also || []) {
          const aid = await seriesId(supabase, also);
          if (aid) await attachSecondarySeries(supabase, id, aid, "official-calendar-seed-also");
        }
        await supabase
          .from("events")
          .update({ visibility: "public", updated_at: now, last_seen_at: now })
          .eq("id", id);
      }
      console.log("  OK", round.start, round.name);
    }

    if (!DRY) {
      const listed = await listEvents({ seriesSlug: plan.slug });
      console.log(`  => listEvents=${listed.length}`);
    }
  }

  console.log(`\nDone createdish=${created} linked=${linked} dry=${DRY}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
