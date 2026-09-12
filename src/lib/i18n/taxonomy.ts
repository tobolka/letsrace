import { DISCIPLINE_LABELS, RACE_LEVEL_LABELS, type Discipline, type RaceLevel } from "@/lib/taxonomy";

const disciplines: Record<string, Partial<Record<Discipline, string>>> = {
  cs: { road: "Silnice", road_race: "Silniční závod", tt: "Časovka", criterium: "Kritérium", hill_climb: "Do vrchu", cx: "Cyklokros", track: "Dráha", dh: "Sjezd", other: "Ostatní" },
  sk: { road: "Cesta", road_race: "Cestné preteky", tt: "Časovka", criterium: "Kritérium", hill_climb: "Do vrchu", cx: "Cyklokros", track: "Dráha", dh: "Zjazd", other: "Ostatné" },
  pl: { road: "Szosa", road_race: "Wyścig szosowy", tt: "Jazda na czas", criterium: "Kryterium", hill_climb: "Podjazd", cx: "Przełaj", track: "Tor", dh: "Zjazd", other: "Inne" },
};
const levels: Record<string, Partial<Record<RaceLevel, string>>> = {
  cs: { local: "Místní", regional: "Regionální", national: "Národní", continental: "Kontinentální", international: "Mezinárodní", world_cup: "Světový pohár", european_championship: "Mistrovství Evropy", world_championship: "Mistrovství světa" },
  sk: { local: "Miestne", regional: "Regionálne", national: "Národné", continental: "Kontinentálne", international: "Medzinárodné", world_cup: "Svetový pohár", european_championship: "Majstrovstvá Európy", world_championship: "Majstrovstvá sveta" },
  pl: { local: "Lokalne", regional: "Regionalne", national: "Krajowe", continental: "Kontynentalne", international: "Międzynarodowe", world_cup: "Puchar świata", european_championship: "Mistrzostwa Europy", world_championship: "Mistrzostwa świata" },
};

export function disciplineLabel(id: string, locale: string): string {
  return disciplines[locale]?.[id as Discipline] ?? DISCIPLINE_LABELS[id as Discipline] ?? id;
}

export function raceLevelLabel(id: string, locale: string): string {
  return levels[locale]?.[id as RaceLevel] ?? RACE_LEVEL_LABELS[id as RaceLevel] ?? id;
}
