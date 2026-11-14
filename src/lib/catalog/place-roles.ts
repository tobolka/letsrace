/**
 * Which place a line of a race page is about: the start, the finish, a depot or stage end on the way,
 * or the organiser's registered seat. A point-to-point race names several towns ("Start Dolní Morava,
 * Depo Olomouc, Cíl Bratislava"); only the start is where the race is held. A page that names a big
 * town first, as a depot or as the club's address, must not move the race there.
 */
import { fold } from "@/lib/text-match";

export type PlaceRole = "start" | "finish" | "depot" | "seat";

const START = /\b(?:start\w*|prezence|presentation|depart|partenza|odjazd|start ?und ?ziel|start a cil|start i meta|startovni misto|misto startu|misto konani|venue|austragungsort|veranstaltungsort|sraz)\b/;
const FINISH = /\b(?:cil|ciel|ziel|finish|arrivee|arrivo|meta|mete)\b/;
const DEPOT = /\b(?:depo|depa|depu|depot|wechselzone|transition|stage end|etappenziel|konec (?:e|etap\w*) ?\d*|konec \d+\. ?etap\w*|zakonczenie etapu)\b/;
const SEAT = /\b(?:se sidlem|sidlo|sitz|registered office|ico|ic: ?\d|adresa poradatele|anschrift)\b/;

/** The role a line gives the place it names, or null when it names none. A start-and-finish line is a start. */
export function placeRole(line: string): PlaceRole | null {
  const text = fold(line);
  if (SEAT.test(text)) return "seat";
  // "Prezence a Start - …, Depo Olomouc, Cíl - Bratislava": the line opens with the start.
  const hits = [["start", START], ["finish", FINISH], ["depot", DEPOT]].map(([role, pattern]) => ({ role: role as PlaceRole, at: text.search(pattern as RegExp) })).filter(hit => hit.at >= 0).sort((a, b) => a.at - b.at);
  // "Cíl a start", "Start/Ziel": one place for both is the start.
  const start = hits.find(hit => hit.role === "start"), finish = hits.find(hit => hit.role === "finish");
  if (start && finish && Math.abs(start.at - finish.at) <= 12) return "start";
  return hits[0]?.role ?? null;
}

/** True when a quote speaks only of a finish, a depot or the organiser's seat: never the venue. */
export function quoteIsNotTheStart(quote: string): boolean {
  const role = placeRole(quote);
  return role === "finish" || role === "depot" || role === "seat";
}

/**
 * The start's place as written after its label: "Start Dolní Morava - Sportovní areál…" gives "Dolní Morava".
 * Null when no line labels a start with a place right after the label.
 */
export function startPlace(text: string): string | null {
  const isPlace = (place: string) => /^\p{Lu}[\p{L}.'-]*(?:\s+(?:\p{Lu}[\p{L}.'-]*|nad|pod|u|v|an|am|im|der|bei|di|del))*$/u.test(place) && place.length <= 40;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    // A stage race lists its first stage as "E1 - Dolní Morava - Olomouc", "1. etapa: Jeseník – Šumperk", "Etappe 1: Graz - Leoben".
    const firstStage = /^(?:e|etapa|etape|etappe|stage|tappa)\s*1\b\.?|^1\.\s*(?:etapa|etappe|stage|tappa)\b/i.exec(line);
    if (firstStage) {
      const towns = line.slice(firstStage[0].length).replace(/^\s*[:\-–—]\s*/, "").split(/\s[-–—]\s/).map(part => part.trim());
      if (towns.length >= 2 && isPlace(towns[0]!)) return towns[0]!;
    }
    if (line.length > 200 || placeRole(line) !== "start") continue;
    const after = /^(?:prezence a )?start(?:ovní místo)?\s*[:\-–]?\s*(.+)$/i.exec(line)?.[1];
    if (!after) continue;
    const place = after.split(/\s[-–—]\s|,|\(/)[0]!.trim();
    // A place name: words starting with a capital letter, no digits, no clock.
    if (isPlace(place)) return place;
  }
  return null;
}

/**
 * The page without what it says about depots, finishes or the organiser's seat, for readers that look for
 * any town. A start line that goes on to list the depots keeps only its start: "Prezence a Start - kemp
 * Dolní Morava, Depo Olomouc, Cíl Bratislava" keeps "Prezence a Start - kemp Dolní Morava, ".
 */
export function withoutOtherPlaces(text: string): string {
  return text.split("\n").flatMap(line => {
    const role = placeRole(line);
    if (role === null) return [line];
    if (role !== "start") return [];
    const folded = fold(line);
    const cut = Math.min(...[FINISH, DEPOT, SEAT].map(pattern => folded.search(pattern)).filter(at => at > 0), line.length);
    return [line.slice(0, cut)];
  }).join("\n");
}
