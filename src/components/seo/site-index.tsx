import Link from "next/link";
import { listEvents } from "@/lib/events";
import type { Locale } from "@/lib/i18n/messages";
import { countryDisplayName, isListedCountry } from "@/lib/geo/europe";
import { disciplineCopy, listQualifyingHubs } from "@/lib/discipline-hubs";
import { fillCopy, hubCopy, inCountry } from "@/lib/seo";
import { addDaysIso, raceCopy, seriesIn, shortDate } from "@/lib/seo-race-copy";
import { eventPagePath } from "@/lib/event-url";
import { collectionCopy, COLLECTION_SLUGS } from "@/lib/race-collections";
import { collectionPath, hubPath, localePath } from "@/lib/localized-paths";

/** The about page, in the nav a crawler reads first. */
const ABOUT: Record<Locale, string> = { cs: "O projektu", en: "About", pl: "O projekcie", sk: "O projekte", de: "Über das Projekt" };

/** The markets we cover most, first. */
const CORE = ["CZ", "SK", "PL", "DE", "AT", "IT", "CH"];

/**
 * A plain index of the site for anyone not using the map — a crawler above
 * all. The home page is a map drawn in the browser, so it held no link to a
 * country, a series or a race: Google could reach them from the sitemap and
 * nowhere else. Kept visually hidden and out of the way of the map; it is the
 * same links the hubs show, not a second page hidden behind the first.
 */
export async function SiteIndex({ locale }: { locale: Locale }) {
  const today = new Date().toISOString().slice(0, 10);
  const [hubs, soon] = await Promise.all([
    listQualifyingHubs(CORE).catch(() => []),
    listEvents({ countryCodes: CORE, dateFrom: today, dateTo: addDaysIso(today, 9) }).catch(() => []),
  ]);
  const rc = raceCopy[locale];
  const series = seriesIn(await listEvents({ countryCodes: CORE, dateFrom: today, dateTo: addDaysIso(today, 120) }).catch(() => [])).slice(0, 24);
  const countries = CORE.filter((c) => isListedCountry(c));

  return (
    <nav aria-label={rc.allRaces} className="sr-only">
      <h2>{collectionCopy[locale].heading}</h2>
      <ul>
        {COLLECTION_SLUGS.map((slug) => (
          <li key={slug}><Link href={`/${locale}/${collectionPath(locale, slug)}`}>{collectionCopy[locale].collections[slug].label}</Link></li>
        ))}
      </ul>
      <h2>{rc.byCountry}</h2>
      <ul>
        {countries.map((c) => {
          const where = inCountry(c, countryDisplayName(c, locale), locale);
          return (
            <li key={c}>
              <Link href={`/${locale}/${hubPath(locale, c)}`}>{fillCopy(hubCopy[locale].countryTitle, { in: where })}</Link>
              <ul>
                {hubs
                  .filter((h) => h.countryCode === c)
                  .map((h) => (
                    <li key={h.discipline}>
                      <Link href={`/${locale}/${hubPath(locale, c, h.discipline)}`}>
                        {fillCopy(disciplineCopy(locale, h.discipline).title, { in: where })}
                      </Link>
                    </li>
                  ))}
              </ul>
            </li>
          );
        })}
      </ul>
      {series.length > 0 && (
        <>
          <h2>{rc.series}</h2>
          <ul>
            {series.map((s) => (
              <li key={s.slug}>
                <Link href={localePath(locale, `series/${s.slug}`)}>{s.name}</Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {soon.length > 0 && (
        <>
          <h2>{rc.upcoming}</h2>
          <ul>
            {soon.slice(0, 40).map((e) => (
              <li key={e.id}>
                <Link href={eventPagePath(locale, e.slug)}>
                  {e.name} – {shortDate(e.startDate, locale)}
                  {e.location?.municipality ? `, ${e.location.municipality}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <Link href={`/${locale}/about`}>{ABOUT[locale]}</Link>
    </nav>
  );
}
