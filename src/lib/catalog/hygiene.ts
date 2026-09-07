import { fillEmptyAgeCategories } from "@/lib/catalog/ages";
import { mergePublicDuplicates } from "@/lib/catalog/merge-duplicates";
import { fillFciAgeCategories } from "@/lib/catalog/fci-ages";

export type CatalogHygieneResult = {
  ages: { eventsFilled: number; seriesFilled: number; stillUnknown: number };
  fciAges: { attempted: number; filled: number; silent: number; failed: number };
  duplicates: {
    events: number;
    pairs: number;
    merged: number;
    failed?: { keep: string; drop: string; error: string }[];
    dry: boolean;
    preview: { date: string; keep: string; drop: string; reasons: string[] }[];
  };
};

export async function runCatalogHygiene(opts?: {
  maxAgeFills?: number;
  maxMerges?: number;
}): Promise<CatalogHygieneResult> {
  const ages = await fillEmptyAgeCategories({
    maxEvents: opts?.maxAgeFills ?? 400,
    upcomingOnly: true,
  });
  // Italian races state their categories on their own page and nowhere else,
  // so a handful are read directly each run rather than guessed at.
  const fciAges = await fillFciAgeCategories({ max: 40 });
  const duplicates = await mergePublicDuplicates({
    fromDate: new Date().toISOString().slice(0, 10),
    maxMerges: opts?.maxMerges ?? 40,
  });
  return { ages, fciAges, duplicates };
}
