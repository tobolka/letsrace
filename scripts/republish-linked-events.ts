/**
 * Publish races that were hidden for having no link, and have one now.
 *
 * `shouldSkipUnlinkedDumpInsert` hides a federation-dump row outside the home
 * markets until it gains a website or entry link — it sets `visibility` only and
 * leaves `status` alone. Nothing ever revisits that decision, so a race that
 * later picked up an official URL from a second source stayed hidden for the
 * season. Italy lost the most: 780 upcoming rows hidden against 30 shown.
 *
 * The `status` column is what makes this safe. Rows hidden for any other reason
 * carry `status = "hidden"` too — the duplicate merger sets both, and so does the
 * non-race rule — so restricting to `status = "scheduled"` cannot resurrect a
 * duplicate, a cancelled race, a training camp, or another sport.
 *
 * Usage:
 *   nvm use 22 && npx tsx scripts/republish-linked-events.ts --dry
 *   nvm use 22 && npx tsx scripts/republish-linked-events.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { isNonCyclingEventName } from "../src/lib/sport-gate";
import { isNonRaceEventName } from "../src/lib/event-visibility";
import { isPublicMapMarket } from "../src/lib/coverage";
import { publicRaceUrl, resolveEventOutboundUrls } from "../src/lib/watcher/public-url";
import { allowsUnlinkedPublicListing } from "../src/lib/coverage";

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

const DRY = process.argv.includes("--dry");

type Row = {
  id: string;
  name: string;
  start_date: string;
  status: string | null;
  event_type: string | null;
  fingerprint: string | null;
  website_url: string | null;
  registration_url: string | null;
  locations: { country_code?: string } | null;
  series: { website_url?: string } | null;
  sources: { source_url: string }[] | null;
  overrides: { locked_fields?: string[] }[] | null;
  categories: { name: string }[] | null;
};

async function main() {
  const supabase = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("events")
      .select(
        "id,name,start_date,status,event_type,fingerprint,website_url,registration_url," +
          "locations(country_code),series(website_url),sources:event_sources(source_url)," +
          "overrides:event_overrides(locked_fields),categories:event_categories(name)",
      )
      .eq("visibility", "hidden")
      .eq("status", "scheduled")
      .gte("start_date", today)
      .order("start_date")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }
  console.log(`skrytých nadcházejících se status=scheduled: ${rows.length}`);

  const publish: Row[] = [];
  const skipped = { noLink: 0, locked: 0, merged: 0, notRace: 0, offMarket: 0, nonTraining: 0 };
  for (const row of rows) {
    if (row.overrides?.[0]?.locked_fields?.includes("visibility")) {
      skipped.locked += 1;
      continue;
    }
    if (row.fingerprint?.startsWith("merged:")) {
      skipped.merged += 1;
      continue;
    }
    if (!isPublicMapMarket(row.locations?.country_code)) {
      skipped.offMarket += 1;
      continue;
    }
    if (row.event_type === "training") {
      skipped.nonTraining += 1;
      continue;
    }
    const cats = (row.categories ?? []).map((c) => c.name).join(" ");
    if (isNonCyclingEventName(row.name, cats) || isNonRaceEventName(row.name)) {
      skipped.notRace += 1;
      continue;
    }
    /**
     * A pin has to lead somewhere. An organiser link is best; in a market that
     * lists without one, the source's own per-race page (an FCI race detail
     * page, say) is an acceptable stand-in. Both go through the same filters the
     * ingest uses, so a login page or an aggregator hub still counts as no link.
     */
    const outbound = resolveEventOutboundUrls({
      websiteUrl: row.website_url,
      registrationUrl: row.registration_url,
      seriesWebsiteUrl: row.series?.website_url,
      sourceUrls: (row.sources ?? []).map((s) => s.source_url),
    });
    const hasOwnLink = Boolean(
      publicRaceUrl(row.website_url) || publicRaceUrl(row.registration_url) || outbound.websiteUrl,
    );
    const hasListing =
      allowsUnlinkedPublicListing(row.locations?.country_code) && Boolean(outbound.listingUrl);
    if (!hasOwnLink && !hasListing) {
      skipped.noLink += 1;
      continue;
    }
    publish.push(row);
  }

  const byCountry: Record<string, number> = {};
  for (const r of publish) {
    const cc = r.locations?.country_code ?? "??";
    byCountry[cc] = (byCountry[cc] ?? 0) + 1;
  }
  console.log(`\nke zveřejnění: ${publish.length}`, byCountry);
  console.log("přeskočeno:", skipped);
  publish.slice(0, 20).forEach((r) =>
    console.log(`   ${r.locations?.country_code} ${r.start_date} ${r.name.slice(0, 52)}`),
  );
  if (DRY) return;

  let updated = 0;
  for (const r of publish) {
    const { error } = await supabase
      .from("events")
      .update({ visibility: "public", updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) console.error(`  ! ${r.name.slice(0, 36)}: ${error.message}`);
    else updated += 1;
  }
  console.log({ updated });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
