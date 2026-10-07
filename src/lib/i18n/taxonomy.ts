import {
  AGE_CATEGORY_LABELS,
  DISCIPLINE_LABELS,
  RACE_LEVEL_LABELS,
  type AgeCategory,
  type Discipline,
  type RaceLevel,
} from "@/lib/taxonomy";

const disciplines: Record<string, Partial<Record<Discipline, string>>> = {
  cs: { road: "Silnice", road_race: "Silniční závod", tt: "Časovka", criterium: "Kritérium", hill_climb: "Do vrchu", cx: "Cyklokros", track: "Dráha", dh: "Sjezd", other: "Ostatní" },
  sk: { road: "Cesta", road_race: "Cestné preteky", tt: "Časovka", criterium: "Kritérium", hill_climb: "Do vrchu", cx: "Cyklokros", track: "Dráha", dh: "Zjazd", other: "Ostatné" },
  pl: { road: "Szosa", road_race: "Wyścig szosowy", tt: "Jazda na czas", criterium: "Kryterium", hill_climb: "Podjazd", cx: "Przełaj", track: "Tor", dh: "Zjazd", other: "Inne" },
  de: { road: "Straße", road_race: "Straßenrennen", tt: "Zeitfahren", criterium: "Kriterium", hill_climb: "Bergrennen", cx: "Cyclocross", track: "Bahn", dh: "Downhill", gran_fondo: "Jedermann", other: "Sonstiges" },
};
const levels: Record<string, Partial<Record<RaceLevel, string>>> = {
  cs: { local: "Místní", regional: "Regionální", national: "Národní", continental: "Kontinentální", international: "Mezinárodní", world_cup: "Světový pohár", european_championship: "Mistrovství Evropy", world_championship: "Mistrovství světa" },
  sk: { local: "Miestne", regional: "Regionálne", national: "Národné", continental: "Kontinentálne", international: "Medzinárodné", world_cup: "Svetový pohár", european_championship: "Majstrovstvá Európy", world_championship: "Majstrovstvá sveta" },
  pl: { local: "Lokalne", regional: "Regionalne", national: "Krajowe", continental: "Kontynentalne", international: "Międzynarodowe", world_cup: "Puchar świata", european_championship: "Mistrzostwa Europy", world_championship: "Mistrzostwa świata" },
  de: { local: "Lokal", regional: "Regional", national: "National", continental: "Kontinental", international: "International", world_cup: "Weltcup", european_championship: "Europameisterschaft", world_championship: "Weltmeisterschaft" },
};

// The U-numbers and "U23" read the same in every language; only the words move.
const ageCategories: Record<string, Partial<Record<AgeCategory, string>>> = {
  cs: { kids: "Děti", youth: "Mládež", junior: "Junioři", elite: "Elite", amateur: "Amatéři", masters: "Masters" },
  sk: { kids: "Deti", youth: "Mládež", junior: "Juniori", elite: "Elite", amateur: "Amatéri", masters: "Masters" },
  pl: { kids: "Dzieci", youth: "Młodzież", junior: "Juniorzy", elite: "Elita", amateur: "Amatorzy", masters: "Masters" },
  de: { kids: "Kinder", youth: "Jugend", junior: "Junioren", elite: "Elite", amateur: "Hobby", masters: "Masters" },
};

export function ageCategoryLabel(id: string, locale: string): string {
  return ageCategories[locale]?.[id as AgeCategory] ?? AGE_CATEGORY_LABELS[id as AgeCategory] ?? id;
}

export function disciplineLabel(id: string, locale: string): string {
  return disciplines[locale]?.[id as Discipline] ?? DISCIPLINE_LABELS[id as Discipline] ?? id;
}

export function raceLevelLabel(id: string, locale: string): string {
  return levels[locale]?.[id as RaceLevel] ?? RACE_LEVEL_LABELS[id as RaceLevel] ?? id;
}

/** The ages a U-band covers, as a parent would say it: "9–10 let". */
const BAND_AGES: Record<string, [number | null, number]> = {
  u7: [null, 6],
  u9: [7, 8],
  u11: [9, 10],
  u13: [11, 12],
  u15: [13, 14],
  u17: [15, 16],
};

export function ageBandHint(id: string, locale: string): string {
  const range = BAND_AGES[id];
  if (!range) return "";
  const [from, to] = range;
  const unit = { cs: "let", sk: "rokov", pl: "lat", de: "J.", en: "yrs" }[locale] ?? "yrs";
  if (from == null) return { cs: `do ${to} let`, sk: `do ${to} rokov`, pl: `do ${to} lat`, de: `bis ${to} J.`, en: `under ${to + 1}` }[locale] ?? `under ${to + 1}`;
  return `${from}–${to} ${unit}`;
}

/** What a filter group covers, for its help text: "do 10 let", "11–16 let". */
export function ageGroupHint(id: string, locale: string): string {
  const yrs = (a: string) =>
    ({ cs: `${a} let`, sk: `${a} rokov`, pl: `${a} lat`, de: `${a} J.`, en: `${a} yrs` })[locale] ?? `${a} yrs`;
  const upTo = (n: number) =>
    ({ cs: `do ${n} let`, sk: `do ${n} rokov`, pl: `do ${n} lat`, de: `bis ${n} J.`, en: `up to ${n} yrs` })[locale] ?? `up to ${n} yrs`;
  const anyAge = ({ cs: "každý věk", sk: "každý vek", pl: "każdy wiek", de: "jedes Alter", en: "any age" })[locale] ?? "any age";
  switch (id) {
    case "kids":
      return upTo(10);
    case "youth":
      return yrs("11–16");
    case "junior":
      return yrs("17–18");
    case "u23":
      return yrs("19–22");
    case "elite":
      return yrs("19+");
    case "amateur":
      return anyAge;
    case "masters":
      return yrs("35+");
    default:
      return "";
  }
}

/** Age range for a chip tooltip. One short line, no essay. */
export function ageCategoryHelp(id: string, locale: string): string {
  return ageBandHint(id, locale) || ageGroupHint(id, locale);
}

/** What a UCI class code means, in one line. The number is not a score. */
export function uciClassHelp(id: string, locale: string): string {
  const copy: Record<string, Record<string, string>> = {
    en: {
      "1.1": "One day, higher UCI class",
      "1.2": "One day, lower UCI class",
      "2.1": "Stage race, higher UCI class",
      "2.2": "Stage race, lower UCI class",
      hc: "Top UCI one-day class",
      c1: "UCI class 1",
      c2: "UCI class 2",
      c3: "UCI class 3",
      worldtour: "UCI WorldTour",
      proseries: "UCI ProSeries",
    },
    cs: {
      "1.1": "Jeden den, vyšší třída UCI",
      "1.2": "Jeden den, nižší třída UCI",
      "2.1": "Etapa, vyšší třída UCI",
      "2.2": "Etapa, nižší třída UCI",
      hc: "Nejvyšší jednodenní třída UCI",
      c1: "UCI třída 1",
      c2: "UCI třída 2",
      c3: "UCI třída 3",
      worldtour: "UCI WorldTour",
      proseries: "UCI ProSeries",
    },
    sk: {
      "1.1": "Jeden deň, vyššia trieda UCI",
      "1.2": "Jeden deň, nižšia trieda UCI",
      "2.1": "Etapa, vyššia trieda UCI",
      "2.2": "Etapa, nižšia trieda UCI",
      hc: "Najvyššia jednodňová trieda UCI",
      c1: "UCI trieda 1",
      c2: "UCI trieda 2",
      c3: "UCI trieda 3",
      worldtour: "UCI WorldTour",
      proseries: "UCI ProSeries",
    },
    pl: {
      "1.1": "Jeden dzień, wyższa klasa UCI",
      "1.2": "Jeden dzień, niższa klasa UCI",
      "2.1": "Etapowy, wyższa klasa UCI",
      "2.2": "Etapowy, niższa klasa UCI",
      hc: "Najwyższa klasa UCI na jeden dzień",
      c1: "Klasa UCI 1",
      c2: "Klasa UCI 2",
      c3: "Klasa UCI 3",
      worldtour: "UCI WorldTour",
      proseries: "UCI ProSeries",
    },
    de: {
      "1.1": "Ein Tag, höhere UCI-Klasse",
      "1.2": "Ein Tag, niedrigere UCI-Klasse",
      "2.1": "Etappenrennen, höhere UCI-Klasse",
      "2.2": "Etappenrennen, niedrigere UCI-Klasse",
      hc: "Höchste UCI-Eintagesklasse",
      c1: "UCI-Klasse 1",
      c2: "UCI-Klasse 2",
      c3: "UCI-Klasse 3",
      worldtour: "UCI WorldTour",
      proseries: "UCI ProSeries",
    },
  };
  return copy[locale]?.[id] ?? copy.en[id] ?? "";
}
