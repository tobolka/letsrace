/**
 * Report card for the catalog.
 *
 * Answers "is the extracted data actually right?" with numbers instead of a
 * scroll through the map: what fraction of upcoming races carry a usable link,
 * how many still read as another sport, where the classifier and the stored row
 * disagree, and which rows are duplicates of each other.
 *
 * Read-only. Run it before and after a backfill to see what moved.
 *
 * Usage: nvm use 22 && npx tsx scripts/audit-data-quality.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { inferClassification } from "../src/lib/taxonomy";
import { isNonCyclingEventName } from "../src/lib/sport-gate";
import { resolveEventOutboundUrls } from "../src/lib/watcher/public-url";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* env may already be set */
  }
}
loadEnv();

type Row = {
  id: string;
  name: string;
  start_date: string;
  disciplines: string[] | null;
  age_categories: string[] | null;
  level: string | null;
  visibility: string | null;
  website_url: string | null;
  registration_url: string | null;
  fingerprint: string | null;
  series: { name?: string; slug?: string; website_url?: string } | null;
  locations: { municipality?: string; country_code?: string; geocode_status?: string } | null;
  categories: { name: string }[] | null;
};

const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "—");

async function main() {
  const supabase = createServerSupabase();
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("events")
      .select(
        "id,name,start_date,disciplines,age_categories,level,visibility,website_url,registration_url,fingerprint," +
          "series(name,slug,website_url),locations(municipality,country_code,geocode_status),categories:event_categories(name)",
      )
      .order("start_date")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }

  const today = new Date().toISOString().slice(0, 10);
  const pub = rows.filter((r) => r.visibility === "public");
  const upcoming = pub.filter((r) => r.start_date >= today);

  // Source URLs only for the rows that need one — joining event_sources across
  // the whole catalog exceeds the statement timeout.
  const needSources = upcoming.filter((r) => !r.website_url && !r.registration_url);
  const sourcesById = new Map<string, string[]>();
  for (let i = 0; i < needSources.length; i += 200) {
    const ids = needSources.slice(i, i + 200).map((r) => r.id);
    const { data } = await supabase
      .from("event_sources")
      .select("event_id,source_url")
      .in("event_id", ids);
    for (const row of data ?? []) {
      const list = sourcesById.get(row.event_id as string) ?? [];
      list.push(row.source_url as string);
      sourcesById.set(row.event_id as string, list);
    }
  }

  console.log(`\n═══ catalog ═══`);
  console.log(`  events            ${rows.length}`);
  console.log(`  public            ${pub.length}`);
  console.log(`  public upcoming   ${upcoming.length}`);

  console.log(`\n═══ accuracy ═══`);
  const notCycling = pub.filter((r) => isNonCyclingEventName(r.name, (r.categories ?? []).map((c) => c.name).join(" ")));
  console.log(`  public rows that read as another sport   ${notCycling.length} (${pct(notCycling.length, pub.length)})`);
  notCycling.slice(0, 10).forEach((r) => console.log(`      ${r.start_date} ${r.name.slice(0, 60)}`));

  let levelDisagrees = 0;
  let ageDisagrees = 0;
  const levelSamples: string[] = [];
  for (const r of pub) {
    const c = inferClassification({
      name: r.name,
      placeText: r.locations?.municipality,
      seriesName: r.series?.name,
      seriesSlug: r.series?.slug,
      disciplines: r.disciplines,
      categoryNames: (r.categories ?? []).map((x) => x.name),
      startDate: r.start_date,
      countryHint: r.locations?.country_code,
    });
    if (c.levelReason !== "default" && c.level !== r.level) {
      levelDisagrees += 1;
      if (levelSamples.length < 10) {
        levelSamples.push(`      ${r.level} → ${c.level} [${c.levelReason}] ${r.name.slice(0, 44)}`);
      }
    }
    if (
      c.ageConfidence === "explicit" &&
      JSON.stringify(c.ageCategories) !== JSON.stringify(r.age_categories ?? [])
    ) {
      ageDisagrees += 1;
    }
  }
  console.log(`  stored level contradicts a clear marker  ${levelDisagrees} (${pct(levelDisagrees, pub.length)})`);
  levelSamples.forEach((s) => console.log(s));
  console.log(`  stored ages contradict a stated category ${ageDisagrees} (${pct(ageDisagrees, pub.length)})`);

  const noAges = pub.filter((r) => !(r.age_categories ?? []).length).length;
  const noDisc = pub.filter((r) => !(r.disciplines ?? []).length).length;
  console.log(`  public with no age categories            ${noAges} (${pct(noAges, pub.length)})`);
  console.log(`  public with no discipline                ${noDisc} (${pct(noDisc, pub.length)})`);

  console.log(`\n═══ duplicates ═══`);
  const byFp = new Map<string, number>();
  for (const r of rows) if (r.fingerprint) byFp.set(r.fingerprint, (byFp.get(r.fingerprint) ?? 0) + 1);
  const fpDupes = [...byFp.values()].filter((n) => n > 1).length;
  const byNameDate = new Map<string, number>();
  for (const r of pub) {
    const k = `${r.start_date}|${r.name.trim().toLowerCase()}`;
    byNameDate.set(k, (byNameDate.get(k) ?? 0) + 1);
  }
  const nameDupes = [...byNameDate.values()].filter((n) => n > 1).length;
  console.log(`  exact fingerprint collisions             ${fpDupes}`);
  console.log(`  public rows sharing a name and date      ${nameDupes}`);

  console.log(`\n═══ links (upcoming public) ═══`);
  // Count the listing link too. A federation's own race page is what an Italian
  // pin points at, so ignoring it reported 573 Italian races as linkless when
  // every one of them leads somewhere.
  const byCountry = new Map<string, { n: number; web: number; reg: number; listing: number; none: number }>();
  for (const r of upcoming) {
    const cc = r.locations?.country_code ?? "??";
    const v = byCountry.get(cc) ?? { n: 0, web: 0, reg: 0, listing: 0, none: 0 };
    const outbound = resolveEventOutboundUrls({
      websiteUrl: r.website_url,
      registrationUrl: r.registration_url,
      seriesWebsiteUrl: r.series?.website_url,
      sourceUrls: sourcesById.get(r.id) ?? [],
    });
    v.n += 1;
    if (r.website_url) v.web += 1;
    if (r.registration_url) v.reg += 1;
    if (outbound.listingUrl) v.listing += 1;
    if (!r.website_url && !r.registration_url && !outbound.listingUrl) v.none += 1;
    byCountry.set(cc, v);
  }
  [...byCountry.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 12)
    .forEach(([cc, v]) =>
      console.log(
        `  ${cc}  n=${String(v.n).padStart(4)}  website=${pct(v.web, v.n).padStart(6)}  registration=${pct(v.reg, v.n).padStart(6)}  listing=${pct(v.listing, v.n).padStart(6)}  nikam=${String(v.none).padStart(3)}`,
      ),
    );

  const ungeocoded = upcoming.filter((r) => r.locations?.geocode_status !== "ok").length;
  console.log(`\n  upcoming without a resolved location     ${ungeocoded} (${pct(ungeocoded, upcoming.length)})`);
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
