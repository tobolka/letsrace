/**
 * Put the major series' rounds where they are ridden.
 *
 * A round's place text is whatever the calendar wrote in the cell — "Soumar",
 * "Drásal", "NMNM", "MČR XCR & XCO STUPNO" — and half the TBC calendar was
 * geocoded to one point south of Budějovice. The map placed Drásal 250 km
 * from Holešov. These are the towns, checked against the race pages.
 *
 * Usage: nvm use 22 && npx tsx scripts/repair-major-series-locations-2026-09-17.ts [--dry]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { geocodePlace } from "../src/lib/geocode";
import { timezoneForCountry } from "../src/lib/geo/timezones";

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
const UPDATED_BY = "major series location repair 2026-09-17";

/** series slug → round start date → { town, gps? } */
const VENUES: Record<string, Record<string, { town: string; lat?: number; lng?: number }>> = {
  "cesky-pohar-mtb": {
    "2026-07-17": { town: "Stupno" },
    "2026-09-05": { town: "Nové Město na Moravě" },
  },
  "kolo-pro-zivot": {
    "2026-05-09": { town: "Odry" },
    "2026-06-07": { town: "Prachatice" },
    "2026-06-27": { town: "Holešov" },
    "2026-08-15": { town: "Třemošnice" },
    "2026-09-05": { town: "Znojmo" },
  },
  "tbc-cyclocross": {
    // Race page: "Bernartice, vrch Posvátný (GPS – 49.3657508N, 14.3857047E)"
    "2026-09-20": { town: "Bernartice", lat: 49.3657508, lng: 14.3857047 },
    "2026-09-27": { town: "Chýnov" },
    "2026-10-11": { town: "Strakonice" },
    "2026-10-18": { town: "Litvínovice" },
    "2026-10-25": { town: "Tábor" },
    // Hurecký krpál, on the ski tow above Hůrka u Jistebnice (okres Tábor).
    "2026-11-07": { town: "Hůrka u Jistebnice", lat: 49.4699, lng: 14.5466 },
    "2026-12-06": { town: "Veselí nad Lužnicí" },
  },
};

async function main() {
  const supabase = createServerSupabase();
  const now = () => new Date().toISOString();

  for (const [slug, rounds] of Object.entries(VENUES)) {
    const { data: series } = await supabase.from("series").select("id").eq("slug", slug).maybeSingle();
    if (!series?.id) throw new Error(`series ${slug} missing`);
    console.log(`\n===== ${slug}`);

    for (const [date, venue] of Object.entries(rounds)) {
      const { data: event } = await supabase
        .from("events")
        .select("id,name,location:locations(municipality,lat,lng)")
        .eq("series_id", series.id)
        .eq("start_date", date)
        .neq("status", "hidden")
        .is("merged_into_id", null)
        .maybeSingle();
      if (!event) {
        console.log(`  ${date}: no round`);
        continue;
      }
      const loc = event.location as unknown as { municipality?: string; lat?: number; lng?: number } | null;

      let lat = venue.lat;
      let lng = venue.lng;
      if (lat == null || lng == null) {
        const geo = await geocodePlace(venue.town, "CZ");
        if (!geo) {
          console.log(`  ${date} ${event.name}: could not geocode "${venue.town}"`);
          continue;
        }
        lat = geo.lat;
        lng = geo.lng;
      }
      console.log(
        `  ${date} ${event.name}: ${loc?.municipality ?? "—"} (${loc?.lat?.toFixed(3)},${loc?.lng?.toFixed(3)}) → ${venue.town} (${lat.toFixed(3)},${lng.toFixed(3)})`,
      );
      if (DRY) continue;

      const { data: reused } = await supabase
        .from("locations")
        .select("id")
        .eq("geocode_query", venue.town)
        .eq("country_code", "CZ")
        .not("lat", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let locationId = reused?.id as string | undefined;
      if (!locationId) {
        const { data: created, error } = await supabase
          .from("locations")
          .insert({
            name: venue.town,
            municipality: venue.town,
            country_code: "CZ",
            lat,
            lng,
            geocode_query: venue.town,
            geocode_status: "ok",
            timezone: timezoneForCountry("CZ"),
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        locationId = created.id as string;
        await supabase.rpc("set_location_geog", { loc_id: locationId, lng, lat });
      }

      const { error: evErr } = await supabase
        .from("events")
        .update({ location_id: locationId, updated_at: now() })
        .eq("id", event.id);
      if (evErr) throw new Error(evErr.message);

      const { data: existing } = await supabase
        .from("event_overrides")
        .select("fields,locked_fields")
        .eq("event_id", event.id)
        .maybeSingle();
      const fields = { ...((existing?.fields as Record<string, unknown>) ?? {}), location_id: locationId };
      const locked = [...new Set([...((existing?.locked_fields as string[]) ?? []), "location_id"])];
      const { error: ovErr } = await supabase
        .from("event_overrides")
        .upsert(
          { event_id: event.id, fields, locked_fields: locked, updated_by: UPDATED_BY },
          { onConflict: "event_id" },
        );
      if (ovErr) throw new Error(ovErr.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
