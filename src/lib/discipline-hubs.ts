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
import { unstable_cache } from "next/cache";
import { PUBLIC_COUNTRY_CODES } from "@/lib/geo/europe";
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
 * discipline and the country — rather than with the brand. `{in}` is the
 * country with its preposition ("v Česku"), `{races}` the counted noun
 * ("23 závodů"), both filled by the caller.
 */
type Copy = { title: string; description: string };
const DISCIPLINE_COPY: Record<Locale, Record<HubDiscipline, Copy>> = {
  en: {
    mtb: { title: "MTB races {in}", description: "{races} on mountain bikes {in} in the next 12 months: cross-country, marathon, downhill and enduro. Dates, venues, categories and entry links." },
    road: { title: "Road races {in}", description: "{races} on the road {in} in the next 12 months: road races, time trials, criteriums and gran fondos. Dates, venues, categories and entry links." },
    gravel: { title: "Gravel races {in}", description: "{races} on gravel {in} in the next 12 months, with dates, start towns, categories and entry links, all on one map." },
    cx: { title: "Cyclocross races {in}", description: "The cyclocross season {in}: {races} in the next 12 months, with dates, venues, categories and links to entry and regulations." },
    bmx: { title: "BMX races {in}", description: "BMX racing {in}: {races} in the next 12 months, with dates, tracks, categories and entry links." },
    track: { title: "Track races {in}", description: "Track cycling {in}: {races} in the next 12 months, with dates, velodromes, categories and entry links." },
  },
  cs: {
    mtb: { title: "MTB závody {in}", description: "{races} na horských kolech {in} na příštích 12 měsíců: cross country, maraton, sjezd i enduro. Termíny, místa, kategorie a přihlášky." },
    road: { title: "Silniční závody {in}", description: "{races} na silnici {in} na příštích 12 měsíců: silniční závody, časovky, kritéria i gran fondo. Termíny, místa, kategorie a přihlášky." },
    gravel: { title: "Gravel závody {in}", description: "{races} na gravelu {in} na příštích 12 měsíců – termíny, místa startu, kategorie a odkazy na přihlášky, vše na jedné mapě." },
    cx: { title: "Cyklokrosové závody {in}", description: "Cyklokrosová sezóna {in}: {races} na příštích 12 měsíců s termíny, místy, kategoriemi a odkazy na přihlášky a propozice." },
    bmx: { title: "BMX závody {in}", description: "BMX {in}: {races} na příštích 12 měsíců s termíny, tratěmi, kategoriemi a odkazy na přihlášky." },
    track: { title: "Dráhové závody {in}", description: "Dráhová cyklistika {in}: {races} na příštích 12 měsíců s termíny, velodromy, kategoriemi a odkazy na přihlášky." },
  },
  sk: {
    mtb: { title: "MTB preteky {in}", description: "{races} na horských bicykloch {in} na najbližších 12 mesiacov: cross country, maratón, zjazd aj enduro. Termíny, miesta, kategórie a prihlášky." },
    road: { title: "Cestné preteky {in}", description: "{races} na ceste {in} na najbližších 12 mesiacov: cestné preteky, časovky, kritériá aj gran fondo. Termíny, miesta, kategórie a prihlášky." },
    gravel: { title: "Gravel preteky {in}", description: "{races} na gravele {in} na najbližších 12 mesiacov – termíny, miesta štartu, kategórie a odkazy na prihlášky, všetko na jednej mape." },
    cx: { title: "Cyklokrosové preteky {in}", description: "Cyklokrosová sezóna {in}: {races} na najbližších 12 mesiacov s termínmi, miestami, kategóriami a odkazmi na prihlášky a propozície." },
    bmx: { title: "BMX preteky {in}", description: "BMX {in}: {races} na najbližších 12 mesiacov s termínmi, traťami, kategóriami a odkazmi na prihlášky." },
    track: { title: "Dráhové preteky {in}", description: "Dráhová cyklistika {in}: {races} na najbližších 12 mesiacov s termínmi, velodrómami, kategóriami a odkazmi na prihlášky." },
  },
  pl: {
    mtb: { title: "Wyścigi MTB {in}", description: "{races} MTB {in} w najbliższych 12 miesiącach: cross country, maraton, downhill i enduro. Terminy, miejsca, kategorie i zapisy." },
    road: { title: "Wyścigi szosowe {in}", description: "Kolarstwo szosowe {in}: {races} w najbliższych 12 miesiącach – wyścigi, czasówki, kryteria i gran fondo. Terminy, miejsca, kategorie i zapisy." },
    gravel: { title: "Wyścigi gravelowe {in}", description: "Gravel {in}: {races} w najbliższych 12 miesiącach – terminy, miejsca startu, kategorie i zapisy, wszystko na jednej mapie." },
    cx: { title: "Wyścigi przełajowe {in}", description: "Sezon przełajowy {in}: {races} w najbliższych 12 miesiącach z terminami, miejscami, kategoriami oraz linkami do zapisów i regulaminów." },
    bmx: { title: "Wyścigi BMX {in}", description: "BMX {in}: {races} w najbliższych 12 miesiącach z terminami, torami, kategoriami i zapisami." },
    track: { title: "Wyścigi torowe {in}", description: "Kolarstwo torowe {in}: {races} w najbliższych 12 miesiącach z terminami, welodromami, kategoriami i zapisami." },
  },
  de: {
    mtb: { title: "MTB-Rennen {in}", description: "{races} mit dem Mountainbike {in} in den nächsten 12 Monaten: Cross-Country, Marathon, Downhill und Enduro. Termine, Orte, Klassen und Anmeldung." },
    road: { title: "Straßenrennen {in}", description: "Straßenradsport {in}: {races} in den nächsten 12 Monaten – Rennen, Zeitfahren, Kriterien und Jedermannrennen. Termine, Orte, Klassen und Anmeldung." },
    gravel: { title: "Gravel-Rennen {in}", description: "Gravel {in}: {races} in den nächsten 12 Monaten – Termine, Startorte, Klassen und Anmeldelinks, alles auf einer Karte." },
    cx: { title: "Cyclocross-Rennen {in}", description: "Die Cyclocross-Saison {in}: {races} in den nächsten 12 Monaten mit Terminen, Orten, Klassen und Links zu Anmeldung und Ausschreibung." },
    bmx: { title: "BMX-Rennen {in}", description: "BMX {in}: {races} in den nächsten 12 Monaten mit Terminen, Strecken, Klassen und Anmeldelinks." },
    track: { title: "Bahnrennen {in}", description: "Bahnradsport {in}: {races} in den nächsten 12 Monaten mit Terminen, Radrennbahnen, Klassen und Anmeldelinks." },
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
/** Upcoming races per country and per discipline family, from one query. */
export type CountryTally = { countryCode: string; races: number; families: Partial<Record<HubDiscipline, number>> };

// Store the small aggregate, not thousands of race rows per page/language.
// The day is an argument so yesterday's races leave the counts at midnight.
const loadUpcomingTallies = unstable_cache(async (today: string): Promise<CountryTally[]> => {
  const supabase = createServerSupabase();

  const rows: { disciplines: string[] | null; locations: { country_code?: string } | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("events")
      .select("disciplines, locations!inner(country_code)")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .neq("event_type", "ride")
      .gte("start_date", today)
      .in("locations.country_code", [...PUBLIC_COUNTRY_CODES])
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as typeof rows));
    if (!data || data.length < 1000) break;
  }

  const by = new Map<string, CountryTally>();
  for (const row of rows) {
    const cc = row.locations?.country_code;
    if (!cc) continue;
    const t = by.get(cc) ?? { countryCode: cc, races: 0, families: {} };
    t.races += 1;
    const disciplines = row.disciplines ?? [];
    // A race counts once per family, and MTB wins over road when a listing
    // carries both — the specific family is what the visitor came for.
    for (const family of HUB_DISCIPLINES) {
      if (FAMILY_LEAVES[family].some((d) => disciplines.includes(d))) {
        t.families[family] = (t.families[family] ?? 0) + 1;
        break;
      }
    }
    by.set(cc, t);
  }
  return [...by.values()];
}, ["upcoming-country-tallies-v1"], { revalidate: 3600, tags: ["public-catalogue"] });

async function tallyUpcoming(countryCodes: string[]): Promise<CountryTally[]> {
  if (!countryCodes.length) return [];
  const wanted = new Set(countryCodes);
  const tallies = await loadUpcomingTallies(new Date().toISOString().slice(0, 10));
  return tallies.filter((t) => wanted.has(t.countryCode));
}

/** Countries with upcoming races, most races first, for the browse index. */
export async function listCountryTallies(countryCodes: string[]): Promise<CountryTally[]> {
  return (await tallyUpcoming(countryCodes)).sort((a, b) => b.races - a.races);
}

/**
 * Country × discipline pairs that clear the threshold.
 *
 * One grouped query rather than a request per pair: the sitemap needs all of
 * them, and the country hub needs its own row, on every render.
 */
export async function listQualifyingHubs(countryCodes: string[]): Promise<HubCombo[]> {
  return (await tallyUpcoming(countryCodes))
    .flatMap((t) =>
      (Object.entries(t.families) as [HubDiscipline, number][]).map(([discipline, races]) => ({ countryCode: t.countryCode, discipline, races })),
    )
    .filter((c) => c.races >= MIN_RACES)
    .sort((a, b) => a.countryCode.localeCompare(b.countryCode) || b.races - a.races);
}
