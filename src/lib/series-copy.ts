import { asLocale } from "@/lib/i18n/messages";

/**
 * What kind of series it is and who runs it, in the reader's language. The
 * catch-all "other" has no name: a badge that says "Other" tells nobody
 * anything, so the series page leaves it out.
 */
const SERIES_TYPES = {
  cs: { cup: "Pohár", league: "Liga", marathon_series: "Maratonská série", kids_series: "Dětská série", junior_series: "Juniorská série", tour: "Tour", enduro_series: "Enduro série", gran_fondo_series: "Gran fondo série", championship: "Mistrovství" },
  sk: { cup: "Pohár", league: "Liga", marathon_series: "Maratónska séria", kids_series: "Detská séria", junior_series: "Juniorská séria", tour: "Tour", enduro_series: "Enduro séria", gran_fondo_series: "Gran fondo séria", championship: "Majstrovstvá" },
  pl: { cup: "Puchar", league: "Liga", marathon_series: "Cykl maratonów", kids_series: "Cykl dla dzieci", junior_series: "Cykl juniorski", tour: "Tour", enduro_series: "Cykl enduro", gran_fondo_series: "Cykl gran fondo", championship: "Mistrzostwa" },
  de: { cup: "Cup", league: "Liga", marathon_series: "Marathonserie", kids_series: "Kinderserie", junior_series: "Nachwuchsserie", tour: "Tour", enduro_series: "Enduroserie", gran_fondo_series: "Gran-Fondo-Serie", championship: "Meisterschaft" },
  en: { cup: "Cup", league: "League", marathon_series: "Marathon series", kids_series: "Kids' series", junior_series: "Youth series", tour: "Tour", enduro_series: "Enduro series", gran_fondo_series: "Gran fondo series", championship: "Championship" },
} as const;

const COMPETITION_TYPES = {
  cs: { uci: "UCI", national_federation: "Svazová", regional: "Krajská", community: "Komunitní", amateur: "Amatérská", commercial: "Komerční" },
  sk: { uci: "UCI", national_federation: "Zväzová", regional: "Krajská", community: "Komunitná", amateur: "Amatérska", commercial: "Komerčná" },
  pl: { uci: "UCI", national_federation: "Związkowa", regional: "Regionalna", community: "Społecznościowa", amateur: "Amatorska", commercial: "Komercyjna" },
  de: { uci: "UCI", national_federation: "Verband", regional: "Regional", community: "Vereinsserie", amateur: "Amateur", commercial: "Kommerziell" },
  en: { uci: "UCI", national_federation: "Federation", regional: "Regional", community: "Community", amateur: "Amateur", commercial: "Commercial" },
} as const;

const SOURCE_KINDS = {
  cs: { official: "web pořadatele", national_federation: "svaz", federation: "svaz", uci: "UCI", aggregator: "kalendář", other: "jiný zdroj", scraped: "jiný zdroj" },
  sk: { official: "web organizátora", national_federation: "zväz", federation: "zväz", uci: "UCI", aggregator: "kalendár", other: "iný zdroj", scraped: "iný zdroj" },
  pl: { official: "strona organizatora", national_federation: "związek", federation: "związek", uci: "UCI", aggregator: "kalendarz", other: "inne źródło", scraped: "inne źródło" },
  de: { official: "Website des Veranstalters", national_federation: "Verband", federation: "Verband", uci: "UCI", aggregator: "Kalender", other: "andere Quelle", scraped: "andere Quelle" },
  en: { official: "organiser's website", national_federation: "federation", federation: "federation", uci: "UCI", aggregator: "calendar", other: "another source", scraped: "another source" },
} as const;

const LABELS = {
  cs: { kind: "Typ seriálu", source: "Zdroj", season: "sezóna {season}" },
  sk: { kind: "Typ série", source: "Zdroj", season: "sezóna {season}" },
  pl: { kind: "Rodzaj cyklu", source: "Źródło", season: "sezon {season}" },
  de: { kind: "Art der Serie", source: "Quelle", season: "Saison {season}" },
  en: { kind: "Kind of series", source: "Source", season: "{season} season" },
} as const;

function pick(table: Record<string, Record<string, string>>, locale: string, key: string | null | undefined): string | null {
  if (!key) return null;
  return table[asLocale(locale)]?.[key] ?? null;
}

export const seriesTypeLabel = (type: string | null | undefined, locale: string) => pick(SERIES_TYPES, locale, type);
export const competitionTypeLabel = (type: string | null | undefined, locale: string) => pick(COMPETITION_TYPES, locale, type);
export const seriesSourceKindLabel = (kind: string | null | undefined, locale: string) => pick(SOURCE_KINDS, locale, kind);
export const seriesLabels = (locale: string) => LABELS[asLocale(locale)];
