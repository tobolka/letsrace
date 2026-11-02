import { revalidatePath, revalidateTag } from "next/cache";
import { publicEventTag } from "@/lib/catalogue-cache";
import { locales } from "@/lib/i18n/messages";

/**
 * The pages an organiser's change shows on, refreshed at once: the race in
 * every language and the series page. Nothing wider — one organiser's edit
 * must not make the whole catalogue rebuild.
 */
export async function refreshOrganizerPages(raceSlugs: string[], seriesSlugs: string[] = []) {
  for (const slug of raceSlugs) {
    revalidateTag(publicEventTag(slug), { expire: 0 });
    for (const locale of locales) revalidatePath(`/${locale}/e/${slug}`);
  }
  for (const slug of seriesSlugs) {
    for (const locale of locales) revalidatePath(`/${locale}/series/${slug}`);
  }
}
