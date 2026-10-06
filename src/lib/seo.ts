import type { Metadata } from "next";
import { defaultLocale, locales, messages, type Locale } from "@/lib/i18n/messages";

export const OG_IMAGE_SIZE = { width: 1600, height: 840 } as const;
export const DEFAULT_OG_ALT = `${messages.en.introTitle} · Let's Race`;
export const DEFAULT_OG_IMAGE_PATH = "/opengraph-image?v=2";

/** Locale home pages use `generateImageMetadata` with id `default`. */
export function localeOgImagePath(locale: string): string {
  return `/${locale}/opengraph-image/default?v=2`;
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
  de: {
    title: messages.de.introTitle,
    description:
      "Straße, Gravel, MTB, Cyclocross und Kinderrennen in ganz Mitteleuropa. Plane die Saison für dich, deine Familie oder dein Team.",
    ogLocale: "de_DE",
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
  de: {
    notFound: "Rennen nicht gefunden",
    fallbackRace: "Radrennen",
    findOnSite: `Finde dieses Rennen auf ${SITE_NAME}.`,
  },
};

/**
 * Landing-page copy per locale.
 *
 * `{in}` is the country with its preposition, in the case the language wants:
 * "v Česku", "na Slovensku", "in der Schweiz". The Czech hubs used to say
 * "Cyklistické závody — Česko" and "v zemi Česko", which nobody types and
 * nobody says. `{name}`, `{rounds}` and `{season}` are filled by the caller.
 */
export const hubCopy: Record<
  Locale,
  { country: string; countryTitle: string; series: string; seriesTitle: string }
> = {
  en: {
    countryTitle: "Cycling races {in}",
    country:
      "Every upcoming cycling race {in} on one map: road, gravel, MTB, cyclocross and kids' races, with dates, venues, categories and entry links.",
    seriesTitle: "{name} – race calendar",
    series:
      "{name}: {rounds} in {season}. Dates, venues, categories and entry links for every round, on the map.",
  },
  cs: {
    countryTitle: "Cyklistické závody {in}",
    country:
      "Všechny nadcházející cyklistické závody {in} na jedné mapě: silnice, gravel, MTB, cyklokros i dětské závody. Termíny, místa, kategorie a přihlášky.",
    seriesTitle: "{name} – kalendář závodů",
    series:
      "{name}: {rounds} v sezóně {season}. Termíny, místa, kategorie a přihlášky ke každému kolu, na mapě.",
  },
  sk: {
    countryTitle: "Cyklistické preteky {in}",
    country:
      "Všetky nadchádzajúce cyklistické preteky {in} na jednej mape: cesta, gravel, MTB, cyklokros aj detské preteky. Termíny, miesta, kategórie a prihlášky.",
    seriesTitle: "{name} – kalendár pretekov",
    series:
      "{name}: {rounds} v sezóne {season}. Termíny, miesta, kategórie a prihlášky ku každému kolu, na mape.",
  },
  pl: {
    countryTitle: "Wyścigi kolarskie {in}",
    country:
      "Wszystkie nadchodzące wyścigi kolarskie {in} na jednej mapie: szosa, gravel, MTB, przełaje i wyścigi dla dzieci. Terminy, miejsca, kategorie i zapisy.",
    seriesTitle: "{name} – kalendarz wyścigów",
    series:
      "{name}: {rounds} w sezonie {season}. Terminy, miejsca, kategorie i zapisy na każdą rundę, na mapie.",
  },
  de: {
    countryTitle: "Radrennen {in}",
    country:
      "Alle kommenden Radrennen {in} auf einer Karte: Straße, Gravel, MTB, Cyclocross und Kinderrennen. Termine, Orte, Klassen und Anmeldelinks.",
    seriesTitle: "{name} – Termine",
    series:
      "{name}: {rounds} in der Saison {season}. Termine, Orte, Klassen und Anmeldung für jeden Lauf, auf der Karte.",
  },
};

/** The countries we publish, with the preposition and case each language uses. */
const IN_COUNTRY: Record<Locale, Record<string, string>> = {
  en: { CZ: "in Czechia", SK: "in Slovakia", PL: "in Poland", DE: "in Germany", AT: "in Austria", CH: "in Switzerland", IT: "in Italy" },
  cs: { CZ: "v Česku", SK: "na Slovensku", PL: "v Polsku", DE: "v Německu", AT: "v Rakousku", CH: "ve Švýcarsku", IT: "v Itálii" },
  sk: { CZ: "v Česku", SK: "na Slovensku", PL: "v Poľsku", DE: "v Nemecku", AT: "v Rakúsku", CH: "vo Švajčiarsku", IT: "v Taliansku" },
  pl: { CZ: "w Czechach", SK: "na Słowacji", PL: "w Polsce", DE: "w Niemczech", AT: "w Austrii", CH: "w Szwajcarii", IT: "we Włoszech" },
  de: { CZ: "in Tschechien", SK: "in der Slowakei", PL: "in Polen", DE: "in Deutschland", AT: "in Österreich", CH: "in der Schweiz", IT: "in Italien" },
};

/** "v Česku", "in der Schweiz" — or, for a country not in the table, the plain form. */
export function inCountry(code: string, name: string, locale: Locale): string {
  const known = IN_COUNTRY[locale][code.toUpperCase()];
  if (known) return known;
  return { en: `in ${name}`, cs: `v zemi ${name}`, sk: `v krajine ${name}`, pl: `w kraju ${name}`, de: `in ${name}` }[locale];
}

/** Nouns that follow a number, in each language's plural forms. */
const COUNTED: Record<"race" | "round", Record<Locale, Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }>> = {
  race: {
    en: { one: "race", other: "races" },
    cs: { one: "závod", few: "závody", other: "závodů" },
    sk: { one: "pretek", few: "preteky", other: "pretekov" },
    pl: { one: "wyścig", few: "wyścigi", other: "wyścigów" },
    de: { one: "Rennen", other: "Rennen" },
  },
  round: {
    en: { one: "round", other: "rounds" },
    cs: { one: "kolo", few: "kola", other: "kol" },
    sk: { one: "kolo", few: "kolá", other: "kôl" },
    pl: { one: "runda", few: "rundy", other: "rund" },
    de: { one: "Lauf", other: "Läufe" },
  },
};

/** "1 závod", "3 závody", "12 závodů" — the old copy said "Všech 2 kol". */
export function counted(n: number, noun: "race" | "round", locale: Locale): string {
  const forms = COUNTED[noun][locale];
  const rule = new Intl.PluralRules(locale).select(n);
  return `${n} ${forms[rule] ?? forms.other}`;
}

/** Fill `{name}`, `{in}`, `{count}`… in a hub template. */
export function fillCopy(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

/** What the root layout's title template adds to every page. */
export const TITLE_SUFFIX = ` · ${SITE_NAME}`;

/**
 * The brand goes after a title that has room for it. A long one is shown
 * without it rather than with the race's own name cut off by the results page.
 */
export function brandedTitle(title: string): Metadata["title"] {
  return title.length + TITLE_SUFFIX.length <= 65 ? title : { absolute: title };
}

/**
 * One entry per locale plus `x-default`, which names the page a visitor with no
 * matching language should get. Without it Google has to guess which of the
 * four is the fallback for the bare domain — and it guessed the redirecting
 * root over `/en`.
 */
/** A page's path in each language — pass a function where the address is translated. */
export function localeAlternates(path: string | ((locale: Locale) => string) = ""): Record<string, string> {
  const base = getSiteUrl();
  const at = (l: Locale) => {
    const p = typeof path === "function" ? path(l) : path;
    return `${base}/${l}${p.startsWith("/") ? p : p ? `/${p}` : ""}`;
  };
  const entries = locales.map((l) => [l, at(l)] as const);
  return Object.fromEntries([...entries, ["x-default", at(defaultLocale)]]);
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
  imageSize?: { width: number; height: number };
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
  imageSize = OG_IMAGE_SIZE,
}: SocialCardParams): Pick<Metadata, "openGraph" | "twitter"> {
  const imageUrl = absoluteUrl(imagePath);
  const images = [
    {
      url: imageUrl,
      width: imageSize.width,
      height: imageSize.height,
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
