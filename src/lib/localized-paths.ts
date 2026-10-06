import type { Locale } from "@/lib/i18n/messages";
import type { CollectionSlug } from "@/lib/race-collections";

/**
 * Public addresses in each page's own language.
 *
 * The routes keep their internal names (`e/`, `series/`, `c/`, `account/`…);
 * code builds internal paths and passes them through `localePath`. The proxy
 * rewrites a public address onto its route and redirects the internal one —
 * or another language's — to the public address, so every page has one URL.
 */

const LOCALES: Locale[] = ["en", "cs", "pl", "sk", "de"];

type Section = "e" | "series" | "list" | "schedule" | "account" | "c";

export const SECTION_SLUGS: Record<Locale, Record<Section, string>> = {
  cs: { e: "zavod", series: "serie", list: "seznam", schedule: "kalendar", account: "muj-plan", c: "zavody" },
  en: { e: "race", series: "series", list: "list", schedule: "calendar", account: "my-plan", c: "races" },
  sk: { e: "pretek", series: "seria", list: "zoznam", schedule: "kalendar", account: "moj-plan", c: "preteky" },
  pl: { e: "wyscig", series: "seria", list: "lista", schedule: "kalendarz", account: "moj-plan", c: "wyscigi" },
  de: { e: "rennen", series: "serie", list: "liste", schedule: "kalender", account: "mein-plan", c: "radrennen" },
};

type AccountPage = "alerts" | "recommendations" | "riders" | "settings";

const ACCOUNT_SLUGS: Record<Locale, Record<AccountPage, string>> = {
  cs: { alerts: "upozorneni", recommendations: "doporuceni", riders: "jezdci", settings: "nastaveni" },
  en: { alerts: "alerts", recommendations: "recommendations", riders: "riders", settings: "settings" },
  sk: { alerts: "upozornenia", recommendations: "odporucania", riders: "jazdci", settings: "nastavenia" },
  pl: { alerts: "powiadomienia", recommendations: "rekomendacje", riders: "zawodnicy", settings: "ustawienia" },
  de: { alerts: "benachrichtigungen", recommendations: "empfehlungen", riders: "fahrer", settings: "einstellungen" },
};

export const COLLECTION_URL_SLUGS: Record<Locale, Record<CollectionSlug, string>> = {
  cs: { weekend: "tento-vikend", "kids-weekend": "deti-tento-vikend", kids: "deti", youth: "mladez", amateur: "amateri" },
  en: { weekend: "this-weekend", "kids-weekend": "kids-this-weekend", kids: "kids", youth: "youth", amateur: "amateur" },
  sk: { weekend: "tento-vikend", "kids-weekend": "deti-tento-vikend", kids: "deti", youth: "mladez", amateur: "amateri" },
  pl: { weekend: "ten-weekend", "kids-weekend": "dzieci-ten-weekend", kids: "dzieci", youth: "mlodziez", amateur: "amatorzy" },
  de: { weekend: "dieses-wochenende", "kids-weekend": "kinder-dieses-wochenende", kids: "kinder", youth: "jugend", amateur: "amateure" },
};

const keyOf = <K extends string>(map: Record<K, string>, value: string | undefined): K | null =>
  value == null ? null : ((Object.keys(map) as K[]).find((k) => map[k] === value) ?? null);

/** Internal segments → the public ones in `locale`. Unknown paths pass through. */
export function toPublicSegments(locale: Locale, segments: string[]): string[] {
  const [head, ...rest] = segments;
  const s = SECTION_SLUGS[locale];
  if (head === "collections" && rest[0]) {
    const slug = COLLECTION_URL_SLUGS[locale][rest[0] as CollectionSlug];
    if (slug) return [s.c, slug, ...rest.slice(1)];
  }
  if (head === "account" && rest[0] && rest[0] in ACCOUNT_SLUGS[locale]) {
    return [s.account, ACCOUNT_SLUGS[locale][rest[0] as AccountPage], ...rest.slice(1)];
  }
  if (head && head in s) return [s[head as Section], ...rest];
  return segments;
}

/** Public segments in `locale` → internal ones, or null when they are not a public address. */
export function toInternalSegments(locale: Locale, segments: string[]): string[] | null {
  const [head, ...rest] = segments;
  const section = keyOf(SECTION_SLUGS[locale], head);
  if (!section) return null;
  if (section === "c") {
    const collection = keyOf(COLLECTION_URL_SLUGS[locale], rest[0]);
    return collection ? ["collections", collection, ...rest.slice(1)] : ["c", ...rest];
  }
  if (section === "account") {
    const page = keyOf(ACCOUNT_SLUGS[locale], rest[0]);
    if (page) return ["account", page, ...rest.slice(1)];
  }
  return [section, ...rest];
}

const INTERNAL_HEADS = new Set(["c", "collections", "e", "series", "list", "schedule", "account"]);

/**
 * Where the proxy sends a path: `rewrite` onto the route behind a public
 * address, `redirect` from a route's own address or another language's.
 */
export function routePath(pathname: string): { rewrite: string } | { redirect: string } | null {
  const [, locale, ...rawSegments] = pathname.split("/");
  if (!locale || !LOCALES.includes(locale as Locale)) return null;
  const l = locale as Locale;
  const segments = rawSegments.filter(Boolean);
  if (!segments.length) return null;

  const internal = toInternalSegments(l, segments);
  if (internal) {
    const target = `/${l}/${internal.join("/")}`;
    return target === `/${l}/${segments.join("/")}` ? null : { rewrite: target };
  }

  // A route's own address, or a public address from another language.
  let source: string[] | null = INTERNAL_HEADS.has(segments[0]!) ? segments : null;
  for (const other of LOCALES) source ??= toInternalSegments(other, segments);
  if (!source) return null;
  const target = toPublicSegments(l, source).join("/");
  return target === segments.join("/") ? null : { redirect: `/${l}/${target}` };
}

/**
 * The public address of an internal path in `locale`: `localePath("cs",
 * "e/zh-cross-2026")` → `/cs/zavod/zh-cross-2026`. Query and hash are kept.
 */
export function localePath(locale: string, internal = ""): string {
  const l = (LOCALES.includes(locale as Locale) ? locale : "en") as Locale;
  const cut = internal.search(/[?#]/);
  const path = cut === -1 ? internal : internal.slice(0, cut);
  const suffix = cut === -1 ? "" : internal.slice(cut);
  const segments = path.split("/").filter(Boolean);
  const pub = toPublicSegments(l, segments).join("/");
  return `/${l}${pub ? `/${pub}` : ""}${suffix}`;
}

/** The same page in another language, from its current public path (with locale). */
export function translatePathname(pathname: string, to: Locale): string {
  const [, locale, ...rest] = pathname.split("/");
  const from = LOCALES.includes(locale as Locale) ? (locale as Locale) : null;
  const segments = (from ? rest : [locale, ...rest]).filter(Boolean) as string[];
  const internal = (from && toInternalSegments(from, segments)) ?? segments;
  return localePath(to, internal.join("/"));
}

/** `zavody`, `zavody/cz`, `zavody/cz/mtb` — without the locale prefix. */
export function hubPath(locale: Locale, countryCode?: string | null, discipline?: string | null): string {
  return localePath(locale, ["c", countryCode?.toLowerCase(), countryCode ? discipline : null].filter(Boolean).join("/")).slice(locale.length + 2);
}

/** `zavody/deti`, `zavody/deti/cz` — without the locale prefix. */
export function collectionPath(locale: Locale, slug: CollectionSlug, countryCode?: string | null): string {
  return localePath(locale, ["collections", slug, countryCode?.toLowerCase()].filter(Boolean).join("/")).slice(locale.length + 2);
}
