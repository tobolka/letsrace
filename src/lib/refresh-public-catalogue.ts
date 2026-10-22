import { revalidateTag } from "next/cache";
import { PUBLIC_CATALOGUE_TAG } from "@/lib/catalogue-cache";

/** Drop every public catalogue cache entry after a watch or an admin edit. */
export function refreshPublicCatalogue() {
  revalidateTag(PUBLIC_CATALOGUE_TAG, "max");
}
