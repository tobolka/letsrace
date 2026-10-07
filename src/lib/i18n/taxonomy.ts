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

/** Range plus what the group is, for a chip tooltip. */
export function ageCategoryHelp(id: string, locale: string): string {
  const range = ageBandHint(id, locale) || ageGroupHint(id, locale);
  const meaning: Record<string, Record<string, string>> = {
    en: {
      u7: "The youngest start group.",
      u9: "Riders a year or two past the first starts.",
      u11: "Still primary-school age.",
      u13: "The first of the older youth groups.",
      u15: "Cadets, early teens.",
      u17: "The older cadets, just before junior.",
      kids: "The youngest racing groups, usually U7 to U11.",
      youth: "Older children and cadets, usually U13 to U17.",
      junior: "The last youth class, before the open races.",
      u23: "Too old for junior, not yet in the open elite.",
      elite: "Open men and women, with no upper age limit.",
      amateur: "Hobby and unlicensed riders. Any age, not a youth class.",
      masters: "Age-group racing for adults.",
    },
    cs: {
      u7: "Nejmladší startovní skupina.",
      u9: "Jezdci rok dva po prvních startech.",
      u11: "Pořád mladší školní věk.",
      u13: "První ze starších žákovských skupin.",
      u15: "Kadeti, mladší náctiletí.",
      u17: "Starší kadeti, těsně před juniory.",
      kids: "Nejmladší skupiny, obvykle U7 až U11.",
      youth: "Starší žáci a kadeti, obvykle U13 až U17.",
      junior: "Poslední mládežnická kategorie, před otevřenými závody.",
      u23: "Už ne junioři, ještě ne otevřená elita.",
      elite: "Otevřená kategorie mužů a žen, bez horního věku.",
      amateur: "Hobby a jezdci bez licence. Jakýkoli věk, ne mládež.",
      masters: "Věkové skupiny pro dospělé.",
    },
    sk: {
      u7: "Najmladšia štartová skupina.",
      u9: "Jazdci rok-dva po prvých štartoch.",
      u11: "Stále mladší školský vek.",
      u13: "Prvá zo starších žiackych skupín.",
      u15: "Kadeti, mladší tínedžeri.",
      u17: "Starší kadeti, tesne pred juniormi.",
      kids: "Najmladšie skupiny, zvyčajne U7 až U11.",
      youth: "Starší žiaci a kadeti, zvyčajne U13 až U17.",
      junior: "Posledná mládežnícka kategória, pred otvorenými pretekmi.",
      u23: "Už nie juniori, ešte nie otvorená elita.",
      elite: "Otvorená kategória mužov a žien, bez horného veku.",
      amateur: "Hobby a jazdci bez licencie. Akýkoľvek vek, nie mládež.",
      masters: "Vekové skupiny pre dospelých.",
    },
    pl: {
      u7: "Najmłodsza grupa startowa.",
      u9: "Zawodnicy rok lub dwa po pierwszych startach.",
      u11: "Wciąż wiek wczesnoszkolny.",
      u13: "Pierwsza ze starszych grup młodzieżowych.",
      u15: "Kadeci, młodsi nastolatkowie.",
      u17: "Starsi kadeci, tuż przed juniorami.",
      kids: "Najmłodsze grupy, zwykle U7 do U11.",
      youth: "Starsi żacy i kadeci, zwykle U13 do U17.",
      junior: "Ostatnia kategoria młodzieżowa, przed wyścigami open.",
      u23: "Za starzy na juniorów, jeszcze nie otwarta elita.",
      elite: "Otwarta kategoria kobiet i mężczyzn, bez górnego wieku.",
      amateur: "Hobby i zawodnicy bez licencji. Każdy wiek, nie młodzież.",
      masters: "Grupy wiekowe dla dorosłych.",
    },
    de: {
      u7: "Die jüngste Startgruppe.",
      u9: "Fahrer ein, zwei Jahre nach den ersten Starts.",
      u11: "Noch Grundschulalter.",
      u13: "Die erste der älteren Jugendgruppen.",
      u15: "Kadetten, frühe Teenager.",
      u17: "Die älteren Kadetten, knapp vor der Juniorenklasse.",
      kids: "Die jüngsten Gruppen, meist U7 bis U11.",
      youth: "Ältere Kinder und Kadetten, meist U13 bis U17.",
      junior: "Die letzte Jugendklasse, vor den offenen Rennen.",
      u23: "Zu alt für Junioren, noch nicht in der offenen Elite.",
      elite: "Offene Frauen- und Männerklasse, ohne Altersgrenze nach oben.",
      amateur: "Hobby und Fahrer ohne Lizenz. Jedes Alter, keine Jugendklasse.",
      masters: "Altersklassen für Erwachsene.",
    },
  };
  const line = meaning[locale]?.[id] ?? meaning.en[id] ?? "";
  return [range, line].filter(Boolean).join(" ");
}

/** What a UCI class code means. The number is not a score. */
export function uciClassHelp(id: string, locale: string): string {
  const copy: Record<string, Record<string, string>> = {
    en: {
      "1.1": "A UCI class, not a score. 1 means one day. .1 is the higher international class, below the WorldTour.",
      "1.2": "A UCI class, not a score. 1 means one day. .2 is the lower international class.",
      "2.1": "A UCI class, not a score. 2 means more than one day. .1 is the higher international class, below the WorldTour.",
      "2.2": "A UCI class, not a score. 2 means the race runs over more than one day. .2 is the lower international class, below the WorldTour and class 1.",
      hc: "Hors catégorie: the hardest UCI one-day class below the WorldTour.",
      c1: "UCI class 1. An international mountain-bike or cyclocross race, one step below the very top.",
      c2: "UCI class 2. An international race, one step below class 1.",
      c3: "UCI class 3. The lowest international UCI class.",
      worldtour: "UCI WorldTour. The top level of professional road racing.",
      proseries: "UCI ProSeries. The level just under the WorldTour.",
    },
    cs: {
      "1.1": "Třída UCI, ne skóre. Jednička znamená jednodenní závod. Tečka jedna je vyšší mezinárodní třída, pod WorldTour.",
      "1.2": "Třída UCI, ne skóre. Jednička znamená jednodenní závod. Tečka dva je nižší mezinárodní třída.",
      "2.1": "Třída UCI, ne skóre. Dvojka znamená víc než jeden den. Tečka jedna je vyšší mezinárodní třída, pod WorldTour.",
      "2.2": "Třída UCI, ne skóre. Dvojka znamená, že závod jede přes víc dní. Tečka dva je nižší mezinárodní třída, pod WorldTour a pod třídou 1.",
      hc: "Hors catégorie: nejtěžší jednodenní třída UCI pod WorldTour.",
      c1: "UCI třída 1. Mezinárodní závod MTB nebo cyklokrosu, o stupeň pod úplnou špičkou.",
      c2: "UCI třída 2. Mezinárodní závod, o stupeň pod třídou 1.",
      c3: "UCI třída 3. Nejnižší mezinárodní třída UCI.",
      worldtour: "UCI WorldTour. Nejvyšší úroveň profesionální silnice.",
      proseries: "UCI ProSeries. Stupeň hned pod WorldTour.",
    },
    sk: {
      "1.1": "Trieda UCI, nie skóre. Jednotka znamená jednodňové preteky. Bodka jedna je vyššia medzinárodná trieda, pod WorldTour.",
      "1.2": "Trieda UCI, nie skóre. Jednotka znamená jednodňové preteky. Bodka dva je nižšia medzinárodná trieda.",
      "2.1": "Trieda UCI, nie skóre. Dvojka znamená viac ako jeden deň. Bodka jedna je vyššia medzinárodná trieda, pod WorldTour.",
      "2.2": "Trieda UCI, nie skóre. Dvojka znamená, že preteky idú cez viac dní. Bodka dva je nižšia medzinárodná trieda, pod WorldTour a pod triedou 1.",
      hc: "Hors catégorie: najťažšia jednodňová trieda UCI pod WorldTour.",
      c1: "UCI trieda 1. Medzinárodné preteky MTB alebo cyklokrosu, o stupeň pod úplnou špičkou.",
      c2: "UCI trieda 2. Medzinárodné preteky, o stupeň pod triedou 1.",
      c3: "UCI trieda 3. Najnižšia medzinárodná trieda UCI.",
      worldtour: "UCI WorldTour. Najvyššia úroveň profesionálnej cesty.",
      proseries: "UCI ProSeries. Stupeň hneď pod WorldTour.",
    },
    pl: {
      "1.1": "Klasa UCI, nie ocena. 1 oznacza wyścig jednodniowy. .1 to wyższa klasa międzynarodowa, poniżej WorldTour.",
      "1.2": "Klasa UCI, nie ocena. 1 oznacza wyścig jednodniowy. .2 to niższa klasa międzynarodowa.",
      "2.1": "Klasa UCI, nie ocena. 2 oznacza więcej niż jeden dzień. .1 to wyższa klasa międzynarodowa, poniżej WorldTour.",
      "2.2": "Klasa UCI, nie ocena. 2 oznacza, że wyścig trwa więcej niż jeden dzień. .2 to niższa klasa międzynarodowa, poniżej WorldTour i klasy 1.",
      hc: "Hors catégorie: najtrudniejsza klasa UCI na jeden dzień, poniżej WorldTour.",
      c1: "Klasa UCI 1. Międzynarodowy wyścig MTB lub przełaj, stopień poniżej samej czołówki.",
      c2: "Klasa UCI 2. Wyścig międzynarodowy, stopień poniżej klasy 1.",
      c3: "Klasa UCI 3. Najniższa międzynarodowa klasa UCI.",
      worldtour: "UCI WorldTour. Najwyższy poziom zawodowego kolarstwa szosowego.",
      proseries: "UCI ProSeries. Poziom tuż pod WorldTour.",
    },
    de: {
      "1.1": "Eine UCI-Klasse, keine Note. 1 heißt ein Tag. .1 ist die höhere internationale Klasse, unter der WorldTour.",
      "1.2": "Eine UCI-Klasse, keine Note. 1 heißt ein Tag. .2 ist die niedrigere internationale Klasse.",
      "2.1": "Eine UCI-Klasse, keine Note. 2 heißt mehr als ein Tag. .1 ist die höhere internationale Klasse, unter der WorldTour.",
      "2.2": "Eine UCI-Klasse, keine Note. 2 heißt, das Rennen geht über mehrere Tage. .2 ist die niedrigere internationale Klasse, unter der WorldTour und Klasse 1.",
      hc: "Hors catégorie: die härteste UCI-Eintagesklasse unter der WorldTour.",
      c1: "UCI-Klasse 1. Ein internationales MTB- oder Querfeldeinrennen, eine Stufe unter der Spitze.",
      c2: "UCI-Klasse 2. Ein internationales Rennen, eine Stufe unter Klasse 1.",
      c3: "UCI-Klasse 3. Die niedrigste internationale UCI-Klasse.",
      worldtour: "UCI WorldTour. Die höchste Stufe des Profi-Straßenradsports.",
      proseries: "UCI ProSeries. Die Stufe direkt unter der WorldTour.",
    },
  };
  return copy[locale]?.[id] ?? copy.en[id] ?? "";
}
