import { isJunkListingName } from "@/lib/event-visibility";
import { countryFromLabel } from "@/lib/geo/country-label";

export function catalogueWindow(today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Prague" })) {
  if (!validDate(today)) throw new Error("Invalid catalogue day");
  return { from: today, until: `${Number(today.slice(0, 4)) + 1}-12-31` };
}

export function validDate(value: string | null | undefined): boolean {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
}

export type OverviewRace = {
  name: string; start_date: string; end_date?: string | null; status?: string | null;
  website_url: string | null; disciplines: string[] | null;
  location: { municipality?: string | null; country_code?: string | null; lat?: number | null; lng?: number | null } | null;
  sources?: { kind: string | null; source_url: string }[];
};

function usableUrl(value: string | null | undefined) {
  try { const url = new URL(value ?? ""); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}

/** A country label is useful country evidence, never a municipality. */
export function isCountryOnlyPlace(value: string | null | undefined): boolean {
  return Boolean(countryFromLabel(value)) || /^(?:unknown|tba|tbd)$/i.test((value ?? "").trim());
}

/** Listing essentials. A populated field is not a fresh correctness verification. */
export function missingOverviewFields(event: OverviewRace): string[] {
  return [
    !event.name.trim() || isJunkListingName(event.name) ? "name" : null,
    !validDate(event.start_date) ? "date" : null,
    !event.location?.municipality?.trim() || isCountryOnlyPlace(event.location.municipality) ? "place" : null,
    !event.location?.country_code ? "country" : null,
    !event.disciplines?.length ? "discipline" : null,
    !usableUrl(event.website_url) && !event.sources?.some(s => ["official", "national_federation", "series"].includes(s.kind ?? "") && usableUrl(s.source_url)) ? "source" : null,
  ].filter((s): s is string => s !== null);
}

export function overviewIssues(event: Pick<OverviewRace, "name" | "start_date" | "end_date" | "status">, today: string): string[] {
  const issues: string[] = [];
  if (!validDate(event.start_date) || event.end_date && !validDate(event.end_date)) issues.push("invalid_date");
  if (event.end_date && event.end_date < event.start_date) issues.push("end_before_start");
  if (event.status === "completed" && event.start_date > today) issues.push("completed_in_future");
  // Verified PZKol title: Fundacja 2036 names its race "2036 CUP".
  // Keep this narrow: an arbitrary year in another race title still needs review.
  const datedName = event.name.replace(/\bGRAND PRIX OF POLAND\s*[-–—]\s*2036 CUP\b/i, "GRAND PRIX OF POLAND");
  const years: string[] = datedName.match(/\b20\d{2}\b/g) ?? [];
  // Winter 2026/27 spans two calendar years; an explicit range is not an error.
  const winter = event.name.match(/\b(20\d{2})\s*[/–-]\s*(\d{2}|20\d{2})\b/);
  if (winter) years.push(winter[2].length === 2 ? `${winter[1].slice(0, 2)}${winter[2]}` : winter[2]);
  if (years.length && !years.includes(event.start_date.slice(0, 4)) && !(event.end_date && years.includes(event.end_date.slice(0, 4)))) issues.push("name_year_conflict");
  if (isJunkListingName(event.name)) issues.push("generic_name");
  return issues;
}

/** Give each country/year work, instead of letting one large calendar monopolise the cap. */
export function fairCatalogueBatch<T>(rows: T[], max: number, group: (row: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) { const key = group(row); const queue = groups.get(key) ?? []; queue.push(row); groups.set(key, queue); }
  const out: T[] = [];
  for (let index = 0; out.length < max; index++) {
    let added = false;
    for (const queue of groups.values()) if (queue[index] !== undefined && out.length < max) { out.push(queue[index]); added = true; }
    if (!added) break;
  }
  return out;
}
