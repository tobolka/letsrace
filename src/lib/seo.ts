import { locales, type Locale } from "@/lib/i18n/messages";

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

export const seoCopy: Record<
  Locale,
  { title: string; description: string; ogLocale: string }
> = {
  en: {
    title: "Let's Race — cycling races on the map",
    description:
      "Map-first calendar of cycling races across Central Europe — road, gravel, MTB, CX, and kids races.",
    ogLocale: "en_GB",
  },
  cs: {
    title: "Let's Race — cyklistické závody na mapě",
    description:
      "Mapový kalendář cyklistických závodů ve střední Evropě — silnice, gravel, MTB, CX i dětské závody.",
    ogLocale: "cs_CZ",
  },
  pl: {
    title: "Let's Race — wyścigi rowerowe na mapie",
    description:
      "Kalendarz wyścigów rowerowych na mapie Europy Środkowej — szosa, gravel, MTB, CX i wyścigi dla dzieci.",
    ogLocale: "pl_PL",
  },
  sk: {
    title: "Let's Race — cyklistické preteky na mape",
    description:
      "Mapový kalendár cyklistických pretekov v strednej Európe — cesta, gravel, MTB, CX aj detské preteky.",
    ogLocale: "sk_SK",
  },
};

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
