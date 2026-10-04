import type { EventListItem } from "@/lib/events";
import type { Locale } from "@/lib/i18n/messages";
import { isHubDiscipline, type HubDiscipline } from "@/lib/discipline-hubs";
import { eventDisciplineFamily } from "@/lib/taxonomy";
import { disciplineLabel } from "@/lib/i18n/taxonomy";
import { countryDisplayName, isListedCountry } from "@/lib/geo/europe";
import { flagEmoji, raceCopy } from "@/lib/seo-race-copy";
import type { Crumb } from "@/components/browse/browse-ui";

function mode<T>(values: T[]): T | null {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let n = 0;
  for (const [v, c] of counts) if (c > n) [best, n] = [v, c];
  return best;
}

/**
 * Where a race or a series sits in the browse section: its country and its
 * kind of racing — for a series, the ones most of its rounds have.
 */
export function browsePlace(events: EventListItem[]): { country: string | null; family: HubDiscipline | null } {
  const country = mode(events.map((e) => e.location?.countryCode).filter((c): c is string => Boolean(c) && isListedCountry(c!)));
  const family = mode(events.map((e) => eventDisciplineFamily(e.disciplines) as string).filter(isHubDiscipline));
  return { country, family };
}

/** The trail from the browse section down to (and including) the country and discipline. */
export function browseCrumbs(locale: Locale, place: { country: string | null; family: HubDiscipline | null }): Crumb[] {
  const crumbs: Crumb[] = [{ label: raceCopy[locale].browse, href: `/${locale}/c` }];
  if (!place.country) return crumbs;
  const c = place.country.toLowerCase();
  crumbs.push({ label: `${flagEmoji(place.country)} ${countryDisplayName(place.country, locale)}`, href: `/${locale}/c/${c}` });
  if (place.family) crumbs.push({ label: disciplineLabel(place.family, locale), href: `/${locale}/c/${c}/${place.family}` });
  return crumbs;
}
