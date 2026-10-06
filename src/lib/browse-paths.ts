import type { Locale } from "@/lib/i18n/messages";
import type { CollectionSlug } from "@/lib/race-collections";

/**
 * Public addresses of the browse section, in each page's own language.
 *
 * The routes live under `c/` and `collections/`; the proxy rewrites these
 * addresses onto them and sends the old ones here permanently. Everything that
 * links into the section builds its href from this file, never from the route.
 */
export const BROWSE_ROOT: Record<Locale, string> = {
  cs: "zavody",
  en: "races",
  sk: "preteky",
  pl: "wyscigi",
  de: "rennen",
};

export const COLLECTION_URL_SLUGS: Record<Locale, Record<CollectionSlug, string>> = {
  cs: { weekend: "tento-vikend", "kids-weekend": "deti-tento-vikend", kids: "deti", youth: "mladez", amateur: "amateri" },
  en: { weekend: "this-weekend", "kids-weekend": "kids-this-weekend", kids: "kids", youth: "youth", amateur: "amateur" },
  sk: { weekend: "tento-vikend", "kids-weekend": "deti-tento-vikend", kids: "deti", youth: "mladez", amateur: "amateri" },
  pl: { weekend: "ten-weekend", "kids-weekend": "dzieci-ten-weekend", kids: "dzieci", youth: "mlodziez", amateur: "amatorzy" },
  de: { weekend: "dieses-wochenende", "kids-weekend": "kinder-dieses-wochenende", kids: "kinder", youth: "jugend", amateur: "amateure" },
};

/** `zavody`, `zavody/cz`, `zavody/cz/mtb` — without the locale prefix. */
export function hubPath(locale: Locale, countryCode?: string | null, discipline?: string | null): string {
  return [BROWSE_ROOT[locale], countryCode?.toLowerCase(), countryCode ? discipline : null].filter(Boolean).join("/");
}

/** `zavody/deti`, `zavody/deti/cz` — without the locale prefix. */
export function collectionPath(locale: Locale, slug: CollectionSlug, countryCode?: string | null): string {
  return [BROWSE_ROOT[locale], COLLECTION_URL_SLUGS[locale][slug], countryCode?.toLowerCase()].filter(Boolean).join("/");
}

function collectionFromUrlSlug(locale: Locale, urlSlug: string): CollectionSlug | null {
  const hit = Object.entries(COLLECTION_URL_SLUGS[locale]).find(([, s]) => s === urlSlug);
  return hit ? (hit[0] as CollectionSlug) : null;
}

/** The route behind a public address: segments after the browse root → `c/…` or `collections/…`. */
export function internalBrowsePath(locale: Locale, rest: string[]): string {
  const slug = rest[0] ? collectionFromUrlSlug(locale, rest[0]) : null;
  return slug ? ["collections", slug, ...rest.slice(1)].join("/") : ["c", ...rest].join("/");
}

/** The public address of an old route (`c/…`, `collections/…`), or null when it has none. */
export function publicBrowsePath(locale: Locale, segments: string[]): string | null {
  const [head, ...rest] = segments;
  if (head === "c") return [BROWSE_ROOT[locale], ...rest].join("/");
  if (head === "collections" && rest[0]) {
    const urlSlug = COLLECTION_URL_SLUGS[locale][rest[0] as CollectionSlug];
    return urlSlug ? [BROWSE_ROOT[locale], urlSlug, ...rest.slice(1)].join("/") : null;
  }
  return null;
}
