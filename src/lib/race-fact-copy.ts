/**
 * The names of a race's practical facts and documents, shared by the map's
 * race card and the race page so the two never call the same thing two names.
 * Kept apart from `practical-details`, whose schemas need not reach the card.
 */
export const FACT_COPY = {
  cs: { schedule: "Program a starty", fees: "Startovné", categories: "Kategorie", routes: "Tratě", venue: "Areál a adresa", organizer: "Pořadatel", parking: "Parkování", links: "Odkazy", more: "Zobrazit další ({n})", less: "Zobrazit méně" },
  sk: { schedule: "Program a štarty", fees: "Štartovné", categories: "Kategórie", routes: "Trate", venue: "Areál a adresa", organizer: "Organizátor", parking: "Parkovanie", links: "Odkazy", more: "Zobraziť ďalšie ({n})", less: "Zobraziť menej" },
  pl: { schedule: "Program i starty", fees: "Wpisowe", categories: "Kategorie", routes: "Trasy", venue: "Miejsce i adres", organizer: "Organizator", parking: "Parking", links: "Linki", more: "Pokaż więcej ({n})", less: "Pokaż mniej" },
  de: { schedule: "Programm und Starts", fees: "Startgeld", categories: "Kategorien", routes: "Strecken", venue: "Gelände und Adresse", organizer: "Veranstalter", parking: "Parken", links: "Links", more: "{n} weitere anzeigen", less: "Weniger anzeigen" },
  en: { schedule: "Schedule and starts", fees: "Entry fees", categories: "Categories", routes: "Routes", venue: "Venue and address", organizer: "Organiser", parking: "Parking", links: "Links", more: "Show {n} more", less: "Show less" },
} as const;

/** The documents a race's regulations point to, by kind. */
export const DOCUMENT_KINDS = {
  cs: { regulations: "Propozice", instructions: "Organizační pokyny", series_rules: "Pravidla série" },
  sk: { regulations: "Propozície", instructions: "Organizačné pokyny", series_rules: "Pravidlá série" },
  pl: { regulations: "Regulamin", instructions: "Komunikat organizacyjny", series_rules: "Regulamin cyklu" },
  de: { regulations: "Ausschreibung", instructions: "Organisatorische Hinweise", series_rules: "Serienreglement" },
  en: { regulations: "Regulations", instructions: "Race instructions", series_rules: "Series rules" },
} as const;
