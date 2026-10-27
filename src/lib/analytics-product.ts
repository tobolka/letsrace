import { toInternalSegments } from "@/lib/localized-paths";
import type { Locale } from "@/lib/i18n/messages";
import type { AnalyticsProps } from "@/lib/analytics";
import { DISCIPLINES, AGE_CATEGORIES, RACE_LEVELS } from "@/lib/taxonomy";
import { thisWeekendRange } from "@/lib/date-presets";
import type { EventsQuery } from "@/lib/events-query";

export function analyticsSection(path: string): { section: string; section_group: string; locale: string } | null {
  const [locale, ...parts] = path.split("/").filter(Boolean);
  if (!["cs", "en", "pl", "sk", "de"].includes(locale)) return null;
  const [head, ...rest] = toInternalSegments(locale as Locale, parts) ?? parts;
  let section: string | undefined;
  let group = "discover";
  if (!head) section = "map";
  else if (head === "list" || head === "schedule") section = head;
  else if (head === "c") { section = rest.length > 1 ? "browse_discipline" : rest.length ? "browse_country" : "browse_countries"; group = "browse"; }
  else if (head === "series" || head === "collections") { section = head === "collections" ? "collection" : head; group = "browse"; }
  else if (head === "e" && rest.length === 1) { section = "race_page"; group = "race"; }
  else if (head === "account" && rest.length <= 1) { section = ({ recommendations: "recommendations", alerts: "alert_areas", riders: "riders", settings: "settings" } as Record<string, string>)[rest[0]] ?? (rest.length ? undefined : "plan"); group = "personal"; }
  else if ((head === "about" || head === "privacy") && !rest.length) { section = head; group = "info"; }
  return section ? { section, section_group: group, locale } : null;
}

const list = (v: string[] = [], allowed?: readonly string[]) => [...new Set(v.filter(value => allowed ? allowed.includes(value) : /^[A-Z]{2}$/.test(value)))].sort().join(".") || "all";
/** Only catalogue dimensions. No query text, coordinates or user profile data. */
export function filterSnapshot(query: Partial<EventsQuery>, radius?: number | null): AnalyticsProps {
  const from = query.dateFrom || "", to = query.dateTo || "";
  const weekend = thisWeekendRange();
  const days = from && to ? Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1 : 0;
  return {
    country_set: list(query.country), discipline_set: list(query.disciplines, DISCIPLINES),
    category_set: list(query.categories, AGE_CATEGORIES), level_set: list(query.levels, RACE_LEVELS),
    has_series: Boolean(query.series), has_query: Boolean(query.q?.trim()),
    date_mode: !from && !to ? "any" : !to ? "upcoming" : from === weekend.from && to === weekend.to ? "this_weekend" : "range",
    date_span: !days ? "open" : days <= 7 ? "1_7" : days <= 31 ? "8_31" : days <= 90 ? "32_90" : "91_plus",
    ...(radius ? { radius_km: radius } : {}),
  };
}
export const resultBucket = (count: number) => count === 0 ? "0" : count <= 5 ? "1_5" : count <= 20 ? "6_20" : "21_plus";
export const queryLengthBucket = (q: string) => q.trim().length < 3 ? "1_2" : q.trim().length <= 5 ? "3_5" : q.trim().length <= 10 ? "6_10" : "11_plus";
