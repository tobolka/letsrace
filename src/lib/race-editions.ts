import { unstable_cache } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { readAllRows } from "@/lib/supabase/read-all";
import { findPreviousEdition, type EditionIdentity } from "@/lib/catalog/edition-identity";
import { PUBLIC_CATALOGUE_TAG } from "@/lib/catalogue-cache";
import { shouldHideFromMap } from "@/lib/event-visibility";
import type { EventListItem } from "@/lib/events";

type Edition = EditionIdentity & { slug: string; status: string; visibility: string };
const editionPool = unstable_cache(async (country: string, year: number) => {
  const db = createServerSupabase();
  const rows = await readAllRows<Edition>((from, to) => db.from("events")
    .select("id,name,slug,start_date,series_id,disciplines,status,visibility,location:locations!inner(lat,lng,country_code,municipality)")
    .eq("visibility", "public").is("merged_into_id", null).eq("location.country_code", country)
    .gte("start_date", `${year - 6}-01-01`).lt("start_date", `${year + 1}-01-01`)
    .order("id").range(from, to), { throwOnError: true });
  return rows.filter(row => !shouldHideFromMap(row.name, row.status === "cancelled" ? "scheduled" : row.status, row.visibility));
}, ["race-edition-pool-v1"], { revalidate: 3600, tags: [PUBLIC_CATALOGUE_TAG] });

/** Same annual matcher as the pipeline, read-only; ambiguity produces no link. */
export async function getRaceEditions(event: EventListItem) {
  const at = event.location;
  if (!at?.countryCode) return [];
  const identity: EditionIdentity = {
    id: event.id, name: event.name, start_date: event.startDate,
    series_id: event.series?.id ?? null, disciplines: event.disciplines,
    location: { lat: at.lat, lng: at.lng, country_code: at.countryCode, municipality: at.municipality },
  };
  const pool = await editionPool(at.countryCode, Number(event.startDate.slice(0, 4)));
  const matches = Array.from({ length: 5 }, (_, n) => findPreviousEdition(identity, pool, n + 1)).filter((row): row is Edition => row !== null);
  return matches.filter((row, n) => matches.findIndex(r => r.id === row.id) === n).sort((a, b) => b.start_date.localeCompare(a.start_date));
}
