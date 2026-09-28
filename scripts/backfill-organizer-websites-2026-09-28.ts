/**
 * Give races the organiser's own site where only an entry platform is known.
 *
 * raceresult's crawl used to write its entry page over the organiser site that
 * radsport-events had supplied, and never looked for one itself — so a race
 * like the SZ-Fahrradfest showed "Registration" and nothing to read. Both
 * sources name the organiser: radsport-events in `organizerUrl`, raceresult in
 * the event page's JSON-LD. Ask them again for every upcoming race that lacks
 * a website.
 *
 *   npx tsx scripts/backfill-organizer-websites-2026-09-28.ts          # dry run
 *   npx tsx scripts/backfill-organizer-websites-2026-09-28.ts --apply
 */
import { readFileSync } from "fs";
import { resolve } from "path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
import { createServerSupabase } from "../src/lib/supabase/server";
import { publicRaceUrl, resolveEventOutboundUrls } from "../src/lib/watcher/public-url";
import { isRegistrationPlatformUrl } from "../src/lib/watcher/registration-url";
import { raceresultOrganizerUrl } from "../src/lib/watcher/extractors/raceresult";
import { fetchText } from "../src/lib/watcher/http";

const APPLY = process.argv.includes("--apply");
const today = new Date().toISOString().slice(0, 10);

type Row = {
  id: string;
  name: string;
  start_date: string;
  website_url: string | null;
  registration_url: string | null;
  regulations_url: string | null;
  results_url: string | null;
  series: { website_url: string | null } | null;
  sources: { source_url: string | null }[] | null;
  overrides: { locked_fields: string[] | null } | { locked_fields: string[] | null }[] | null;
};

async function radsportOrganizer(url: string): Promise<string | null> {
  const id = url.match(/radsport-events\.de\/events\/(\d+)/)?.[1];
  if (!id) return null;
  const res = await fetchText(`https://api.radsport-events.de/api/v1/events/${id}`, {
    accept: "application/json",
    timeoutMs: 15_000,
  }).catch(() => null);
  if (!res?.ok) return null;
  try {
    return (JSON.parse(res.text) as { organizerUrl?: string | null }).organizerUrl?.trim() || null;
  } catch {
    return null;
  }
}

async function raceresultOrganizer(url: string): Promise<string | null> {
  const id = url.match(/my\.raceresult\.com\/(\d+)/)?.[1];
  if (!id) return null;
  const res = await fetchText(`https://my.raceresult.com/${id}/`, { timeoutMs: 15_000 }).catch(
    () => null,
  );
  return res?.ok ? raceresultOrganizerUrl(res.text) : null;
}

function lockedFields(row: Row): string[] {
  const o = row.overrides;
  return (Array.isArray(o) ? o[0]?.locked_fields : o?.locked_fields) ?? [];
}

async function main() {
  const sb = createServerSupabase();
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("events")
      .select(
        "id, name, start_date, website_url, registration_url, regulations_url, results_url, series:series!events_series_id_fkey(website_url), sources:event_sources(source_url), overrides:event_overrides(locked_fields)",
      )
      .gte("start_date", today)
      .eq("visibility", "public")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as Row[]));
    if ((data ?? []).length < 1000) break;
  }

  const candidates = rows.filter((r) => {
    if (lockedFields(r).includes("website_url")) return false;
    // A race whose only link is the organiser's own race page already has the
    // page to read; a homepage from the calendar would be a step down.
    if (r.website_url && !isRegistrationPlatformUrl(r.website_url)) return false;
    const out = resolveEventOutboundUrls({
      websiteUrl: r.website_url,
      registrationUrl: r.registration_url,
      regulationsUrl: r.regulations_url,
      resultsUrl: r.results_url,
      seriesWebsiteUrl: r.series?.website_url,
      sourceUrls: (r.sources ?? []).map((s) => s.source_url),
    });
    return !out.websiteUrl;
  });

  let found = 0;
  const queue = [...candidates];
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const urls = [r.registration_url, r.website_url, ...(r.sources ?? []).map((s) => s.source_url)]
        .filter((u): u is string => Boolean(u));
      let organizer: string | null = null;
      for (const u of urls) {
        organizer =
          (await radsportOrganizer(u)) ?? (await raceresultOrganizer(u));
        organizer = publicRaceUrl(organizer);
        if (organizer && !isRegistrationPlatformUrl(organizer)) break;
        organizer = null;
      }
      if (!organizer) continue;
      found++;
      console.log(`${r.start_date}  ${r.name}\n    ${r.website_url ?? "—"}  →  ${organizer}`);
      if (APPLY) {
        const { error } = await sb
          .from("events")
          .update({ website_url: organizer, updated_at: new Date().toISOString() })
          .eq("id", r.id);
        if (error) console.error(`    ! ${error.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker));

  console.log(
    `\n${rows.length} upcoming public races, ${candidates.length} without a website, ${found} organiser sites found${APPLY ? " and written" : " (dry run)"}.`,
  );
}

main();
