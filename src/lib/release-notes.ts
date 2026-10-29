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
    date: "2026-10-29",
    items: {
      en: [
        "Our plan looks the same in every view now: the same headings, the same month bands and the same names for riders.",
        "In the plan's calendar you can subscribe with the same link you have in settings, so the family's season shows up in your phone's calendar.",
        "Races you have in your plan are tinted the same way everywhere: in lists, in the calendar and on the cup pages.",
        "On a race's card, the cup it belongs to has a small arrow that opens the cup's own page.",
        "History in the plan sits apart, at the end of the switcher. The filters that never worked well are gone.",
      ],
      cs: [
        "Náš plán vypadá ve všech pohledech stejně: stejné hlavičky, stejné měsíční pásy a stejná jména jezdců.",
        "V kalendáři plánu se dá přihlásit k odběru stejným odkazem jako v nastavení, takže rodinná sezóna naskočí do kalendáře v telefonu.",
        "Závody, které máš v plánu, jsou všude podbarvené stejně: v seznamech, v kalendáři i na stránkách pohárů.",
        "Na kartě závodu je u poháru malá šipka, která otevře stránku celého poháru.",
        "Historie je v plánu odděleně, úplně na konci přepínače. Filtry, které nefungovaly dobře, jsou pryč.",
      ],
    },
  },
  {
    date: "2026-10-26",
    items: {
      en: ["We now count visits in a way that respects your privacy."],
      cs: ["Návštěvnost teď počítáme způsobem, který respektuje tvoje soukromí."],
    },
  },
  {
    date: "2026-10-23",
    items: {
      en: [
        "On a phone, more races fit on the screen: the filters are one row, and you can remove a filter with one tap.",
        "The phone has a new “More” tab, and the buttons on a race are roomier for thumbs.",
        "A race that appears on several websites is shown once, and a date the organiser gives is no longer overwritten by a calendar that has it wrong.",
        "Races with several rounds or stages stay separate instead of being merged into one.",
      ],
      cs: [
        "Na telefonu se na obrazovku vejde víc závodů: filtry jsou v jednom řádku a filtr zrušíš jedním klepnutím.",
        "Telefon má novou záložku „Více“ a tlačítka u závodu jsou větší pro prsty.",
        "Závod, který je na více webech, vidíš jednou, a datum od pořadatele už nepřepíše kalendář, který ho má špatně.",
        "Závody s více koly nebo etapami zůstávají oddělené, nesloučí se do jednoho.",
      ],
    },
  },
  {
    date: "2026-10-22",
    items: {
      en: [
        "Every button that is only an icon now says what it does when you hover over it.",
        "The plan's dropdown for “going / entered / paid” opens in the right place again.",
      ],
      cs: [
        "Každé tlačítko, které je jen ikona, teď po najetí řekne, co dělá.",
        "Nabídka „jede / přihlášen / zaplaceno“ v plánu se zase otevírá na správném místě.",
      ],
    },
  },
  {
    date: "2026-10-21",
    items: {
      en: ["Races from Sumator are now placed where the organiser puts the start, not in the middle of the nearest town."],
      cs: ["Závody ze Sumatoru jsou teď na mapě tam, kde pořadatel označil start, ne uprostřed nejbližšího města."],
    },
  },
  {
    date: "2026-10-20",
    items: {
      en: [
        "Let's Race was announced to the public.",
        "You can pick several countries and several disciplines at once.",
        "You can subscribe to the calendar, with the filters you have chosen, in your own calendar app.",
        "People outside Europe get a map of Europe, not an empty ocean.",
        "Race collections (for example kids' races) show their own map.",
      ],
      cs: [
        "Let's Race byl poprvé oznámen veřejnosti.",
        "Můžeš vybrat víc zemí a víc disciplín najednou.",
        "Kalendář i s nastavenými filtry si můžeš přihlásit k odběru ve vlastní kalendářové aplikaci.",
        "Kdo se dívá mimo Evropu, uvidí mapu Evropy, ne prázdný oceán.",
        "Sbírky závodů (třeba dětské závody) mají vlastní mapu.",
      ],
    },
  },
  {
    date: "2026-10-19",
    items: {
      en: [
        "A race's page and a cup's page show a small map of where it is.",
        "From a race or a cup you can open the big map on exactly those dates.",
      ],
      cs: [
        "Stránka závodu i poháru ukazuje malou mapu, kde se jede.",
        "Ze závodu nebo poháru otevřeš velkou mapu rovnou na správných datech.",
      ],
    },
  },
  {
    date: "2026-10-15",
    items: {
      en: [
        "The map loads faster, zooms smoothly with the mouse wheel and opens a group of races when you click it.",
        "You can set a distance around you and the list highlights what is in reach.",
      ],
      cs: [
        "Mapa se načítá rychleji, plynule se přibližuje kolečkem myši a po kliknutí rozbalí skupinu závodů.",
        "Můžeš nastavit vzdálenost od sebe a seznam zvýrazní, co máš na dosah.",
      ],
    },
  },
  {
    date: "2026-10-10",
    items: {
      en: [
        "A new About page says who makes Let's Race and where the races come from.",
        "The race table sorts when you click a column.",
        "Old race links find their race, and a page that does not exist helps you on.",
        "Places show the town, not “Germany” or “TBC”.",
      ],
      cs: [
        "Nová stránka O projektu říká, kdo Let's Race dělá a odkud jsou závody.",
        "Tabulka závodů se řadí kliknutím na sloupec.",
        "Staré odkazy na závody najdou svůj závod a stránka, která neexistuje, poradí, kam dál.",
        "U míst je město, ne „Německo“ nebo „TBC“.",
      ],
    },
  },
  {
    date: "2026-10-06",
    items: {
      en: [
        "New collections: kids, kids this weekend, youth, amateurs and this weekend.",
        "Addresses are in your language, and race links are readable (for example /cs/zavod/…).",
        "“Add to plan” works on race pages, the map and the lists.",
      ],
      cs: [
        "Nové sbírky: děti, děti tento víkend, mládež, amatéři a tento víkend.",
        "Adresy jsou v tvém jazyce a odkazy na závody se dají přečíst.",
        "„Přidat do plánu“ funguje na stránce závodu, na mapě i v seznamech.",
      ],
    },
  },
  {
    date: "2026-10-04",
    items: {
      en: [
        "German is the fifth language of Let's Race.",
        "The front page also lists countries, disciplines, cups and the races of the coming week, so you can browse without the map.",
      ],
      cs: [
        "Němčina je pátým jazykem Let's Race.",
        "Úvodní stránka teď nabízí i země, disciplíny, poháry a závody příštího týdne, takže se dá procházet i bez mapy.",
      ],
    },
  },
  {
    date: "2026-10-02",
    items: {
      en: [
        "Many more races have their entry link, their regulations and their age classes, found on the organisers' own pages.",
        "Rides and courses that are not races stay out of the race lists.",
        "On a phone the calendar is a compact month with the day's races underneath.",
      ],
      cs: [
        "U mnohem víc závodů je odkaz na přihlášku, propozice a věkové kategorie, nalezené na stránkách pořadatelů.",
        "Vyjížďky a kurzy, které nejsou závody, se v seznamech závodů nezobrazují.",
        "Na telefonu je kalendář kompaktní měsíc a pod ním závody vybraného dne.",
      ],
    },
  },
  {
    date: "2026-10-01",
    items: {
      en: [
        "You can filter by a single age class such as U13, and U13 counts as youth, not kids.",
        "A race page has a Directions button that opens Google Maps from where you are.",
        "Virtual rides are hidden, and the same race listed under two names is shown once.",
        "Austrian races have their real place, classes and website.",
      ],
      cs: [
        "Můžeš filtrovat podle jedné věkové kategorie, třeba U13, a U13 se počítá jako mládež, ne jako děti.",
        "Na stránce závodu je tlačítko Navigovat, které otevře Google Maps odkud právě jsi.",
        "Virtuální jízdy jsou schované a stejný závod pod dvěma názvy vidíš jednou.",
        "Rakouské závody mají skutečné místo, kategorie i web.",
      ],
    },
  },
  {
    date: "2026-09-30",
    items: {
      en: [
        "A new layout: a bar on the left switches between the map, the list and the calendar, and all three share the same filters.",
        "On a phone there is an icon bar at the bottom on every screen, and all the filters fit in one sheet.",
        "In the plan every rider has a column, and one dropdown shows how far along they are.",
        "The race categories now come from the federations and organisers' regulations, so filtering by age finds races instead of dropping them.",
      ],
      cs: [
        "Nové rozložení: lišta vlevo přepíná mapu, seznam a kalendář a všechny tři mají stejné filtry.",
        "Na telefonu je na každé obrazovce dole lišta s ikonami a všechny filtry se vejdou do jednoho okna.",
        "V plánu má každý jezdec svůj sloupec a jedna nabídka ukáže, jak daleko je.",
        "Kategorie závodů se berou ze svazů a z propozic pořadatelů, takže filtr podle věku závody najde, místo aby je vyřadil.",
      ],
    },
  },
  {
    date: "2026-09-28",
    items: {
      en: [
        "Search forgives typos when you look for a race by name.",
        "The Pražský MTB pohár 2027 is in.",
      ],
      cs: [
        "Hledání závodu podle názvu odpustí překlepy.",
        "Pražský MTB pohár 2027 je v katalogu.",
      ],
    },
  },
  {
    date: "2026-09-17",
    items: {
      en: [
        "The map remembers your filters and your sorting on this device.",
        "A race can belong to more than one cup.",
        "The main Czech cups now match their own official calendars.",
      ],
      cs: [
        "Mapa si pamatuje tvoje filtry i řazení na tomhle zařízení.",
        "Závod může patřit do víc pohárů.",
        "Hlavní české poháry teď odpovídají svým oficiálním kalendářům.",
      ],
    },
  },
  {
    date: "2026-09-08",
    items: {
      en: [
        "The plan is a calendar with every day on it, and you pick a day, not a weekend.",
        "Races that are already over say so.",
        "Similar names such as “Park Bike” and “PARKBIKE” are recognised as one race.",
      ],
      cs: [
        "Plán je kalendář se všemi dny a vybíráš den, ne víkend.",
        "U závodů, které už proběhly, to je napsané.",
        "Podobné názvy jako „Park Bike“ a „PARKBIKE“ se poznají jako jeden závod.",
      ],
    },
  },
  {
    date: "2026-09-07",
    items: {
      en: [
        "Each pin on the map has a small bike of its own discipline inside, and several races at one place show how many there are.",
        "On a phone you open a race and the map keeps half of the screen.",
        "Changing the language changes the language, not the page you are on.",
      ],
      cs: [
        "Každý špendlík na mapě má uvnitř malé kolo své disciplíny a několik závodů na jednom místě ukáže, kolik jich je.",
        "Na telefonu otevřeš závod a mapa si nechá půl obrazovky.",
        "Změna jazyka změní jazyk, ne stránku, na které jsi.",
      ],
    },
  },
  {
    date: "2026-09-02",
    items: {
      en: [
        "The plan shows the season as weekends, and you can mark a weekend as taken, for a wedding for example.",
        "You can take your plan into your phone's calendar.",
        "You can search for a race by its name instead of a mountain range.",
      ],
      cs: [
        "Plán ukazuje sezónu po víkendech a víkend můžeš označit jako obsazený, třeba kvůli svatbě.",
        "Plán si můžeš dostat do kalendáře v telefonu.",
        "Závod můžeš hledat podle jména, ne podle pohoří.",
      ],
    },
  },
  {
    date: "2026-09-01",
    items: {
      en: [
        "One tap marks a race as paid.",
        "The site suggests something for a weekend that has nothing on it.",
        "The first screen loads noticeably faster, and the list does not jump around while it loads.",
      ],
      cs: [
        "Jedním klepnutím označíš závod jako zaplacený.",
        "Když na víkend nic nemáš, web ti něco nabídne.",
        "První obrazovka se načte znatelně rychleji a seznam při načítání neskáče.",
      ],
    },
  },
  {
    date: "2026-08-31",
    items: {
      en: [
        "Czech races that were missing, because the federation's website had stalled on our side, are in.",
        "Pages for each country and for each discipline in a country, so “mountain bike races in Slovakia” has a page of its own.",
        "Polish calendars were added.",
      ],
      cs: [
        "České závody, které chyběly, protože se nám zasekl portál svazu, jsou v katalogu.",
        "Každá země a každá disciplína v zemi má vlastní stránku, takže „závody horských kol na Slovensku“ mají svoji stránku.",
        "Přibyly polské kalendáře.",
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
      en: ["The map on a phone was rebuilt: the map first, a sheet with the list on top of it."],
      cs: ["Mapa na telefonu je postavená znovu: napřed mapa a nad ní okno se seznamem."],
    },
  },
  {
    date: "2026-08-18",
    items: {
      en: [
        "The plan, the alerts and Google sign-in arrived: you see who is going, and hear when a race changes.",
        "A flood of official calendars from Austria, Germany, Slovakia, Poland and the Czech Republic, including kids' cups.",
        "A new filter bar and a fresh look.",
      ],
      cs: [
        "Přišel plán, upozornění a přihlášení přes Google: vidíš, kdo jede, a dozvíš se, když se závod změní.",
        "Spousta oficiálních kalendářů z Rakouska, Německa, Slovenska, Polska i Česka, včetně dětských pohárů.",
        "Nový panel filtrů a nový vzhled.",
      ],
    },
  },
  {
    date: "2026-08-17",
    items: {
      en: [
        "The list can be sorted by distance from you.",
        "You can search for a place on the map, and races link to their regulations.",
      ],
      cs: [
        "Seznam jde seřadit podle vzdálenosti od tebe.",
        "Na mapě můžeš hledat místo a závody odkazují na své propozice.",
      ],
    },
  },
  {
    date: "2026-08-14",
    items: {
      en: [
        "Age filters that only say what is known, a colour for each discipline and a calendar to pick the date.",
        "More of Europe on the map.",
      ],
      cs: [
        "Věkové filtry, které říkají jen to, co je jisté, barva pro každou disciplínu a kalendář pro výběr data.",
        "Na mapě je víc Evropy.",
      ],
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
