import { fillEmptyAgeCategories } from "@/lib/catalog/ages";
import { mergePublicDuplicates } from "@/lib/catalog/merge-duplicates";
import { fillFciAgeCategories } from "@/lib/catalog/fci-ages";
import { fillRaceResultAgeCategories } from "@/lib/catalog/raceresult-ages";
import { fillRegulationAgeCategories } from "@/lib/catalog/regulation-ages";
import { carryForwardFromPreviousEditions } from "@/lib/catalog/previous-edition";
import { fillFciWebsites } from "@/lib/catalog/fci-website";
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

export async function runCatalogHygiene(opts?: {
  maxAgeFills?: number;
  maxMerges?: number;
  maxLocationMerges?: number;
  maxCompletions?: number;
}): Promise<CatalogHygieneResult> {
  const ages = await fillEmptyAgeCategories({
    maxEvents: opts?.maxAgeFills ?? 400,
    upcomingOnly: true,
  });
  // Italian races state their categories on their own page and nowhere else,
  // so a handful are read directly each run rather than guessed at.
  const fciAges = await fillFciAgeCategories({ max: 40 });
  // Timing platforms name their contests, and the names carry the categories.
  const timingAges = await fillRaceResultAgeCategories({ max: 30 });
  // Everyone else states them in the propozice; a few are read each run.
  const regulationAges = await fillRegulationAgeCategories({ max: 20 });
  // What last year's edition knew, for this year's that knows less.
  const previousEditions = await carryForwardFromPreviousEditions();
  // Italian races carry no website field; the organiser names it anyway.
  const fciWebsites = await fillFciWebsites({ max: 30 });
  // Austrian calendar rows name only the federal state; the race page says more.
  const austria = await fillCyclingAustriaDetails({ max: 30 });
  // A person's word on a series goes to every round, new ones included.
  const seriesAges = await applySeriesAgesToRounds();
  // Where to enter, from the race's own page.
  const registrationLinks = await fillRegistrationLinks({ max: 30 });
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
  return { ages, fciAges, timingAges, regulationAges, previousEditions, fciWebsites, austria, seriesAges, registrationLinks, seriesDisciplines, duplicates, locations, completed };
}
