import { locale as rootLocale } from "next/root-params";
import { BrowseHeader } from "@/components/browse/browse-ui";
import { notFoundCopy } from "@/components/browse/not-found-help";
import { browseCrumbs } from "@/lib/browse-trail";
import { asLocale } from "@/lib/i18n/messages";
import { MissingRaceHelp } from "./missing-race-help";

/**
 * An address no race has — served with a real 404, but still with a search
 * filled in from the address's words, not a bare error. (One that clearly
 * names a race never gets here: the page sends it on to that race.)
 *
 * Nothing here reads the request: race pages are cached, and a not-found
 * boundary that did would turn them dynamic again.
 */
export default async function RaceNotFound() {
  const locale = asLocale((await rootLocale()) ?? "");
  const c = notFoundCopy[locale];
  return (
    <main className="relative min-h-full bg-background">
      <BrowseHeader locale={locale} crumbs={[...browseCrumbs(locale, { country: null, family: null }), { label: c.raceTitle }]} />
      <MissingRaceHelp locale={locale} />
    </main>
  );
}
