import { unstable_cache } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import { eventMapPath } from "@/lib/event-url";
import { listEvents } from "@/lib/events";
import { asLocale, messagesFor } from "@/lib/i18n/messages";
import { countryDisplayName, PUBLIC_COUNTRY_CODES } from "@/lib/geo/europe";
import { AGE_CATEGORY_FILTERS, DISCIPLINES, RACE_LEVELS } from "@/lib/taxonomy";
import { disciplineLabel } from "@/lib/i18n/taxonomy";
import { getSiteUrl } from "@/lib/seo";

/**
 * The catalogue under a set of filters, as a calendar to subscribe to.
 *
 * The same query the list and the calendar run, without the dates: a
 * subscription has to keep working next month, so it carries the filters and
 * always answers with the season around today. A race added on Tuesday is in
 * the next refresh of every calendar that asked for its kind. No account and
 * no token — it shows nothing the public catalogue does not. Search text is
 * left out: a free-text key would give every caller a cache entry of their own.
 */

/** Filters arrive as the views write them: `country=CZ,SK` or repeated keys. */
function list(sp: URLSearchParams, key: string): string[] {
  return sp.getAll(key).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
}

/** Only known values, once each, in one order — so one feed has one address. */
function pick(values: string[], allowed: ReadonlySet<string>): string[] {
  return [...new Set(values.filter((v) => allowed.has(v)))].sort();
}

const COUNTRIES = new Set<string>(PUBLIC_COUNTRY_CODES);
const DISCIPLINE_SET = new Set<string>(DISCIPLINES);
const LEVEL_SET = new Set<string>(RACE_LEVELS);
const CATEGORY_SET = new Set<string>(AGE_CATEGORY_FILTERS.map((c) => c.id));
const SERIES_SLUG = /^[a-z0-9-]{1,80}$/;

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * One database read per filter set per hour, however many calendars poll it.
 * The CDN already caches by URL; this also covers its misses — every region,
 * every deploy — and the key is the day plus the canonical filters.
 */
const feedEvents = unstable_cache(
  (filters: { countries: string[]; disciplines: string[]; levels: string[]; categories: string[]; series: string }, from: string, to: string) =>
    listEvents({
      disciplines: filters.disciplines.length ? filters.disciplines : undefined,
      levels: filters.levels.length ? filters.levels : undefined,
      ageCategories: filters.categories.length ? filters.categories : undefined,
      seriesSlug: filters.series || undefined,
      countryCodes: filters.countries,
      dateFrom: from,
      dateTo: to,
    }),
  ["races-ics-v1"],
  { revalidate: 3600 },
);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const locale = asLocale(sp.get("lang") ?? "cs");
  const t = messagesFor(locale);
  const site = getSiteUrl();

  const countries = pick(list(sp, "country"), COUNTRIES);
  const disciplines = pick(list(sp, "disciplines"), DISCIPLINE_SET);
  const levels = pick(list(sp, "levels"), LEVEL_SET);
  const categories = pick(list(sp, "categories"), CATEGORY_SET);
  const rawSeries = sp.get("series") ?? "";
  const series = SERIES_SLUG.test(rawSeries) ? rawSeries : "";

  /*
   * Anything but the canonical address — an unknown key, a junk value, the
   * same filters in another order — is sent to it before touching the
   * database. Otherwise `&x=1`, `&x=2`, … would each miss the cache and each
   * cost a full catalogue query.
   */
  const canonical = new URLSearchParams({ lang: locale });
  if (series) canonical.set("series", series);
  if (countries.length) canonical.set("country", countries.join(","));
  if (disciplines.length) canonical.set("disciplines", disciplines.join(","));
  if (levels.length) canonical.set("levels", levels.join(","));
  if (categories.length) canonical.set("categories", categories.join(","));
  if (canonical.toString() !== sp.toString()) {
    const to = req.nextUrl.clone();
    to.search = canonical.toString();
    return NextResponse.redirect(to, {
      status: 308,
      headers: { "Cache-Control": "public, s-maxage=86400" },
    });
  }

  // A month back so a race just run is still there to look up; a year ahead
  // is as far as organisers publish.
  const events = await feedEvents(
    { countries, disciplines, levels, categories, series },
    isoDaysFromNow(-31),
    isoDaysFromNow(366),
  );

  const items: IcsEvent[] = events.map((ev) => {
    const place = [
      ev.location?.municipality || ev.location?.name,
      ev.location?.countryCode ? countryDisplayName(ev.location.countryCode, locale) : null,
    ]
      .filter(Boolean)
      .join(", ");
    const link = `${site}${eventMapPath(locale, ev)}`;
    return {
      uid: `${ev.id}@letsrace.cz`,
      startDate: ev.startDate,
      endDate: ev.endDate,
      summary: ev.name,
      location: place || null,
      description: [ev.registrationUrl || ev.websiteUrl, link].filter(Boolean).join("\n"),
      url: link,
      updatedAt: null,
    };
  });

  const body = buildIcs({
    // Two subscriptions ("road in Austria", "kids' MTB at home") stay apart
    // in the calendar app's list only if their names say which is which.
    name: [
      "Let's Race",
      countries.map((c) => countryDisplayName(c, locale)).join(", "),
      disciplines.map((d) => disciplineLabel(d, locale)).join(", "),
    ]
      .filter(Boolean)
      .join(" · "),
    description: t.subscribeFeedTitle,
    events: items,
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="letsrace.ics"',
      // Calendar apps poll on their own clock; one answer serves them all for an
      // hour, and a stale one is served while the next is fetched.
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
