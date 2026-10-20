import { NextResponse, type NextRequest } from "next/server";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import { eventMapPath } from "@/lib/event-url";
import { listEvents } from "@/lib/events";
import { asLocale, messagesFor } from "@/lib/i18n/messages";
import { countryDisplayName } from "@/lib/geo/europe";
import { disciplineLabel } from "@/lib/i18n/taxonomy";
import { getSiteUrl } from "@/lib/seo";

/**
 * The catalogue under a set of filters, as a calendar to subscribe to.
 *
 * The same query the list and the calendar run, without the dates: a
 * subscription has to keep working next month, so it carries the filters and
 * always answers with the season around today. A race added on Tuesday is in
 * the next refresh of every calendar that asked for its kind. No account and
 * no token — it shows nothing the public catalogue does not.
 */

/** Filters arrive as the views write them: `country=CZ,SK` or repeated keys. */
function list(sp: URLSearchParams, key: string): string[] {
  return sp.getAll(key).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const locale = asLocale(sp.get("lang") ?? "cs");
  const t = messagesFor(locale);
  const site = getSiteUrl();

  const countries = list(sp, "country");
  const disciplines = list(sp, "disciplines");
  const levels = list(sp, "levels");
  const categories = list(sp, "categories");

  const events = await listEvents({
    q: sp.get("q")?.trim() || undefined,
    disciplines: disciplines.length ? disciplines : undefined,
    levels: levels.length ? levels : undefined,
    ageCategories: categories.length ? categories : undefined,
    seriesSlug: sp.get("series") || undefined,
    countryCodes: countries,
    // A month back so a race just run is still there to look up; a year ahead
    // is as far as organisers publish.
    dateFrom: isoDaysFromNow(-31),
    dateTo: isoDaysFromNow(366),
  });

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
      // Calendar apps poll on their own clock; one answer serves them all for an hour.
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
    },
  });
}
