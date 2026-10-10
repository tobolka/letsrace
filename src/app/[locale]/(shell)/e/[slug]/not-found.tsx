import { headers } from "next/headers";
import { BrowseHeader } from "@/components/browse/browse-ui";
import { NotFoundHelp, notFoundCopy } from "@/components/browse/not-found-help";
import { RaceLinkList } from "@/components/seo/race-link-list";
import { browseCrumbs } from "@/lib/browse-trail";
import { parseRaceSlug } from "@/lib/event-slug";
import { findRacesForMissingSlug } from "@/lib/events";
import { asLocale } from "@/lib/i18n/messages";

/**
 * An address no race has — served with a real 404 now, but still with the
 * races it may have meant and a search, not a bare error. (One that clearly
 * names a race never gets here: the page sends it on to that race.)
 *
 * A not-found boundary gets no params, so the slug comes from the address the
 * proxy saw, the same way the locale does.
 */
export default async function RaceNotFound() {
  const h = await headers();
  const locale = asLocale(h.get("x-locale") ?? "");
  const slug = decodeURIComponent((h.get("x-pathname") ?? "").split("/").filter(Boolean).pop() ?? "");
  const { near } = slug
    ? await findRacesForMissingSlug(slug).catch(() => ({ near: [] }))
    : { near: [] };
  const c = notFoundCopy[locale];
  return (
    <main className="relative min-h-full bg-background">
      <BrowseHeader locale={locale} crumbs={[...browseCrumbs(locale, { country: null, family: null }), { label: c.raceTitle }]} />
      <NotFoundHelp locale={locale} title={c.raceTitle} body={c.raceBody} query={slug ? parseRaceSlug(slug).words.join(" ") : ""}>
        {near.length ? <RaceLinkList events={near} locale={locale} groupByMonth={false} /> : null}
      </NotFoundHelp>
    </main>
  );
}
