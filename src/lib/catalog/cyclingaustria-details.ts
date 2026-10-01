import * as cheerio from "cheerio";
import { createServerSupabase } from "@/lib/supabase/server";
import { clearProbe, recentlyProbed, recordProbe } from "@/lib/catalog/probes";
import { ageCategoriesFromList } from "@/lib/age-bands";
import { audienceFromAgeCategories } from "@/lib/taxonomy";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { geocodePlace } from "@/lib/geocode";

const PAGE = 1000;
const CA_EVENT = /cyclingaustria\.at\/index\.php\?[^#]*view=event[^#]*id=([A-F0-9]+)/i;
/** What the calendar gives instead of a place: a federal state, or less. */
const REGION_ONLY =
  /^(nieder|ober|niederösterreich|oberösterreich|kärnten|steiermark|tirol|vorarlberg|burgenland|austria|österreich)$/i;

export type CyclingAustriaDetail = {
  /** "Waidhofen/Ybbs", from "Start/Ziel: 3340 Waidhofen/Ybbs". */
  town: string | null;
  /** Each class with its birth years: "Jugend m/w Jg. 2011 – 2013". */
  classes: string[];
  website: string | null;
};

/**
 * A race page on cyclingaustria.at.
 *
 * The calendar names only the federal state, so 39 Austrian races sat in the
 * middle of Lower Austria, Upper Austria or Carinthia. The race page says
 * where the start is, which classes run with their birth years, and links the
 * organiser's own site.
 */
export function parseCyclingAustriaDetail(html: string): CyclingAustriaDetail {
  const $ = cheerio.load(html);
  $("script, style").remove();
  const parts = $("body")
    .text()
    .split(/\n|\t/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const after = (label: RegExp) => {
    const i = parts.findIndex((p) => label.test(p));
    return i >= 0 ? (parts[i + 1] ?? null) : null;
  };
  const FIELD_LABEL = /^(datum|beginn|ende|sparte|disziplin|kategorien?|veranstalter|kontakt|rennen\s*\d*|zur[uü]ck.*)/i;
  let rawPlace = after(/^(Start\/Ziel|Start|Austragungsort|Ort)$/i);
  // An empty field is followed by the next label ("Datum"), not by a place.
  if (rawPlace && FIELD_LABEL.test(rawPlace.trim())) rawPlace = null;
  const town = rawPlace
    ? rawPlace.replace(/^\d{4}\s+/, "").replace(/\s*\(.*\)$/, "").split(",")[0]!.trim() || null
    : null;

  // Either a "Kategorien" field ("MEN ELITE, MEN U23, WOMEN ELITE") or, for
  // a hill climb or a kids' race, classes written out with birth years.
  const listed = (after(/^Kategorien$/i) ?? "").split(/,\s*/);
  const classes = [
    ...new Set(
      [...parts.filter((p) => /\bJg\.?\s*\d{4}/i.test(p)), ...listed]
        .flatMap((p) => p.split(/;\s*/))
        .map((c) => c.trim())
        .filter((c) => c.length > 2 && c.length < 90),
    ),
  ];

  let website: string | null = null;
  $("a").each((_, a) => {
    if (website) return;
    if (/zur\s+website/i.test($(a).text())) {
      const href = ($(a).attr("href") || "").trim();
      if (/^https?:\/\//i.test(href) && !/cyclingaustria\.at/i.test(href)) website = href;
    }
  });
  return { town, classes, website };
}

export async function fillCyclingAustriaDetails(opts?: {
  max?: number;
  dryRun?: boolean;
  log?: (line: string) => void;
}): Promise<{ attempted: number; places: number; ages: number; websites: number; silent: number; failed: number }> {
  const supabase = createServerSupabase();
  const max = opts?.max ?? 60;
  const today = new Date().toISOString().slice(0, 10);
  const skip = await recentlyProbed(supabase, "ca_details");

  type Target = {
    id: string;
    name: string;
    startDate: string;
    url: string;
    municipality: string | null;
    ageConfidence: string | null;
    ages: string[];
    website: string | null;
  };
  const targets: Target[] = [];
  for (let from = 0; targets.length < max; from += PAGE) {
    const { data } = await supabase
      .from("events")
      .select(
        "id, name, start_date, age_categories, age_confidence, website_url, location:locations(municipality), sources:event_sources(source_url)",
      )
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    const rows = (data ?? []) as unknown as {
      id: string;
      name: string;
      start_date: string;
      age_categories: string[] | null;
      age_confidence: string | null;
      website_url: string | null;
      location: { municipality: string | null } | null;
      sources: { source_url: string | null }[] | null;
    }[];
    for (const row of rows) {
      if (skip.has(row.id)) continue;
      const url = (row.sources ?? []).map((s) => s.source_url ?? "").find((u) => CA_EVENT.test(u));
      if (!url) continue;
      const needsPlace = !row.location?.municipality || REGION_ONLY.test(row.location.municipality.trim());
      const needsAges = !(row.age_categories ?? []).length || row.age_confidence !== "explicit";
      const needsWeb = !row.website_url || /cyclingaustria\.at/i.test(row.website_url);
      if (!needsPlace && !needsAges && !needsWeb) continue;
      targets.push({
        id: row.id,
        name: row.name,
        startDate: row.start_date,
        // The page itself, without the calendar's paging state.
        url: `https://www.cyclingaustria.at/index.php?option=com_events&view=event&id=${url.match(CA_EVENT)![1]}`,
        municipality: row.location?.municipality ?? null,
        ageConfidence: row.age_confidence,
        ages: row.age_categories ?? [],
        website: row.website_url,
      });
      if (targets.length >= max) break;
    }
    if (rows.length < PAGE) break;
  }

  const result = { attempted: targets.length, places: 0, ages: 0, websites: 0, silent: 0, failed: 0 };
  for (const t of targets) {
    try {
      const res = await fetch(t.url, {
        headers: { "user-agent": "letsrace-catalog/1.0 (+https://letsrace.cz)" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        result.failed += 1;
        if (!opts?.dryRun) await recordProbe(supabase, t.id, "ca_details", "failed");
        continue;
      }
      const detail = parseCyclingAustriaDetail(await res.text());
      const patch: Record<string, unknown> = {};
      const notes: string[] = [];

      if (detail.classes.length && t.ageConfidence !== "explicit") {
        const ages = ageCategoriesFromList(
          detail.classes.map((name) => ({ name })),
          { refYear: Number(t.startDate.slice(0, 4)) },
        );
        if (ages.length) {
          patch.age_categories = ages;
          patch.age_confidence = "explicit";
          patch.audience = audienceFromAgeCategories(ages);
          notes.push(`ages ${ages.join(",")}`);
        }
      }
      if (detail.website && (!t.website || /cyclingaustria\.at/i.test(t.website))) {
        patch.website_url = detail.website;
        notes.push(`web ${detail.website}`);
      }
      let newLocation: Record<string, unknown> | null = null;
      if (detail.town && (!t.municipality || REGION_ONLY.test(t.municipality.trim()))) {
        let geo: Awaited<ReturnType<typeof geocodePlace>> = null;
        try {
          geo = await geocodePlace(`${detail.town}, AT`, "AT");
        } catch {
          geo = null;
        }
        newLocation = {
          name: detail.town,
          municipality: detail.town,
          country_code: "AT",
          geocode_query: `${detail.town}, AT`,
          geocode_status: geo ? "ok" : "pending",
          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
          timezone: "Europe/Vienna",
        };
        notes.push(`place ${detail.town}${geo ? "" : " (to geocode)"}`);
      }

      if (!Object.keys(patch).length && !newLocation) {
        result.silent += 1;
        if (!opts?.dryRun) await recordProbe(supabase, t.id, "ca_details", "silent");
        continue;
      }
      opts?.log?.(`${opts?.dryRun ? "DRY" : "SET"}  ${t.startDate}  ${t.name}  → ${notes.join("; ")}`);
      if (patch.age_categories) result.ages += 1;
      if (patch.website_url) result.websites += 1;
      if (newLocation) result.places += 1;
      if (opts?.dryRun) continue;

      if (newLocation) {
        const { data: loc } = await supabase.from("locations").insert(newLocation).select("id").single();
        if (loc?.id) {
          patch.location_id = loc.id;
          if (newLocation.lat != null) {
            await supabase.rpc("set_location_geog", {
              loc_id: loc.id,
              lat: newLocation.lat,
              lng: newLocation.lng,
            });
          }
        }
      }
      patch.updated_at = new Date().toISOString();
      await supabase.from("events").update(patch).eq("id", t.id);
      await clearProbe(supabase, t.id, "ca_details");
    } catch {
      result.failed += 1;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return result;
}
