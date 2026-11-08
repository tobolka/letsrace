import type { Locale } from "@/lib/i18n/messages";

/**
 * What changed, for the people who ride — newest first, by day.
 *
 * About the app, not the catalogue: what you can now do, what is easier or what
 * stopped being wrong in the app itself. Individual races, added races and
 * corrected race data never belong here, and neither do speed-ups nobody can
 * feel, clean-ups and security hardening. (The rule for whoever adds an entry is in
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
    date: "2026-11-08",
    items: {
      cs: [
        "Když na mapě poprvé otevřeš závod, mapa zůstane, kde byla, a neodskočí jinam.",
        "Seznam závodů vedle mapy schováš tlačítkem u loga; zůstane z něj malá lišta s filtry, ze které ho zase otevřeš.",
        "Karta závodu na mapě je širší a ukáže víc: program, startovné, kategorie, tratě, areál a pořadatele, když je pořadatel uvádí.",
        "Celý detail závodu otevřeš tlačítkem, které je na kartě vždy dole, a odkazy na web, propozice i předpověď počasí jsou pohromadě v jednom seznamu.",
        "Karta na mapě i stránka závodu řadí údaje stejně a stejně vypadají, takže je najdeš na stejném místě.",
        "Stránka seriálu má tlačítko na web seriálu, pokud ho známe.",
      ],
      en: [
        "Opening a race on the map for the first time leaves the map where it was instead of jumping elsewhere.",
        "The race list beside the map hides with the button by the logo, leaving a small bar with the filters that brings it back.",
        "The race card on the map is wider and shows more: the schedule, fees, categories, routes, venue and organiser, when the organiser gives them.",
        "A button always at the foot of the race card opens the full race page, and the links to the website, regulations and weather forecast sit together in one list.",
        "The race card on the map and the race page order and show the details the same way, so you find them in the same place.",
        "A series page has a button to the series' own website, when we know it.",
      ],
    },
  },
  {
    date: "2026-11-06",
    items: {
      cs: [
        "Tlačítko Web závodu vede na stránku právě toho závodu, ne na cizí kalendář nebo jiný závod téže série.",
        "U závodů uvidíš kategorie s ročníky, kontakt na pořadatele a kde zaparkovat, pokud je pořadatel uvádí.",
        "Po startu závodu najdeš tlačítko Výsledky, které vede na server časomíry.",
        "Čas v programu uvedený jako rozmezí se ukáže celý, od kdy do kdy."
      ],
      en: [
        "The race website button goes to that race's own page, not to another calendar or another race in the series.",
        "Race pages show categories with birth years, the organiser's contact and where to park, when the organiser gives them.",
        "Once a race has started, a Results button takes you to the timing company's site.",
        "A programme time given as a range shows in full, from when until when."
      ],
    },
  },
  {
    date: "2026-11-04",
    items: {
      cs: [
        "Odznak u tvého plánu a středeční e-mail připomínají přihlášení a platbu až čtyři týdny před závodem, a když se nic neděje, e-mail nepřijde.",
      ],
      en: [
        "The badge on your plan and the Wednesday email remind you to enter and pay only in the last four weeks before a race, and no email comes when nothing is happening.",
      ],
    },
  },
  {
    date: "2026-11-03",
    items: {
      cs: [
        "Neznámá délka trasy se nezobrazuje jako závod na 0 km.",
        "Název areálu otevře jeho místo na mapě a podobné závody najdeš až pod zdroji informací o závodu.",
        "V přehledu seriálu najdeš i závody, které současně patří do dalšího seriálu.",
        "Z měsíčního přehledu kolekce přejdeš přímo na závody vybraného měsíce i na dalších stránkách seznamu.",
        "Při posouvání detailu závodu zůstává hlavička s logem nahoře a zobrazí název závodu.",
        "V kolekcích najdeš celý rok 2027 pro Česko, české MTB a dětské závody, včetně přehledu měsíců, známých vzdáleností, kategorií a seriálů.",
        "U závodů s dostupnými podklady najdeš adresu areálu, program, startovné a varianty tras společně s jejich zdroji.",
      ],
      en: [
        "An unknown course length no longer appears as a 0 km race.",
        "Venue names open their location on a map, and similar races appear after the race’s sources.",
        "A series overview also includes races that belong to another series at the same time.",
        "Collection month links take you straight to that month’s races, including on later list pages.",
        "The logo bar stays at the top as you scroll a race page and shows the race name.",
        "Collections cover the full 2027 season for Czech races, Czech MTB and children's races, with monthly counts, known distances, categories and series.",
        "Where sources are available, race pages bring together venue addresses, schedules, entry fees and route options with their sources.",
      ],
    },
  },
  {
    date: "2026-11-02",
    items: {
      en: [
        "Saved race corrections also reach the shared map and calendar automatically.",
        "Race pages show similar races nearby, the routes and categories, earlier and later editions of the race and where we found it.",
        "Races show the weather: an hour-by-hour forecast close to the day, the same week in past years, and a link to Windy.",
        "A race in a series shows its stated round number and how many rounds we list for that season.",
        "Race categories show the birth years they are for, so you can see at a glance which one your child rides.",
        "About the race shows the published distance range.",
        "Elite categories no longer show an assumed age limit or birth years.",
        "Switching races no longer leaves the previous race's round number in the tooltip.",
        "A race page lists the organiser's other upcoming races.",
        "A race page says when the date is a public holiday, a long weekend or in the Czech and Slovak summer holidays.",
        "Four-cross races have their own 4X filter.",
        "A cancelled race keeps its page and says so clearly, and names written in capitals no longer shout.",
        "Links to withdrawn races no longer lead to a different race with a similar name.",
      ],
      cs: [
        "Opravené údaje se automaticky promítají i do společné mapy a kalendáře.",
        "Na stránce závodu najdeš podobné závody v okolí, trasy a kategorie, předchozí i další ročníky a to, odkud závod máme.",
        "U závodů uvidíš počasí: když se blíží, předpověď po hodinách, k tomu ten týden v minulých letech a odkaz na Windy.",
        "U závodu v seriálu vidíš doložené číslo kola a počet kol, která máme pro daný ročník v kalendáři.",
        "U kategorií závodu vidíš ročníky narození, takže hned poznáš, kterou pojede tvoje dítě.",
        "V části O závodě vidíš zveřejněný rozsah vzdáleností.",
        "U kategorie Elite se už nezobrazuje odhadnutá věková hranice ani ročníky narození.",
        "Při přepínání závodů už v nápovědě nezůstává číslo kola předchozího závodu.",
        "Na stránce závodu najdeš další nadcházející závody stejného pořadatele.",
        "Stránka závodu upozorní, když termín připadá na státní svátek, prodloužený víkend nebo letní prázdniny.",
        "Fourcrossové závody mají vlastní filtr 4X.",
        "Zrušený závod si nechá svou stránku s jasnou informací o zrušení a názvy psané velkými písmeny už nekřičí.",
        "Odkazy na stažené závody už nevedou na jiný závod s podobným názvem.",
      ],
    },
  },
  {
    date: "2026-10-31",
    items: {
      en: [
        "You can filter mountain bike orienteering races by MTBO.",
      ],
      cs: [
        "Orientační závody na horských kolech si vyfiltruješ jako MTBO.",
      ],
    },
  },
  {
    date: "2026-10-30",
    items: {
      en: [
        "You can switch races with the arrow keys on the map and in the list, move between calendar days with the keyboard, and close race details with Escape.",
      ],
      cs: [
        "Na mapě a v seznamu přepínáš závody šipkami, mezi dny v kalendáři se pohybuješ klávesnicí a detail závodu zavřeš klávesou Escape.",
      ],
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
      ],
      cs: [
        "Na telefonu se vejde víc závodů a filtry jsou v jednom řádku.",
      ],
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
        "Every country, and every discipline in a country, has its own page.",
      ],
      cs: [
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
      ],
      cs: [
        "Přišel plán, upozornění a přihlášení přes Google: vidíš, kdo jede, a dozvíš se, když se závod změní.",
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
