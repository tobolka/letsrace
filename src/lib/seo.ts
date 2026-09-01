import type { Metadata } from "next";
import { locales, messages, type Locale } from "@/lib/i18n/messages";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const DEFAULT_OG_ALT = `${messages.en.introTitle} · Let's Race`;
export const DEFAULT_OG_IMAGE_PATH = "/opengraph-image";

/** Locale home pages use `generateImageMetadata` with id `default`. */
export function localeOgImagePath(locale: string): string {
  return `/${locale}/opengraph-image/default`;
}

/** Production URL used for canonicals, sitemap, and Open Graph. */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;
  return "https://letsrace.cz";
}

export const SITE_NAME = "Let's Race";

export const SITE_AUTHOR = {
  name: "Radek Tobolka",
  url: "https://radektobolka.com",
  email: "tobolka@gmail.com",
} as const;

/**
 * One message, everywhere.
 *
 * The site said three different things in three places: a search result
 * promised a "map-first calendar", the share card promised "every cycling race
 * on one map", and the card that greets a first visit promised a season planned
 * for a family or a team. These are the words from that last one, because it is
 * the one that says what the site is actually for — the map is how you find a
 * race, the plan is why you would stay.
 *
 * The shape is the same in every language: what kind of racing, where, and what
 * you can do with it. Titles stay under sixty characters so search shows them
 * whole, descriptions under about a hundred and sixty for the same reason.
 */
export const seoCopy: Record<
  Locale,
  { title: string; description: string; ogLocale: string }
> = {
  en: {
    /**
     * The title is the intro card's headline, not a copy of it — read from the
     * same place so the two cannot drift apart again. The brand is added by the
     * template in the root layout rather than written in here, which is why
     * this used to read "Let's Race — ... · Let's Race" in a browser tab.
     */
    title: messages.en.introTitle,
    description:
      "Road, gravel, MTB, cyclocross and kids' races across Central Europe. Plan the season for yourself, your family or your team.",
    ogLocale: "en_GB",
  },
  cs: {
    title: messages.cs.introTitle,
    description:
      "Silnice, gravel, MTB, cyklokros i dětské závody napříč střední Evropou. Naplánuj sezónu sobě, rodině nebo týmu.",
    ogLocale: "cs_CZ",
  },
  pl: {
    title: messages.pl.introTitle,
    description:
      "Szosa, gravel, MTB, przełaje i wyścigi dla dzieci w Europie Środkowej. Zaplanuj sezon dla siebie, rodziny lub drużyny.",
    ogLocale: "pl_PL",
  },
  sk: {
    title: messages.sk.introTitle,
    description:
      "Cesta, gravel, MTB, cyklokros aj detské preteky naprieč strednou Európou. Naplánuj sezónu sebe, rodine alebo tímu.",
    ogLocale: "sk_SK",
  },
};

/** Event detail pages and their share cards. */
export const eventSeoCopy: Record<
  Locale,
  { notFound: string; fallbackRace: string; findOnSite: string }
> = {
  en: {
    notFound: "Race not found",
    fallbackRace: "Cycling race",
    findOnSite: `Find this race on ${SITE_NAME}.`,
  },
  cs: {
    notFound: "Závod nenalezen",
    fallbackRace: "Cyklistický závod",
    findOnSite: `Najdi tento závod na ${SITE_NAME}.`,
  },
  pl: {
    notFound: "Nie znaleziono wyścigu",
    fallbackRace: "Wyścig kolarski",
    findOnSite: `Znajdź ten wyścig na ${SITE_NAME}.`,
  },
  sk: {
    notFound: "Pretek nenájdený",
    fallbackRace: "Cyklistický pretek",
    findOnSite: `Nájdi tento pretek na ${SITE_NAME}.`,
  },
};

/**
 * Landing-page copy per locale.
 *
 * The country and series hubs described themselves in English on every locale —
 * a Czech page titled "Cycling races in Czechia" competes for nothing a Czech
 * rider types. `{name}` and `{count}` are filled by the caller.
 */
export const hubCopy: Record<
  Locale,
  { country: string; countryTitle: string; series: string; seriesTitle: string }
> = {
  en: {
    countryTitle: "Cycling races in {name}",
    country:
      "Every cycling race in {name} on one map — road, gravel, MTB, cyclocross and kids' races, with dates, start towns and entry links.",
    seriesTitle: "{name} — calendar and results",
    series:
      "All {count} rounds of {name}: dates, venues and entry links, on the map.",
  },
  cs: {
    countryTitle: "Cyklistické závody — {name}",
    country:
      "Všechny cyklistické závody v zemi {name} na jedné mapě — silnice, gravel, MTB, cyklokros i dětské závody, s termíny, místem startu a odkazy na přihlášky.",
    seriesTitle: "{name} — kalendář a termíny",
    series:
      "Všech {count} kol seriálu {name}: termíny, místa a odkazy na přihlášky, na mapě.",
  },
  sk: {
    countryTitle: "Cyklistické preteky — {name}",
    country:
      "Všetky cyklistické preteky v krajine {name} na jednej mape — cesta, gravel, MTB, cyklokros aj detské preteky, s termínmi, miestom štartu a odkazmi na prihlášky.",
    seriesTitle: "{name} — kalendár a termíny",
    series:
      "Všetkých {count} kôl seriálu {name}: termíny, miesta a odkazy na prihlášky, na mape.",
  },
  pl: {
    countryTitle: "Wyścigi kolarskie — {name}",
    country:
      "Wszystkie wyścigi kolarskie w kraju {name} na jednej mapie — szosa, gravel, MTB, przełaje i wyścigi dla dzieci, z terminami, miejscem startu i zapisami.",
    seriesTitle: "{name} — kalendarz i terminy",
    series:
      "Wszystkie {count} rundy cyklu {name}: terminy, miejsca i zapisy, na mapie.",
  },
};

/** Fill `{name}` / `{count}` in a hub template. */
export function fillCopy(
  template: string,
  vars: { name?: string; count?: number | string },
): string {
  return template
    .replace(/\{name\}/g, String(vars.name ?? ""))
    .replace(/\{count\}/g, String(vars.count ?? ""));
}

export function localeAlternates(path = ""): Record<string, string> {
  const base = getSiteUrl();
  const suffix = path.startsWith("/") ? path : path ? `/${path}` : "";
  return Object.fromEntries(locales.map((l) => [l, `${base}/${l}${suffix}`]));
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

type SocialCardParams = {
  title: string;
  description: string;
  url: string;
  /** BCP 47 Open Graph locale, e.g. `cs_CZ`. */
  locale?: string;
  /** When set, fills `locale` and `alternateLocale` from `seoCopy`. */
  localeKey?: Locale;
  /** Defaults to `title`. Hub pages pass a title with the site suffix. */
  ogTitle?: string;
  imagePath?: string;
  imageAlt?: string;
};

/**
 * Open Graph and Twitter card metadata. Child `generateMetadata` replaces the
 * whole `openGraph` object, so file-based `opengraph-image.tsx` alone is not
 * enough — every segment that sets `openGraph` must include `images` too.
 */
export function socialCard({
  title,
  description,
  url,
  locale,
  localeKey,
  ogTitle,
  imagePath = DEFAULT_OG_IMAGE_PATH,
  imageAlt = DEFAULT_OG_ALT,
}: SocialCardParams): Pick<Metadata, "openGraph" | "twitter"> {
  const imageUrl = absoluteUrl(imagePath);
  const images = [
    {
      url: imageUrl,
      width: OG_IMAGE_SIZE.width,
      height: OG_IMAGE_SIZE.height,
      alt: imageAlt,
    },
  ];
  const resolvedOgTitle = ogTitle ?? title;
  const ogLocale = localeKey ? seoCopy[localeKey].ogLocale : locale;
  const alternateLocale = localeKey
    ? locales.filter((l) => l !== localeKey).map((l) => seoCopy[l].ogLocale)
    : undefined;

  return {
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: resolvedOgTitle,
      description,
      url,
      ...(ogLocale ? { locale: ogLocale } : {}),
      ...(alternateLocale?.length ? { alternateLocale } : {}),
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}
