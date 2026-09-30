import type { Locale } from "@/lib/i18n/messages";

export type TeaserKey = "plan" | "discover" | "riders";

type TeaserCopy = {
  eyebrow: string;
  title: string;
  body: string;
  points: [string, string, string];
};

type TeaserMessages = {
  cta: string;
  browse: string;
  teasers: Record<TeaserKey, TeaserCopy>;
  /** Words inside the illustrations. */
  art: {
    nextRace: string;
    inDays: (n: number) => string;
    registered: string;
    paid: string;
    newRace: string;
    kmAway: (n: number) => string;
    matches: string;
    going: string;
  };
};

/**
 * What a visitor who is not signed in reads on each page of the profile.
 *
 * Kept apart from the app's messages because it is marketing, not interface:
 * it is written to be read once, and it changes for different reasons.
 */
export const teaserMessages: Record<Locale, TeaserMessages> = {
  cs: {
    cta: "Přihlásit se zdarma",
    browse: "Nejdřív se podívat na závody",
    teasers: {
      plan: {
        eyebrow: "Náš plán",
        title: "Celá sezóna v jednom plánu. Žádný zmeškaný start.",
        body: "Uložte si závody, které chcete jet, a zbytek pohlídáme za vás: kdo z rodiny jede, co je zaplacené a kdy se zavírá registrace.",
        points: [
          "Kalendář sezóny, ve kterém volné víkendy uvidíte na první pohled",
          "Připomínka dřív, než se zavře registrace",
          "Termíny rovnou ve vašem Google nebo Apple kalendáři",
        ],
      },
      discover: {
        eyebrow: "Objevovat",
        title: "Nové závody najdou vás.",
        body: "Řekněte nám, kde a co jezdíte. Jakmile se v okolí objeví závod pro vaše disciplíny a kategorie, dáme vám vědět — dřív, než se o něm dozvíte od ostatních.",
        points: [
          "Hlídáme okruh kolem míst, odkud vyrážíte",
          "Doporučení podle disciplín a věkových kategorií",
          "Na volné víkendy vám rovnou navrhneme závod",
        ],
      },
      riders: {
        eyebrow: "Jezdci",
        title: "Víc jezdců v rodině, jeden přehled.",
        body: "Založte profil každému, kdo závodí. Uvidíte, kdo kam jede, podle kategorie nabídneme ty správné závody a kolize termínů odhalíte dřív, než nastanou.",
        points: [
          "Profil s kategorií pro každého jezdce",
          "U každého závodu vidíte, kdo jede",
          "Doporučení šitá na věk a úroveň",
        ],
      },
    },
    art: {
      nextRace: "Příští závod",
      inDays: (n) => `za ${n} dní`,
      registered: "Přihlášeno",
      paid: "Zaplaceno",
      newRace: "Nový závod v okolí",
      kmAway: (n) => `${n} km od vás`,
      matches: "Sedí na XCO · U11",
      going: "jedou",
    },
  },
  en: {
    cta: "Sign in — it's free",
    browse: "Browse races first",
    teasers: {
      plan: {
        eyebrow: "Our plan",
        title: "Your whole season in one plan. Never miss a start.",
        body: "Save the races you want to ride and we keep track of the rest: who in the family is going, what is paid for, and when entries close.",
        points: [
          "A season calendar where free weekends jump out at you",
          "A nudge before registration closes",
          "Every date synced to Google or Apple Calendar",
        ],
      },
      discover: {
        eyebrow: "Discover",
        title: "New races come to you.",
        body: "Tell us where you ride and what you race. The moment a race that fits your disciplines and categories appears nearby, you hear about it — before everyone else does.",
        points: [
          "We watch the area around the places you start from",
          "Suggestions matched to your disciplines and age groups",
          "Free weekends come with a race already picked",
        ],
      },
      riders: {
        eyebrow: "Riders",
        title: "Several riders in the family. One overview.",
        body: "Give everyone who races a profile. See who is going where, get races that suit each category, and spot clashes before they happen.",
        points: [
          "A profile with a category for every rider",
          "See who is going on every race",
          "Suggestions tailored to age and level",
        ],
      },
    },
    art: {
      nextRace: "Next race",
      inDays: (n) => `in ${n} days`,
      registered: "Registered",
      paid: "Paid",
      newRace: "New race nearby",
      kmAway: (n) => `${n} km away`,
      matches: "Fits XCO · U11",
      going: "going",
    },
  },
  pl: {
    cta: "Zaloguj się za darmo",
    browse: "Najpierw przejrzyj wyścigi",
    teasers: {
      plan: {
        eyebrow: "Nasz plan",
        title: "Cały sezon w jednym planie. Żaden start nie umknie.",
        body: "Zapisz wyścigi, w których chcesz wystartować, a resztą zajmiemy się my: kto z rodziny jedzie, co jest opłacone i kiedy zamykają zapisy.",
        points: [
          "Kalendarz sezonu, w którym wolne weekendy widać od razu",
          "Przypomnienie, zanim zamkną się zapisy",
          "Terminy od razu w kalendarzu Google lub Apple",
        ],
      },
      discover: {
        eyebrow: "Odkrywaj",
        title: "Nowe wyścigi same cię znajdą.",
        body: "Powiedz nam, gdzie i co jeździsz. Gdy w okolicy pojawi się wyścig pasujący do twoich dyscyplin i kategorii, damy ci znać — zanim dowiedzą się inni.",
        points: [
          "Pilnujemy okolicy miejsc, z których ruszasz",
          "Propozycje dopasowane do dyscyplin i kategorii wiekowych",
          "Na wolne weekendy od razu podsuniemy wyścig",
        ],
      },
      riders: {
        eyebrow: "Zawodnicy",
        title: "Kilku zawodników w rodzinie. Jeden przegląd.",
        body: "Załóż profil każdemu, kto się ściga. Zobaczysz, kto gdzie jedzie, dostaniesz wyścigi dobrane do kategorii i wyłapiesz kolizje terminów, zanim się zdarzą.",
        points: [
          "Profil z kategorią dla każdego zawodnika",
          "Przy każdym wyścigu widać, kto jedzie",
          "Propozycje dopasowane do wieku i poziomu",
        ],
      },
    },
    art: {
      nextRace: "Najbliższy wyścig",
      inDays: (n) => `za ${n} dni`,
      registered: "Zapisany",
      paid: "Opłacone",
      newRace: "Nowy wyścig w okolicy",
      kmAway: (n) => `${n} km od ciebie`,
      matches: "Pasuje: XCO · U11",
      going: "jadą",
    },
  },
  sk: {
    cta: "Prihlásiť sa zadarmo",
    browse: "Najprv si pozrieť preteky",
    teasers: {
      plan: {
        eyebrow: "Náš plán",
        title: "Celá sezóna v jednom pláne. Žiadny zmeškaný štart.",
        body: "Uložte si preteky, ktoré chcete jazdiť, a zvyšok postrážime za vás: kto z rodiny ide, čo je zaplatené a kedy sa zatvára registrácia.",
        points: [
          "Kalendár sezóny, v ktorom voľné víkendy uvidíte na prvý pohľad",
          "Pripomienka skôr, než sa zatvorí registrácia",
          "Termíny priamo vo vašom Google alebo Apple kalendári",
        ],
      },
      discover: {
        eyebrow: "Objavovať",
        title: "Nové preteky nájdu vás.",
        body: "Povedzte nám, kde a čo jazdíte. Len čo sa v okolí objavia preteky pre vaše disciplíny a kategórie, dáme vám vedieť — skôr, než sa o nich dozviete od ostatných.",
        points: [
          "Strážime okruh okolo miest, odkiaľ vyrážate",
          "Odporúčania podľa disciplín a vekových kategórií",
          "Na voľné víkendy vám rovno navrhneme preteky",
        ],
      },
      riders: {
        eyebrow: "Jazdci",
        title: "Viac jazdcov v rodine, jeden prehľad.",
        body: "Založte profil každému, kto preteká. Uvidíte, kto kam ide, podľa kategórie ponúkneme tie správne preteky a kolízie termínov odhalíte skôr, než nastanú.",
        points: [
          "Profil s kategóriou pre každého jazdca",
          "Pri každých pretekoch vidíte, kto ide",
          "Odporúčania šité na vek a úroveň",
        ],
      },
    },
    art: {
      nextRace: "Najbližšie preteky",
      inDays: (n) => `o ${n} dní`,
      registered: "Prihlásené",
      paid: "Zaplatené",
      newRace: "Nové preteky v okolí",
      kmAway: (n) => `${n} km od vás`,
      matches: "Sedí na XCO · U11",
      going: "idú",
    },
  },
};

export function teaserMessagesFor(locale: string): TeaserMessages {
  return teaserMessages[(locale as Locale) in teaserMessages ? (locale as Locale) : "en"];
}
