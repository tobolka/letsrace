import { fillEmptyAgeCategories } from "@/lib/catalog/ages";
import { mergePublicDuplicates } from "@/lib/catalog/merge-duplicates";
import { fillFciAgeCategories } from "@/lib/catalog/fci-ages";
import { fillRaceResultAgeCategories } from "@/lib/catalog/raceresult-ages";
import { fillRegulationAgeCategories } from "@/lib/catalog/regulation-ages";
import { carryForwardFromPreviousEditions } from "@/lib/catalog/previous-edition";
import { fillFciWebsites } from "@/lib/catalog/fci-website";
import { fillRideAndRestLinks } from "@/lib/catalog/rideandrest-links";
import { fillCyclingAustriaDetails } from "@/lib/catalog/cyclingaustria-details";
import { applySeriesAgesToRounds } from "@/lib/catalog/series-ages";
import { fillRegistrationLinks } from "@/lib/catalog/registration-links";
import { fillDisciplinesFromSeries } from "@/lib/catalog/series-disciplines";
import { mergeDuplicateLocations, type MergeLocationsResult } from "@/lib/catalog/merge-locations";
import { completePastEvents, type CompletePastResult } from "@/lib/catalog/complete-past";

export type CatalogHygieneResult = {
  ages: { eventsFilled: number; seriesFilled: number; stillUnknown: number };
  fciAges: { attempted: number; filled: number; silent: number; failed: number };
  timingAges: { attempted: number; filled: number; silent: number; failed: number };
  regulationAges: { attempted: number; filled: number; silent: number; failed: number };
  previousEditions: { considered: number; matched: number; ages: number; disciplines: number; websites: number };
  fciWebsites: { attempted: number; filled: number; silent: number; failed: number };
  rideAndRestLinks: { attempted: number; filled: number };
  austria: { attempted: number; places: number; ages: number; websites: number; silent: number; failed: number };
  seriesAges: { series: number; rounds: number };
  registrationLinks: { attempted: number; filled: number; silent: number; failed: number };
  seriesDisciplines: { filled: number };
  duplicates: {
    events: number;
    pairs: number;
    merged: number;
    failed?: { keep: string; drop: string; error: string }[];
    dry: boolean;
    preview: { date: string; keep: string; drop: string; reasons: string[] }[];
  };
  locations: MergeLocationsResult;
  completed: CompletePastResult;
};

export type SiteReadingResult = Pick<CatalogHygieneResult, "fciAges" | "timingAges" | "regulationAges" | "fciWebsites" | "austria" | "registrationLinks">;

/**
 * The part of catalogue upkeep that reads other people's websites. It belongs where waiting
 * on a slow site costs nothing, so it runs on the Mac against its own copy of the catalogue;
 * what it finds goes back as a checked fill of what is still empty.
 */
export async function readRaceSitesForDetails(limits?: { fci?: number; timing?: number; regulations?: number; websites?: number; austria?: number; registration?: number }): Promise<SiteReadingResult> {
  // Italian races state their categories on their own page and nowhere else,
  // so a handful are read directly each run rather than guessed at.
  const fciAges = await fillFciAgeCategories({ max: limits?.fci ?? 40 });
  // Timing platforms name their contests, and the names carry the categories.
  const timingAges = await fillRaceResultAgeCategories({ max: limits?.timing ?? 30 });
  // Everyone else states them in the propozice; a few are read each run.
  const regulationAges = await fillRegulationAgeCategories({ max: limits?.regulations ?? 20 });
  // Italian races carry no website field; the organiser names it anyway.
  const fciWebsites = await fillFciWebsites({ max: limits?.websites ?? 30 });
  // Austrian calendar rows name only the federal state; the race page says more.
  const austria = await fillCyclingAustriaDetails({ max: limits?.austria ?? 30 });
  // Where to enter, from the race's own page.
  const registrationLinks = await fillRegistrationLinks({ max: limits?.registration ?? 30 });
  return { fciAges, timingAges, regulationAges, fciWebsites, austria, registrationLinks };
}

const READ_ON_THE_MAC = { attempted: 0, filled: 0, silent: 0, failed: 0 };

/** Upkeep that only needs the catalogue itself. With `siteReading: "mac"` no website is read here. */
export async function runCatalogHygiene(opts?: {
  maxAgeFills?: number;
  maxMerges?: number;
  maxLocationMerges?: number;
  maxCompletions?: number;
  siteReading?: "here" | "mac";
}): Promise<CatalogHygieneResult> {
  const ages = await fillEmptyAgeCategories({
    maxEvents: opts?.maxAgeFills ?? 400,
    upcomingOnly: true,
  });
  // Settle common series classes before paying to read individual rounds.
  const seriesAges = await applySeriesAgesToRounds();
  const read: SiteReadingResult = opts?.siteReading === "mac"
    ? { fciAges: READ_ON_THE_MAC, timingAges: READ_ON_THE_MAC, regulationAges: READ_ON_THE_MAC, fciWebsites: READ_ON_THE_MAC, austria: { attempted: 0, places: 0, ages: 0, websites: 0, silent: 0, failed: 0 }, registrationLinks: READ_ON_THE_MAC }
    : await readRaceSitesForDetails();
  const { fciAges, timingAges, regulationAges, fciWebsites, austria, registrationLinks } = read;
  // What last year's edition knew, for this year's that knows less.
  const previousEditions = await carryForwardFromPreviousEditions();
  // Last resort for a race with no site: its page on rideandrest.net.
  const rideAndRestLinks = await fillRideAndRestLinks();
  // A round with no discipline of its own is the series'.
  const seriesDisciplines = await fillDisciplinesFromSeries();
  const duplicates = await mergePublicDuplicates({
    fromDate: new Date().toISOString().slice(0, 10),
    maxMerges: opts?.maxMerges ?? 40,
  });
  // New spellings of one town arrive with every poll, and so does the odd
  // calendar that gives a country where a venue belongs.
  const locations = await mergeDuplicateLocations({ max: opts?.maxLocationMerges ?? 200 });
  // Yesterday's races stopped being scheduled overnight, so say so.
  const completed = await completePastEvents({ max: opts?.maxCompletions ?? 500 });
  return { ages, fciAges, timingAges, regulationAges, previousEditions, fciWebsites, rideAndRestLinks, austria, seriesAges, registrationLinks, seriesDisciplines, duplicates, locations, completed };
}
