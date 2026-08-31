/**
 * Country × discipline landing pages.
 *
 * "Cycling races in Czechia" exists; "gravel races in Czechia" did not, and the
 * second is what people actually type. These are the highest-value long-tail
 * pages this catalogue can produce, because it already holds the answer.
 *
 * The threshold matters more than the coverage. A hub listing three races is a
 * thin page competing with its own parent, so a combination has to clear
 * {@link MIN_RACES} before it is offered or indexed; below that the page still
 * renders for anyone who follows a link, but asks not to be indexed.
 */
import { createServerSupabase } from "@/lib/supabase/server";
import type { Discipline } from "@/lib/taxonomy";
import type { Locale } from "@/lib/i18n/messages";

/** Families worth a page of their own — leaves roll up into these. */
export const HUB_DISCIPLINES = ["mtb", "road", "gravel", "cx", "bmx", "track"] as const;
export type HubDiscipline = (typeof HUB_DISCIPLINES)[number];

/** Below this a hub is thinner than the country page it splits off from. */
export const MIN_RACES = 8;

export function isHubDiscipline(value: string): value is HubDiscipline {
  return (HUB_DISCIPLINES as readonly string[]).includes(value);
}

/** Leaves that roll into each family, for the `disciplines` array overlap. */
const FAMILY_LEAVES: Record<HubDiscipline, Discipline[]> = {
  mtb: ["mtb", "xco", "xcc", "xce", "xcm", "dh", "enduro"],
  road: ["road", "road_race", "tt", "criterium", "hill_climb", "gran_fondo"],
  gravel: ["gravel"],
  cx: ["cx"],
  bmx: ["bmx"],
  track: ["track"],
};

export function disciplineLeaves(family: HubDiscipline): Discipline[] {
  return FAMILY_LEAVES[family];
}

/**
 * Per-locale copy. Each title leads with the phrase a rider searches — the
 * discipline and the country — rather than with the brand.
 */
type Copy = { title: string; description: string };
const DISCIPLINE_COPY: Record<Locale, Record<HubDiscipline, Copy>> = {
  en: {
    mtb: { title: "MTB races in {name}", description: "Every mountain bike race in {name} — cross-country, marathon, downhill and enduro. {count} upcoming, with dates, start towns and entry links." },
    road: { title: "Road races in {name}", description: "Road racing in {name} — road races, time trials, criteriums and gran fondos. {count} upcoming, with dates, start towns and entry links." },
    gravel: { title: "Gravel races in {name}", description: "Gravel racing in {name}: {count} upcoming events, with dates, start towns and entry links." },
    cx: { title: "Cyclocross races in {name}", description: "The cyclocross season in {name}: {count} upcoming races, with dates, start towns and entry links." },
    bmx: { title: "BMX races in {name}", description: "BMX racing in {name}: {count} upcoming events, with dates, venues and entry links." },
    track: { title: "Track races in {name}", description: "Track racing in {name}: {count} upcoming meetings, with dates, velodromes and entry links." },
  },
  cs: {
    mtb: { title: "MTB závody — {name}", description: "Všechny závody na horských kolech v zemi {name} — cross country, maraton, sjezd i enduro. {count} nadcházejících, s termíny, místem startu a odkazy na přihlášky." },
    road: { title: "Silniční závody — {name}", description: "Silniční cyklistika v zemi {name} — závody, časovky, kritéria i gran fondo. {count} nadcházejících, s termíny, místem startu a odkazy na přihlášky." },
    gravel: { title: "Gravel závody — {name}", description: "Gravelové závody v zemi {name}: {count} nadcházejících, s termíny, místem startu a odkazy na přihlášky." },
    cx: { title: "Cyklokros — {name}", description: "Cyklokrosová sezóna v zemi {name}: {count} nadcházejících závodů, s termíny, místem startu a odkazy na přihlášky." },
    bmx: { title: "BMX závody — {name}", description: "BMX v zemi {name}: {count} nadcházejících závodů, s termíny, místem konání a odkazy na přihlášky." },
    track: { title: "Dráhová cyklistika — {name}", description: "Dráhové závody v zemi {name}: {count} nadcházejících, s termíny, velodromy a odkazy na přihlášky." },
  },
  sk: {
    mtb: { title: "MTB preteky — {name}", description: "Všetky preteky na horských bicykloch v krajine {name} — cross country, maratón, zjazd aj enduro. {count} nadchádzajúcich, s termínmi, miestom štartu a odkazmi na prihlášky." },
    road: { title: "Cestné preteky — {name}", description: "Cestná cyklistika v krajine {name} — preteky, časovky, kritériá aj gran fondo. {count} nadchádzajúcich, s termínmi, miestom štartu a odkazmi na prihlášky." },
    gravel: { title: "Gravel preteky — {name}", description: "Gravelové preteky v krajine {name}: {count} nadchádzajúcich, s termínmi, miestom štartu a odkazmi na prihlášky." },
    cx: { title: "Cyklokros — {name}", description: "Cyklokrosová sezóna v krajine {name}: {count} nadchádzajúcich pretekov, s termínmi, miestom štartu a odkazmi na prihlášky." },
    bmx: { title: "BMX preteky — {name}", description: "BMX v krajine {name}: {count} nadchádzajúcich pretekov, s termínmi, miestom konania a odkazmi na prihlášky." },
    track: { title: "Dráhová cyklistika — {name}", description: "Dráhové preteky v krajine {name}: {count} nadchádzajúcich, s termínmi, velodrómami a odkazmi na prihlášky." },
  },
  pl: {
    mtb: { title: "Wyścigi MTB — {name}", description: "Wszystkie wyścigi MTB w kraju {name} — cross country, maraton, downhill i enduro. {count} nadchodzących, z terminami, miejscem startu i zapisami." },
    road: { title: "Wyścigi szosowe — {name}", description: "Kolarstwo szosowe w kraju {name} — wyścigi, czasówki, kryteria i gran fondo. {count} nadchodzących, z terminami, miejscem startu i zapisami." },
    gravel: { title: "Wyścigi gravelowe — {name}", description: "Wyścigi gravelowe w kraju {name}: {count} nadchodzących, z terminami, miejscem startu i zapisami." },
    cx: { title: "Przełaje — {name}", description: "Sezon przełajowy w kraju {name}: {count} nadchodzących wyścigów, z terminami, miejscem startu i zapisami." },
    bmx: { title: "Wyścigi BMX — {name}", description: "BMX w kraju {name}: {count} nadchodzących wyścigów, z terminami, miejscem i zapisami." },
    track: { title: "Kolarstwo torowe — {name}", description: "Wyścigi torowe w kraju {name}: {count} nadchodzących, z terminami, torami i zapisami." },
  },
};

export function disciplineCopy(locale: Locale, family: HubDiscipline): Copy {
  return DISCIPLINE_COPY[locale][family];
}

export type HubCombo = { countryCode: string; discipline: HubDiscipline; races: number };

/**
 * Country × discipline pairs that clear the threshold.
 *
 * One grouped query rather than a request per pair: the sitemap needs all of
 * them, and the country hub needs its own row, on every render.
 */
export async function listQualifyingHubs(countryCodes: string[]): Promise<HubCombo[]> {
  if (!countryCodes.length) return [];
  const supabase = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const rows: { disciplines: string[] | null; locations: { country_code?: string } | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("events")
      .select("disciplines, locations!inner(country_code)")
      .eq("visibility", "public")
      .gte("start_date", today)
      .in("locations.country_code", countryCodes)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as typeof rows));
    if (!data || data.length < 1000) break;
  }

  const tally = new Map<string, number>();
  for (const row of rows) {
    const cc = row.locations?.country_code;
    if (!cc) continue;
    const disciplines = row.disciplines ?? [];
    // A race counts once per family, and MTB wins over road when a listing
    // carries both — the specific family is what the visitor came for.
    for (const family of HUB_DISCIPLINES) {
      if (FAMILY_LEAVES[family].some((d) => disciplines.includes(d))) {
        const key = `${cc}|${family}`;
        tally.set(key, (tally.get(key) ?? 0) + 1);
        break;
      }
    }
  }

  return [...tally.entries()]
    .map(([key, races]) => {
      const [countryCode, discipline] = key.split("|") as [string, HubDiscipline];
      return { countryCode, discipline, races };
    })
    .filter((c) => c.races >= MIN_RACES)
    .sort((a, b) => a.countryCode.localeCompare(b.countryCode) || b.races - a.races);
}
