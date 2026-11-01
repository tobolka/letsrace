import { describe, expect, it, vi } from "vitest";
import { isAuxiliaryDiscoveryUrl } from "@/lib/watcher/discovery-policy";
import { looksLikeIndependentRaceUrl, queueDiscoveredLink } from "@/lib/watcher/explore";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ from }) }));

describe("discovery noise found during the 207-link review", () => {
  const auxiliary = [
    "https://kolopro.cz/photo-pg-8246---.jpg",
    "https://registrace.sportsoft.cz/startlist.aspx?e=3519",
    "https://registrace.sportsoft.cz/registration.aspx?e=3519",
    "https://casomeric.cz/registration/reg_form_VP.php?zavod=4468",
    "https://stopnito.cz/prihlaseni-na-zavod/1154",
    "https://pretekaj.sk/sk/vysledky/vrl2025/2733?category=categories",
    "https://spindlerovka-cup.cz/galerie.html",
    "https://cyklosvec.cz/sponzoring-pg8.php",
    "https://race.cz/startovn%C3%AD-listina/2027",
    "https://race.cz/trasy/zavod.gpx",
    "https://race.cz/informace-o-zpracovani-osobnich-udaju",
  ];
  it.each(auxiliary)("keeps supporting material out of independent discovery: %s", url => {
    expect(isAuxiliaryDiscoveryUrl(url)).toBe(true);
    expect(looksLikeIndependentRaceUrl(url)).toBe(false);
  });
  it.each([
    "https://vesani.cz/propozice-deti",
    "https://cyklobrani.cz/o-zavodu/deti-a-cyklobrani",
    "https://rst-luebeck.de/wp-content/uploads/2026/09/Termine-Cyclo-Cross-Rennen-2026_27.pdf",
    "https://miko-cycles.cz/mamut/mamut-tour/propozice",
    "https://puchar-beskid.pl/zapisy",
    "https://granfondo-lago.it/iscrizioni",
    "https://race.cz/novinky/terminy-2027",
    "https://team-cup.cz/rennen-2027",
  ])("preserves regulations, PDFs, kids races and announcements: %s", url => {
    expect(isAuxiliaryDiscoveryUrl(url)).toBe(false);
  });
  it("cannot force registration forms or archived results into the database", async () => {
    from.mockClear();
    for (const url of auxiliary) expect(await queueDiscoveredLink(url, { force: true })).toBe(false);
    expect(await queueDiscoveredLink("https://club.cz/rennen-2017", { force: true })).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
});
