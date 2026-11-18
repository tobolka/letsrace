import type { Locale } from "@/lib/i18n/messages";
import { SITE_AUTHOR } from "@/lib/seo";

/** Where people write about their data, the terms or anything legal. */
export const LEGAL_CONTACT = "info@letsrace.cz";

/** Who runs the site and answers for it (the data controller). */
export const OPERATOR = { name: SITE_AUTHOR.name, url: SITE_AUTHOR.url } as const;

/** The legal pages, in the order they are linked under each other. */
export const LEGAL_PAGES = ["privacy", "terms"] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];

export const LEGAL_TITLES: Record<Locale, Record<LegalPage | "about", string>> = {
  cs: { privacy: "Ochrana soukromí", terms: "Podmínky užití", about: "O projektu" },
  en: { privacy: "Privacy", terms: "Terms of use", about: "About" },
  pl: { privacy: "Prywatność", terms: "Warunki korzystania", about: "O projekcie" },
  sk: { privacy: "Ochrana súkromia", terms: "Podmienky používania", about: "O projekte" },
  de: { privacy: "Datenschutz", terms: "Nutzungsbedingungen", about: "Über das Projekt" },
};
