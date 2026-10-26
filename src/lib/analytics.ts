import { toInternalSegments } from "@/lib/localized-paths";
import type { Locale } from "@/lib/i18n/messages";

/** Public analytics only. Never pass search text, user IDs, forms, or full URLs. */
export type AnalyticsProps = Record<string, string | number | boolean | null>;
type Payload = Record<string, unknown>;

const safeValue = /^[a-zA-Z0-9_.-]{1,80}$/;
const propertyKeys = new Set(["slug", "kind", "location", "source", "discipline", "filter_type", "count", "method"]);
const eventNames = new Set(["cta_click", "race_view", "race_registration_start", "filter_apply", "search_submit", "outbound_click", "share_native", "share_link"]);
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
  const url = sanitizeAnalyticsUrl(String(payload.url || ""), origin);
  if (!url || !url.startsWith("/")) return false;
  return {
    website: payload.website, hostname: payload.hostname, screen: payload.screen,
    language: payload.language, url,
    referrer: payload.referrer ? sanitizeAnalyticsUrl(String(payload.referrer), origin, false) || "" : "",
    ...(payload.name ? { name: payload.name, data: sanitizeAnalyticsProps(payload.data) } : {}),
  };
}

declare global {
  interface Window {
    umami?: { track: (name: string, data?: AnalyticsProps) => Promise<unknown> | void };
    letsraceAnalyticsBeforeSend?: (type: string, payload: Payload) => Payload | false;
  }
}

export function track(name: string, data?: AnalyticsProps) {
  if (typeof window === "undefined" || !eventNames.has(name)) return;
  // Tracking must never affect the action, even if blocked or offline.
  try { void Promise.resolve(window.umami?.track(name, sanitizeAnalyticsProps(data))).catch(() => {}); } catch { /* Analytics must never block navigation. */ }
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
