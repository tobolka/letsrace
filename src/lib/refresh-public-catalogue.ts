import { revalidateTag } from "next/cache";
import { PUBLIC_CATALOGUE_TAG } from "@/lib/catalogue-cache";

/**
 * Drop every public catalogue cache entry after an admin edit.
 *
 * Do not call this from watch/catalog crons: one tag covers hubs, feeds and
 * every race/series row, and a nightly invalidate rewrites the Hobby ISR and
 * Data Cache write budget when crawlers rewarm the site.
 */
export function refreshPublicCatalogue() {
  revalidateTag(PUBLIC_CATALOGUE_TAG, "max");
}
