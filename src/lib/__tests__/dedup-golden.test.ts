import { describe, expect, it } from "vitest";
import { assessDuplicate, type DedupEvent } from "@/lib/dedup";

/**
 * A fixed set of pairs whose answer is known: the same race listed by two sources, and races that only
 * look alike. A change to the scorer must not make any of them go the wrong way. Add a pair when a
 * real mistake is found, in either direction: a wrong merge, or a double the system let stand.
 */
type Pair = { label: string; a: DedupEvent; b: DedupEvent };
const at = (name: string, over: Partial<DedupEvent> = {}): DedupEvent => ({ name, startDate: "2027-06-05", countryCode: "CZ", placeText: "Žernovka", disciplines: ["mtb"], ...over });

/** Must be merged: one race, two listings. */
const same: Pair[] = [
  { label: "same race, name with and without the year", a: at("Pinguin Žernovský bajk", { urls: ["https://zernovskybajk.cz/"] }), b: at("Pinguin Žernovský bajk 2027", { urls: ["https://zernovskybajk.cz/"] }) },
  { label: "same race, diacritics dropped by one source", a: at("Žernovský bajk Pinguin", { urls: ["https://zernovskybajk.cz/"] }), b: at("Zernovsky bajk Pinguin", { urls: ["https://zernovskybajk.cz/"] }) },
  { label: "same race, www and locale in the address", a: at("Kamptal Trophy", { countryCode: "AT", placeText: "Langenlois", urls: ["https://www.kamptal-trophy.at/en/race"] }), b: at("Kamptal Trophy", { countryCode: "AT", placeText: "Langenlois", urls: ["https://kamptal-trophy.at/de/race"] }) },
  { label: "same race, one source gives the second day of a weekend", a: at("MTB Marathon Pecka", { endDate: "2027-06-06", urls: ["https://pecka.test/"] }), b: at("MTB Marathon Pecka", { startDate: "2027-06-06", urls: ["https://pecka.test/"] }) },
  { label: "same cup round, series name written two ways", a: at("Český pohár MTB - 3. kolo Nové Město", { placeText: "Nové Město na Moravě", seriesName: "Český pohár MTB" }), b: at("Czech MTB Cup 3 Nové Město na Moravě", { placeText: "Nové Město na Moravě", seriesName: "Czech MTB Cup" }) },
  // Settled by owner (2026-11-24, ROADMAP A6): distance variants and kids' races beside the main event belong to one event.
  { label: "short and long distance races of one organiser, one day", a: at("Beskydská sedmička 50 km", { urls: ["https://beskydy.test/"] }), b: at("Beskydská sedmička 100 km", { urls: ["https://beskydy.test/"] }) },
  { label: "children's race beside the main race", a: at("Kolo pro život - hlavní závod", { placeText: "Brno" }), b: at("Kolo pro život - dětský závod", { placeText: "Brno" }) },
];

/** Must stay apart: looks alike, is not the same race. */
const distinct: Pair[] = [
  { label: "XCO and XCC at one venue on one day", a: at("Pražský MTB pohár I. - XCO", { placeText: "Praha-Motol", urls: ["https://prahamtb.test/"] }), b: at("Pražský MTB pohár I. - XCC", { placeText: "Praha-Motol", urls: ["https://prahamtb.test/"] }) },
  { label: "two rounds of one cup at one venue, one address", a: at("Allwyn BMX Czech Cup - Round 9", { disciplines: ["bmx"], placeText: "Praha", urls: ["https://bmx.test/race"] }), b: at("Allwyn BMX Czech Cup - Round 10", { disciplines: ["bmx"], placeText: "Praha", urls: ["https://bmx.test/race"] }) },
  { label: "the same race a year apart", a: at("Pinguin Žernovský bajk", { startDate: "2026-06-06", urls: ["https://zernovskybajk.cz/"] }), b: at("Pinguin Žernovský bajk", { startDate: "2027-06-05", urls: ["https://zernovskybajk.cz/"] }) },
  { label: "different races in towns of one name in two countries", a: at("Sobotka MTB", { countryCode: "CZ", placeText: "Sobotka" }), b: at("Sobótka MTB", { countryCode: "PL", placeText: "Sobótka" }) },
  { label: "a road race and an MTB race of one town on one day", a: at("Memoriál Jana Veselého", { disciplines: ["road"], placeText: "Brno" }), b: at("Memoriál Jana Veselého MTB", { disciplines: ["mtb"], placeText: "Brno" }) },
];

const decision = ({ a, b }: Pair) => assessDuplicate(a, b).decision;

describe("golden pairs for duplicate detection", () => {
  it.each(same.map((pair) => [pair.label, pair] as const))("merges: %s", (_label, pair) => {
    expect(decision(pair)).toBe("match");
  });

  it.each(distinct.map((pair) => [pair.label, pair] as const))("keeps apart: %s", (_label, pair) => {
    expect(decision(pair)).not.toBe("match");
  });

  it("scores a pair the same whichever way round it is asked", () => {
    for (const pair of [...same, ...distinct]) {
      expect(decision({ ...pair, a: pair.b, b: pair.a })).toBe(decision(pair));
    }
  });
});
