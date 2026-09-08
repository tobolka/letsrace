import { fillEmptyAgeCategories } from "@/lib/catalog/ages";
import { mergePublicDuplicates } from "@/lib/catalog/merge-duplicates";
import { fillFciAgeCategories } from "@/lib/catalog/fci-ages";
import { fillRaceResultAgeCategories } from "@/lib/catalog/raceresult-ages";
import { mergeDuplicateLocations, type MergeLocationsResult } from "@/lib/catalog/merge-locations";

export type CatalogHygieneResult = {
  ages: { eventsFilled: number; seriesFilled: number; stillUnknown: number };
  fciAges: { attempted: number; filled: number; silent: number; failed: number };
  timingAges: { attempted: number; filled: number; silent: number; failed: number };
  duplicates: {
    events: number;
    pairs: number;
    merged: number;
    failed?: { keep: string; drop: string; error: string }[];
    dry: boolean;
    preview: { date: string; keep: string; drop: string; reasons: string[] }[];
  };
  locations: MergeLocationsResult;
};

export async function runCatalogHygiene(opts?: {
  maxAgeFills?: number;
  maxMerges?: number;
  maxLocationMerges?: number;
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
  const duplicates = await mergePublicDuplicates({
    fromDate: new Date().toISOString().slice(0, 10),
    maxMerges: opts?.maxMerges ?? 40,
  });
  // New spellings of one town arrive with every poll, and so does the odd
  // calendar that gives a country where a venue belongs.
  const locations = await mergeDuplicateLocations({ max: opts?.maxLocationMerges ?? 200 });
  return { ages, fciAges, timingAges, duplicates, locations };
}
