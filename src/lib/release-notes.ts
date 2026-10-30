import type { Locale } from "@/lib/i18n/messages";

/**
 * What changed, for the people who ride — newest first, by day.
 *
 * Written for a rider or a parent, not for a developer: what you can now do,
 * what is easier or what stopped being wrong. Only changes someone would
 * notice or care about belong here; speed-ups nobody can feel, clean-ups and
 * security hardening do not. (The rule for whoever adds an entry is in
 * CLAUDE.md.) Czech and English are written by hand; the other languages show
 * the English until they are translated.
 */
export type ReleaseNote = {
  /** The day it went live, `YYYY-MM-DD`. */
  date: string;
  /** One plain sentence per change. */
  items: { en: string[]; cs: string[] };
};

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    date: "2026-10-30",
    items: {
      en: [
        "The 2026 archive includes three more cycling races from NaKole.cz, with rides and other non-racing events filtered out.",
        "You can switch races with the arrow keys on the map and in the list, move between calendar days with the keyboard, and close race details with Escape.",
        "The 2027 Mountain Bike World Cup rounds in Czechia, Austria, Italy and Switzerland are in the calendar."],
      cs: [
        "V archivu roku 2026 jsou další tři cyklistické závody z NaKole.cz, bez vyjížděk a dalších nezávodních akcí.",
        "Na mapě a v seznamu přepínáš závody šipkami, mezi dny v kalendáři se pohybuješ klávesnicí a detail závodu zavřeš klávesou Escape.",
        "V kalendáři jsou závody Světového poháru horských kol 2027 v Česku, Rakousku, Itálii a Švýcarsku."],
    },
  },
  {
    date: "2026-10-29",
    items: {
      en: [
        "Our plan looks the same in every view, and its calendar can be subscribed to from your phone.",
        "Races in your plan are tinted the same way everywhere.",
        "A race's cup has an arrow that opens the cup's page.",
        "The map, list and calendar no longer flash while they load.",
        "A friendlier sign-in window.",
      ],
      cs: [
        "Náš plán vypadá ve všech pohledech stejně a jeho kalendář si můžeš přihlásit k odběru do telefonu.",
        "Závody v plánu jsou všude podbarvené stejně.",
        "U poháru na kartě závodu je šipka, která otevře stránku poháru.",
        "Mapa, seznam a kalendář už při načítání neproblikávají.",
        "Přívětivější přihlašovací okno.",
      ],
    },
  },
  {
    date: "2026-10-23",
    items: {
      en: [
        "More races fit on a phone screen, with the filters in one row.",
        "A race listed on several websites is shown once.",
      ],
      cs: [
        "Na telefonu se vejde víc závodů a filtry jsou v jednom řádku.",
        "Závod, který je na více webech, vidíš jen jednou.",
      ],
    },
  },
  {
    date: "2026-10-21",
    items: {
      en: ["Races from Sumator are placed where the start really is."],
      cs: ["Závody ze Sumatoru jsou na mapě tam, kde je opravdu start."],
    },
  },
  {
    date: "2026-10-20",
    items: {
      en: [
        "Let's Race was announced to the public.",
        "You can pick several countries and disciplines at once.",
        "You can subscribe to the calendar, with your filters, in your own calendar app.",
      ],
      cs: [
        "Let's Race byl poprvé oznámen veřejnosti.",
        "Můžeš vybrat víc zemí a disciplín najednou.",
        "Kalendář i s filtry si můžeš přihlásit k odběru ve své kalendářové aplikaci.",
      ],
    },
  },
  {
    date: "2026-10-19",
    items: {
      en: ["A race's page and a cup's page show a small map of where it is."],
      cs: ["Stránka závodu i poháru ukazuje malou mapu, kde se jede."],
    },
  },
  {
    date: "2026-10-15",
    items: {
      en: [
        "The map loads faster and zooms smoothly.",
        "You can set a distance around you, and the list shows what is in reach.",
      ],
      cs: [
        "Mapa se načítá rychleji a plynule se přibližuje.",
        "Můžeš nastavit vzdálenost od sebe a seznam ukáže, co máš na dosah.",
      ],
    },
  },
  {
    date: "2026-10-10",
    items: {
      en: [
        "A new About page says who makes Let's Race and where the races come from.",
        "The race table sorts when you click a column.",
      ],
      cs: [
        "Nová stránka O projektu říká, kdo Let's Race dělá a odkud jsou závody.",
        "Tabulka závodů se řadí kliknutím na sloupec.",
      ],
    },
  },
  {
    date: "2026-10-06",
    items: {
      en: [
        "New collections: kids, youth, amateurs and this weekend.",
        "Addresses are in your language.",
      ],
      cs: [
        "Nové sbírky: děti, mládež, amatéři a tento víkend.",
        "Adresy jsou v tvém jazyce.",
      ],
    },
  },
  {
    date: "2026-10-04",
    items: {
      en: [
        "German is the fifth language.",
        "The front page also lists countries, disciplines and cups, so you can browse without the map.",
      ],
      cs: [
        "Němčina je pátým jazykem.",
        "Úvodní stránka nabízí i země, disciplíny a poháry, takže se dá procházet i bez mapy.",
      ],
    },
  },
  {
    date: "2026-10-02",
    items: {
      en: [
        "Many more races have their entry link, regulations and age classes.",
        "Rides and courses that are not races stay out of the lists.",
      ],
      cs: [
        "U mnohem víc závodů je odkaz na přihlášku, propozice a věkové kategorie.",
        "Vyjížďky a kurzy, které nejsou závody, se v seznamech nezobrazují.",
      ],
    },
  },
  {
    date: "2026-10-01",
    items: {
      en: [
        "You can filter by a single age class such as U13.",
        "A race page has a Directions button that opens Google Maps.",
      ],
      cs: [
        "Můžeš filtrovat podle jedné věkové kategorie, třeba U13.",
        "Na stránce závodu je tlačítko Navigovat, které otevře Google Maps.",
      ],
    },
  },
  {
    date: "2026-09-30",
    items: {
      en: [
        "A new layout: a bar on the left switches between the map, the list and the calendar, with the same filters in all three.",
        "On a phone there is an icon bar at the bottom and all the filters fit in one window.",
        "In the plan every rider has a column that shows how far along they are.",
      ],
      cs: [
        "Nové rozložení: lišta vlevo přepíná mapu, seznam a kalendář a všechny mají stejné filtry.",
        "Na telefonu je dole lišta s ikonami a všechny filtry se vejdou do jednoho okna.",
        "V plánu má každý jezdec svůj sloupec, který ukazuje, jak daleko je.",
      ],
    },
  },
  {
    date: "2026-09-28",
    items: {
      en: ["Search forgives typos when you look for a race by name."],
      cs: ["Hledání závodu podle názvu odpustí překlepy."],
    },
  },
  {
    date: "2026-09-17",
    items: {
      en: ["The map remembers your filters and sorting on this device."],
      cs: ["Mapa si pamatuje tvoje filtry a řazení na tomhle zařízení."],
    },
  },
  {
    date: "2026-09-08",
    items: {
      en: ["The plan is a calendar with every day on it, and you pick a day, not a weekend."],
      cs: ["Plán je kalendář se všemi dny a vybíráš den, ne víkend."],
    },
  },
  {
    date: "2026-09-07",
    items: {
      en: [
        "Pins on the map show the bike of their discipline.",
        "On a phone you can open a race and still see half the map.",
      ],
      cs: [
        "Špendlíky na mapě ukazují kolo své disciplíny.",
        "Na telefonu otevřeš závod a pořád vidíš půlku mapy.",
      ],
    },
  },
  {
    date: "2026-09-02",
    items: {
      en: [
        "The plan shows the season as weekends, and you can mark one as taken.",
        "You can take your plan into your phone's calendar.",
      ],
      cs: [
        "Plán ukazuje sezónu po víkendech a víkend můžeš označit jako obsazený.",
        "Plán si můžeš dostat do kalendáře v telefonu.",
      ],
    },
  },
  {
    date: "2026-09-01",
    items: {
      en: [
        "One tap marks a race as paid.",
        "The first screen loads noticeably faster.",
      ],
      cs: [
        "Jedním klepnutím označíš závod jako zaplacený.",
        "První obrazovka se načte znatelně rychleji.",
      ],
    },
  },
  {
    date: "2026-08-31",
    items: {
      en: [
        "Czech races that were missing are in.",
        "Every country, and every discipline in a country, has its own page.",
      ],
      cs: [
        "České závody, které chyběly, jsou v katalogu.",
        "Každá země a každá disciplína v zemi má vlastní stránku.",
      ],
    },
  },
  {
    date: "2026-08-26",
    items: {
      en: ["The site is now called Let's Race."],
      cs: ["Web se teď jmenuje Let's Race."],
    },
  },
  {
    date: "2026-08-25",
    items: {
      en: ["The map on a phone was rebuilt: the map first, with the list in a sheet over it."],
      cs: ["Mapa na telefonu je postavená znovu: napřed mapa a nad ní okno se seznamem."],
    },
  },
  {
    date: "2026-08-18",
    items: {
      en: [
        "The plan, the alerts and Google sign-in arrived: you see who is going and hear when a race changes.",
        "Many official calendars from Austria, Germany, Slovakia, Poland and the Czech Republic.",
      ],
      cs: [
        "Přišel plán, upozornění a přihlášení přes Google: vidíš, kdo jede, a dozvíš se, když se závod změní.",
        "Spousta oficiálních kalendářů z Rakouska, Německa, Slovenska, Polska i Česka.",
      ],
    },
  },
  {
    date: "2026-08-17",
    items: {
      en: ["The list can be sorted by distance from you."],
      cs: ["Seznam jde seřadit podle vzdálenosti od tebe."],
    },
  },
  {
    date: "2026-08-14",
    items: {
      en: ["Age filters, a colour for each discipline and a calendar to pick the date."],
      cs: ["Věkové filtry, barva pro každou disciplínu a kalendář pro výběr data."],
    },
  },
  {
    date: "2026-08-13",
    items: {
      en: ["The first version: bike races from many sources on one map."],
      cs: ["První verze: cyklistické závody z mnoha zdrojů na jedné mapě."],
    },
  },
];

const HEADINGS: Record<Locale, { title: string; earlier: string }> = {
  cs: { title: "Co je nového", earlier: "Starší změny" },
  en: { title: "What's new", earlier: "Earlier changes" },
  pl: { title: "Co nowego", earlier: "Starsze zmiany" },
  sk: { title: "Čo je nové", earlier: "Staršie zmeny" },
  de: { title: "Neuigkeiten", earlier: "Frühere Änderungen" },
};

export function releaseNoteHeadings(locale: Locale) {
  return HEADINGS[locale];
}

/** The items in the reader's language; the languages not yet written read the English. */
export function releaseNoteItems(note: ReleaseNote, locale: Locale): string[] {
  return locale === "cs" ? note.items.cs : note.items.en;
}
