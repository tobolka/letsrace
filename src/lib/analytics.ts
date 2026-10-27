import { analyticsSection } from "@/lib/analytics-product";
import { toInternalSegments } from "@/lib/localized-paths";
import type { Locale } from "@/lib/i18n/messages";

/** Public analytics only. Never pass search text, user IDs, forms, or full URLs. */
export type AnalyticsProps = Record<string, string | number | boolean | null>;
type Payload = Record<string, unknown>;

const safeValue = /^[a-zA-Z0-9_.-]{1,80}$/;
const propertyKeys = new Set(["slug", "kind", "location", "source", "discipline", "filter_type", "count", "method", "section", "section_group", "locale", "surface", "race_id", "presentation", "has_registration", "has_primary_outbound", "is_past", "result_count", "result_bucket", "geo_scope", "trigger", "outcome", "mode", "query_length_bucket", "country_set", "discipline_set", "category_set", "level_set", "has_series", "has_query", "date_mode", "date_span", "radius_km", "auth_required", "action", "error_class", "schema_version"]);
const eventNames = new Set(["cta_click", "race_view", "race_registration_start", "filter_apply", "search_submit", "outbound_click", "share_native", "share_link", "section_view", "results_view", "search_completed", "plan_save_requested", "plan_save_completed", "action_failed"]);
const publicPath = /^\/(?:cs|en|pl|sk|de)(?:\/(?:e\/[a-z0-9-]+|series\/[a-z0-9-]+|collections\/[a-z0-9/-]+|c(?:\/[a-z0-9-]+){0,2}|calendar|list|schedule|about|privacy|map-entry))?\/?$/;

export function sanitizeAnalyticsUrl(raw: string, origin = "https://letsrace.cz", campaign = true): string | null {
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return /^https?:$/.test(url.protocol) ? url.origin : null;
    const [, locale, ...segments] = url.pathname.split("/");
    if (!["cs", "en", "pl", "sk", "de"].includes(locale)) return null;
    const internal = toInternalSegments(locale as Locale, segments) ?? segments;
    if (!publicPath.test(`/${locale}/${internal.join("/")}`)) return null;
    const params = new URLSearchParams();
    if (campaign) for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
      const value = url.searchParams.get(key);
      if (value && safeValue.test(value)) params.set(key, value);
    }
    return url.pathname + (params.size ? `?${params}` : "");
  } catch { return null; }
}

export function sanitizeAnalyticsProps(data: unknown): AnalyticsProps {
  if (!data || typeof data !== "object") return {};
  return Object.fromEntries(Object.entries(data).filter(([key, value]) =>
    propertyKeys.has(key) && (typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value)) ||
      (typeof value === "string" && safeValue.test(value))),
  ));
}

export function analyticsBeforeSend(type: string, payload: Payload, origin = "https://letsrace.cz"): Payload | false {
  // No identity, replay, performance, form contents, title or arbitrary metadata.
  if (type !== "event" || !payload || payload.id || payload.name && !eventNames.has(String(payload.name))) return false;
  let url = sanitizeAnalyticsUrl(String(payload.url || ""), origin);
  // Personal pages stay excluded from pageviews. Only coarse section/save signals
  // may leave them, under the locale root: no private path or profile context.
  let section: ReturnType<typeof analyticsSection> = null;
  try { const parsed = new URL(String(payload.url || "/"), origin); if (parsed.origin === origin) section = analyticsSection(parsed.pathname); } catch { return false; }
  if (!url && section?.section_group === "personal" && ["section_view", "plan_save_requested", "plan_save_completed", "action_failed"].includes(String(payload.name))) url = `/${section.locale}`;
  if (!url || !url.startsWith("/")) return false;
  return {
    website: payload.website, hostname: payload.hostname, screen: payload.screen,
    language: payload.language, url,
    referrer: payload.referrer ? sanitizeAnalyticsUrl(String(payload.referrer), origin, false) || "" : "",
    ...(payload.name ? { name: payload.name, data: sanitizeAnalyticsProps(payload.data) } : {}),
    ...(typeof payload.timestamp === "number" && Number.isFinite(payload.timestamp) ? { timestamp: payload.timestamp } : {}),
  };
}

declare global {
  interface Window {
    umami?: { track: (payload: string | ((props: Payload) => Payload), data?: AnalyticsProps) => Promise<unknown> | void };
    letsraceAnalyticsBeforeSend?: (type: string, payload: Payload) => Payload | false;
  }
}
let enabled = false;
type Queued = { name: string; data: AnalyticsProps; url: string; at: number };
let pending: Queued[] = [];
export function setAnalyticsEnabled(value: boolean) {
  enabled = value;
  if (!value) pending = [];
}
function send(event: Queued) {
  try {
    void Promise.resolve(window.umami?.track(props => ({ ...props, name: event.name, data: event.data, url: event.url, timestamp: Math.floor(event.at / 1000) }))).catch(() => {});
  } catch { /* Analytics must never block the product. */ }
}
export function flushAnalytics() {
  if (!enabled || !window.umami) return;
  const queued = pending;
  pending = [];
  for (const event of queued) if (Date.now() - event.at < 10000) send(event);
}
export function track(name: string, data?: AnalyticsProps) {
  if (typeof window === "undefined" || !enabled || !eventNames.has(name)) return;
  const context = analyticsSection(window.location.pathname);
  const event = { name, data: sanitizeAnalyticsProps({ ...context, schema_version: 1, ...data }), url: window.location.href, at: Date.now() };
  if (window.umami) send(event);
  else { pending = pending.filter(e => Date.now() - e.at < 10000).slice(-49); pending.push(event); }
}

/** Query-driven filters and map movements must not create duplicate pageviews. */
export function createAnalyticsBeforeSend(origin: string) {
  let lastPage: string | undefined;
  return (type: string, payload: Payload): Payload | false => {
    const clean = analyticsBeforeSend(type, payload, origin);
    if (!clean) return false;
    if (!clean.name) {
      const path = String(clean.url).split("?")[0];
      if (path === lastPage) return false;
      lastPage = String(clean.url).split("?")[0];
    }
    return clean;
  };
}
