import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import { eventMapPath } from "@/lib/event-url";
import { getSiteUrl } from "@/lib/seo";
import { messagesFor } from "@/lib/i18n/messages";

export const dynamic = "force-dynamic";

const EMBED =
  "id, name, slug, start_date, end_date, updated_at, registration_url, website_url, location:locations(name, municipality, country_code)";

type Row = {
  id: string;
  name: string;
  slug: string;
  start_date: string;
  end_date: string | null;
  updated_at: string | null;
  registration_url: string | null;
  website_url: string | null;
  location:
    | { name: string | null; municipality: string | null; country_code: string | null }
    | { name: string | null; municipality: string | null; country_code: string | null }[]
    | null;
};

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * The signed-in rider's plan, as a calendar anyone's phone can subscribe to.
 *
 * The token in the path is the whole authority: calendar clients send no
 * cookies. It reveals only races already in that person's own plan, and the
 * account page can mint a new one, which retires every copy of the old link.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: raw } = await params;
  const token = raw.replace(/\.ics$/i, "");
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = createServerSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, locale")
    .eq("ics_token", token)
    .maybeSingle();
  if (!profile) return new NextResponse("Not found", { status: 404 });

  const locale = (profile.locale as string | null) || "cs";
  const t = messagesFor(locale);
  const site = getSiteUrl();

  // A season either side: last year's races stay visible in a calendar app,
  // and nobody wants a feed that quietly drops what they did in April.
  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);
  const since = from.toISOString().slice(0, 10);

  const [{ data: favs }, { data: atts }] = await Promise.all([
    supabase
      .from("event_favorites")
      .select(`event:events(${EMBED})`)
      .eq("user_id", profile.id),
    supabase
      .from("event_attendance")
      .select(`event:events(${EMBED})`)
      .eq("user_id", profile.id),
  ]);

  const byId = new Map<string, Row>();
  for (const row of [...(favs ?? []), ...(atts ?? [])] as unknown as { event: Row | Row[] | null }[]) {
    const ev = unwrap(row.event);
    if (!ev || ev.start_date < since) continue;
    byId.set(ev.id, ev);
  }

  const events: IcsEvent[] = [...byId.values()]
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map((ev) => {
      const loc = unwrap(ev.location);
      const place = [loc?.municipality || loc?.name, loc?.country_code].filter(Boolean).join(", ");
      const link = `${site}${eventMapPath(locale, {
        slug: ev.slug,
        startDate: ev.start_date,
        endDate: ev.end_date,
      })}`;
      return {
        uid: `${ev.id}@letsrace.cz`,
        startDate: ev.start_date,
        endDate: ev.end_date,
        summary: ev.name,
        location: place || null,
        description: [ev.registration_url || ev.website_url, link].filter(Boolean).join("\n"),
        url: link,
        updatedAt: ev.updated_at,
      };
    });

  const body = buildIcs({
    name: t.planTitle,
    description: t.planSubtitle,
    events,
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="letsrace.ics"',
      "Cache-Control": "private, max-age=600",
    },
  });
}
