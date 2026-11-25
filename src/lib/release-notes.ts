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
    date: "2026-11-25",
    items: {
      cs: [
        "Na iPhonu přidaném na plochu teď mapa sahá až k hornímu okraji displeje bez bílého pruhu pod hodinami.",
        "V tabulce Seznam si teď můžeš zapnout a seřadit i volitelné sloupce Přidáno, Aktualizováno, Ověřeno, Uzávěrka, Propozice a Zdroj.",
        "Nabídky filtrů, sloupců a řazení se teď chovají všude stejně: otevřená je vždy jen jedna, přepnutí na další jde jedním kliknutím a po výběru se zavřou. Dřív některé zůstávaly otevřené navíc.",
      ],
      en: [
        "When opened from an iPhone home screen, the map now reaches the top edge of the screen without a white bar under the clock.",
        "The List table now offers optional sortable columns for Added, Updated, Checked, Entry closes, Regulations and Source.",
        "Filter, column and sort menus now behave the same everywhere: only one is open at a time, switching to another takes a single click, and choosing an option closes it. Before, some stayed open on top of each other.",
      ],
    },
  },
  {
    date: "2026-11-24",
    items: {
      cs: [
        "Odkazy na další závody v okolí a v seriálech se teď vždy otevřou jako běžná stránka závodu.",
      ],
      en: [
        "Links to nearby and series races now always open as normal race pages.",
      ],
    },
  },
  {
    date: "2026-11-23",
    items: {
      cs: [
        "Sdílení závodu posílá přímý odkaz na jeho stránku s náhledem místo obecné mapy.",
        "Tlačítko Zobrazit na mapě na stránce země otevře všechny nadcházející závody, ne jen tento víkend.",
        "Praktické údaje před cestou na závod a kategorie jezdců jsou přeložené i do slovenštiny, němčiny a polštiny.",
      ],
      en: [
        "Sharing a race sends a direct link to its own page with a preview instead of the general map.",
        "View on map from a country page opens all upcoming races rather than only this weekend.",
        "Before-you-travel details and rider categories are now translated into Slovak, German and Polish too.",
      ],
    },
  },
  {
    date: "2026-11-22",
    items: {
      cs: [
        "Odkazy u závodu jsou na mapě a na stránce závodu stejné: stejné názvy, pořadí i řádky (včetně seriálu a předpovědi počasí).",
        "Navigace k závodu vede na místo konání z propozic, když pořadatel uvádí jeho souřadnice, ne jen do středu obce.",
        "Vybraný závod je na mapě vidět hned: pin je větší a má kolem sebe výrazný tmavý prstenec.",
      ],
      en: [
        "A race's links are the same on the map and on its own page: the same names, the same order and the same rows, including the series and the forecast.",
        "Directions to a race lead to the venue named in the regulations when the organiser gives its coordinates, not just to the middle of the town.",
        "The race you picked stands out on the map: its pin is larger and wears a clear dark ring.",
      ],
    },
  },
  {
    date: "2026-11-21",
    items: {
      cs: [
        "U závodu a seriálu najdeš odkaz na jeho facebookovou stránku, kde pořadatelé často jako první zveřejní termín, plakát a změny.",
        "Když propozice závodu vypisují všechny kategorie, ukazujeme je jako potvrzené a ne jako odhad, i když se startovné platí podle trati.",
      ],
      en: [
        "Races and series can link to their Facebook page, where organisers often post the date, the poster and changes first.",
        "When a race's regulations list all its categories, we show them as confirmed instead of an estimate, even if the entry fee is priced by distance.",
      ],
    },
  },
  {
    date: "2026-11-19",
    items: {
      cs: ["Odkazy u seriálu vypadají stejně jako u závodu: šedé řádky s ikonou a šipkou pod nadpisem Odkazy."],
      en: ["Links on a series look the same as on a race: grey rows with an icon and an arrow under a Links heading."],
    },
  },
  {
    date: "2026-11-18",
    items: {
      cs: [
        "Když se na mapě sejdou závody různých disciplín, má každá svou barevnou bublinu. Čím větší bublina, tím víc závodů.",
        "Mapa i seznam teď ukazují všechny nadcházející závody, ne jen ty o víkendu. U počtu závodů vždy vidíš, za jaké období je, a vybrané datum zrušíš křížkem.",
        "Když otevřeš odkaz na závod, který ti někdo poslal, tvoje vlastní filtry zůstanou, jak sis je nastavil.",
        "Při libovolném datu jsou závody, které už proběhly, zešedlé, a u závodů z jiného roku je uvedený i rok.",
        "Karta závodu na mapě má novou záložku Počasí: předpověď po hodinách na den závodu a jaké počasí bývalo ve stejném týdnu posledních deset let.",
        "Když u jezdců vyplníš rok narození, uvidíš u každého závodu, do které kategorie patří a kolik je startovné. Najdeš to na kartě závodu, na jeho stránce i ve svém plánu.",
        "U jezdce teď můžeš vyplnit pohlaví. U závodu se ti pak ukáže jen jeho kategorie, dívčí, nebo chlapecká.",
        "Ve filtrech si můžeš vybrat jednoho ze svých jezdců. Mapa, seznam i kalendář pak ukážou závody pro jeho věk a jeho oblíbené disciplíny.",
        "Když máš na stejný den v plánu jiný závod nebo sis ten den označil jako obsazený, upozorní tě na to u závodu žlutá bublina.",
        "V Nastavení si teď můžeš smazat účet i se vším, co je v něm uložené.",
        "Nové Podmínky užití a doplněná Ochrana soukromí ve všech jazycích webu: kdo web provozuje, odkud jsou údaje o závodech a co se děje s tvými daty. Odkazy najdeš v nabídce účtu a dole na stránce O projektu.",
        "Závod bez vlastního webu má na kartě odkaz na svou stránku u cyklistického svazu nebo u UCI, takže se vždy dostaneš k podrobnostem.",
        "Delší program, startovné, kategorie a tratě rozbalíš přímo na kartě závodu, nemusíš kvůli nim otevírat celý detail.",
        "Když závod odpovídá zvolenému věku jen podle našeho odhadu, upozorní tě na kartě žlutá poznámka, ať si kategorie ověříš.",
        "Filtr jezdce se na liště ukáže, jen když je zapnutý; vybereš ho v nabídce filtrů jako ostatní.",
      ],
      en: [
        "When races from different disciplines meet on the map, each discipline has its own coloured bubble. The bigger the bubble, the more races in it.",
        "The map and the list now show every upcoming race, not just this weekend's. The race count always says which dates it covers, and a chosen date clears with its cross.",
        "Opening a race link someone sent you keeps your own filters as you set them.",
        "With any date chosen, races that have already taken place are greyed out, and races from another year show the year.",
        "The race card on the map has a new Weather tab: an hour-by-hour forecast for race day, and what the weather was like that week over the past ten years.",
        "Give your riders a year of birth and each race shows which category they ride in and what the entry costs, on the race card, on the race page and in your plan.",
        "You can now give a rider a gender, and a race then shows only their category, the girls' or the boys'.",
        "Pick one of your riders in the filters, and the map, list and calendar show races for their age and the disciplines they like.",
        "If your plan already has another race that day, or you marked the day as taken, a yellow bubble on the race tells you.",
        "You can now delete your account, with everything saved in it, from Settings.",
        "New Terms of use and a fuller Privacy page in every language of the site: who runs it, where the race details come from and what happens to your data. The links are in the account menu and at the bottom of the About page.",
        "A race without a website of its own links to its page at the cycling federation or the UCI, so you can always reach the details.",
        "Longer schedules, fees, categories and routes open right on the race card, without going to the full race page.",
        "When a race matches the chosen age only by our estimate, a yellow note on the race card asks you to check the categories.",
        "The rider filter shows on the bar only while it is on; you pick it from the filter menu like the others.",
      ],
    },
  },
  {
    date: "2026-11-16",
    items: {
      cs: [
        "Let's Race si přidáš na plochu telefonu a otevřeš ho jako aplikaci, přes celou obrazovku a s vlastní ikonou. Návod najdeš v nabídce Více.",
        "Otevřená z plochy iPhonu se aplikace spouští s logem Let's Race a mapa nahoře nemizí do bílé.",
        "Let's Race má klub na Stravě a stránku na Facebooku; odkazy najdeš na stránce O projektu.",
      ],
      en: [
        "Add Let's Race to your phone's home screen and open it like an app, full screen with its own icon. Find out how under More.",
        "Opened from an iPhone's home screen, the app starts with the Let's Race logo, and the top of the map no longer fades into white.",
        "Let's Race has a Strava club and a Facebook page; the links are on the About page.",
      ],
    },
  },
  {
    date: "2026-11-14",
    items: {
      cs: [
        "Závod, který startuje v jednom městě a končí v jiném, má na stránce závodu místo startu, ne depo ani cíl.",
      ],
      en: [
        "A race that starts in one town and finishes in another shows its start on the race page, not a depot or the finish.",
      ],
    },
  },
  {
    date: "2026-11-13",
    items: {
      cs: [
        "V plánu zůstává název měsíce nahoře, dokud jím listuješ, a víkendy v přehledu dní hned poznáš.",
        "Dlouhé názvy závodů se na mapě po najetí myší vejdou do bublinky.",
        "Na kartě závodu vidíš u data, za kolik dní závod je, a tlačítka máš v jedné řadě stejně jako na stránce závodu.",
      ],
      en: [
        "Keep the month in view as you scroll your plan, and spot weekends at a glance in the sheet.",
        "Long race names fit in the label when you hover over a race on the map.",
        "See how many days are left to a race on its card, with the actions in one row as on the race page.",
      ],
    },
  },
  {
    date: "2026-11-12",
    items: {
      cs: [
        "Klikni na den v kalendáři plánu a rovnou najdi závody na mapě nebo označ den jako obsazený.",
        "Závody v plánu poznáš podle modrého řádku a kalendáře s fajfkou.",
        "Seriály najdeš v přehledech zemí i kolekcích, seřazené podle počtu závodů.",
        "Názvy měst se na mapě zobrazují i po aktualizaci webu.",
      ],
      en: [
        "Select a day in your plan calendar to find races on the map or mark the day as busy.",
        "Spot races in your plan by the blue row and checked calendar icon.",
        "Browse series by number of races on country and collection pages.",
        "City names stay visible on the map after a site update.",
      ],
    },
  },
  {
    date: "2026-11-11",
    items: {
      cs: [
        "V plánu vidíš celý termín vícedenního závodu i to, kdo jede, kdo je přihlášený a kdo zaplatil.",
        "Na mapě závodu vidíš název místa a v předpovědi si zvýrazníš počasí pro konkrétní hodinu.",
        "Při přepínání stránek v Safari zmizel modrý rámeček kolem obsahu.",
      ],
      en: [
        "See the full dates of multi-day races and who’s going, entered or paid.",
        "See the venue name on the race map and highlight an hour in the forecast.",
        "Switch pages in Safari without a blue outline around the content.",
      ],
    },
  },
  {
    date: "2026-11-09",
    items: {
      cs: [
        "Kartu závodu na mapě si zvětši nebo ji přichyť k okraji.",
        "Web závodu, přihlášky, sdílení a navigaci najdeš na kartě i v detailu.",
        "Ze seznamu i kalendáře otevřeš závod přímo na mapě.",
      ],
      en: [
        "Resize the race card on the map or snap it to either side.",
        "Find the race website, registration, sharing and directions on the card and race page.",
        "Open a race on the map from the list or calendar.",
      ],
    },
  },
  {
    date: "2026-11-08",
    items: {
      cs: [
        "Otevři závod přímo na mapě a měj po ruce program, startovné, kategorie i tratě.",
        "Schovej seznam vedle mapy a nech si filtry po ruce.",
        "Na stránce seriálu zjistíš, pro koho je, jaké má disciplíny a kde najdeš oficiální informace.",
      ],
      en: [
        "Open a race on the map to see its schedule, entry fees, categories and routes.",
        "Hide the list beside the map and keep the filters handy.",
        "See who a series is for, what disciplines it covers and where to find official information.",
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
