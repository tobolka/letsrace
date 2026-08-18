import { fillEmptyAgeCategories } from "@/lib/catalog/ages";
import { mergePublicDuplicates } from "@/lib/catalog/merge-duplicates";

export type CatalogHygieneResult = {
  ages: { eventsFilled: number; seriesFilled: number; stillUnknown: number };
  duplicates: {
    events: number;
    pairs: number;
    merged: number;
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
  const duplicates = await mergePublicDuplicates({
    fromDate: new Date().toISOString().slice(0, 10),
    maxMerges: opts?.maxMerges ?? 40,
  });
  return { ages, duplicates };
}
