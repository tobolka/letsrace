/**
 * Hide public events the map already refuses: unlinked dumps outside home
 * markets, and camps / awards nights. Does not lock fields.
 *
 * Usage: nvm use 22 && npx tsx scripts/curate-home-map.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isNonRaceEventName, shouldSkipUnlinkedDumpInsert } from "../src/lib/event-visibility";
import { createServerSupabase } from "../src/lib/supabase/server";

try {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const val = m[2]!.replace(/^["']|["']$/g, "");
    if (!process.env[m[1]!]) process.env[m[1]!] = val;
  }
} catch {
  /* ignore */
}

type Row = {
  id: string;
  name: string;
  website_url: string | null;
  registration_url: string | null;
  location: { country_code?: string | null } | { country_code?: string | null }[] | null;
};

function countryOf(row: Row): string | null {
  const loc = Array.isArray(row.location) ? row.location[0] : row.location;
  return loc?.country_code ?? null;
}

async function main() {
  const supabase = createServerSupabase();
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, name, website_url, registration_url, location:locations(country_code)",
      )
      .eq("visibility", "public")
      .gte("start_date", "2026-01-01")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < 1000) break;
  }

  const hideIds: string[] = [];
  let dumps = 0;
  let junk = 0;
  for (const row of rows) {
    if (isNonRaceEventName(row.name)) {
      hideIds.push(row.id);
      junk += 1;
      continue;
    }
    if (
      shouldSkipUnlinkedDumpInsert({
        websiteUrl: row.website_url,
        registrationUrl: row.registration_url,
        location: { countryCode: countryOf(row) },
      })
    ) {
      hideIds.push(row.id);
      dumps += 1;
    }
  }

  for (let i = 0; i < hideIds.length; i += 80) {
    const chunk = hideIds.slice(i, i + 80);
    const { error } = await supabase
      .from("events")
      .update({ visibility: "hidden", updated_at: new Date().toISOString() })
      .in("id", chunk);
    if (error) throw new Error(error.message);
  }

  console.log({ scanned: rows.length, hiddenDumps: dumps, hiddenNonRaces: junk });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
