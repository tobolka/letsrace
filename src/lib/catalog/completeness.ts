import { isAggregatorUrl } from "@/lib/watcher/public-url";

export const COMPLETENESS_FIELDS = ["ownWebsite", "location", "discipline", "categories"] as const;
export const CATALOG_FIELDS = ["ownWebsite", "regulations", "location", "discipline", "categories"] as const;
export type CompletenessField = typeof CATALOG_FIELDS[number];
export type CompletenessEvent = {
  website_url: string | null; regulations_url: string | null; disciplines: string[] | null;
  age_categories: string[] | null; age_confidence: string | null;
  location: { lat: number | null; lng: number | null; country_code: string | null } | null;
};
export function missingCatalogFields(e: CompletenessEvent): CompletenessField[] {
  return [
    !e.website_url || isAggregatorUrl(e.website_url) ? "ownWebsite" : null,
    !e.regulations_url ? "regulations" : null,
    e.location?.lat == null || e.location.lng == null ? "location" : null,
    !e.disciplines?.length ? "discipline" : null,
    !e.age_categories?.length || e.age_confidence !== "explicit" ? "categories" : null,
  ].filter((value): value is CompletenessField => value !== null);
}
/** Propositions are still enriched, but do not determine the 90% goal. */
export function missingCompletionFields(e: CompletenessEvent): CompletenessField[] {
  return missingCatalogFields(e).filter((field) => field !== "regulations");
}
export function countryCompletionTargets(events: CompletenessEvent[], countries = ["CZ", "SK", "AT", "DE"], goal = 0.9) {
  return countries.map((country) => {
    const rows = events.filter((e) => e.location?.country_code === country);
    const complete = rows.filter((e) => !missingCompletionFields(e).length).length;
    const target = Math.ceil(rows.length * goal);
    return { country, total: rows.length, complete, percent: rows.length ? Number((complete * 100 / rows.length).toFixed(1)) : 0,
      target, remaining: Math.max(0, target - complete),
      missing: Object.fromEntries(COMPLETENESS_FIELDS.map((field) => [field, rows.filter((e) => missingCompletionFields(e).includes(field)).length])) };
  });
}
