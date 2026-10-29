import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DOC_WIDTH } from "@/components/account/panel";
import { asLocale, locales, type Locale } from "@/lib/i18n/messages";
import { absoluteUrl, getSiteUrl, localeAlternates, SITE_AUTHOR, SITE_NAME } from "@/lib/seo";

const CONTACT = "info@letsrace.cz";
const UPDATED = "2026-10-17";
// Snapshot of distinct fetched watched_urls hosts and public, unmerged 2026 events.
const SEASON_SNAPSHOT = { sites: 214, races: 4563, nextRaces: 660 } as const;

type Doc = {
  title: string;
  intro: string;
  updated: string;
  season: string;
  sites: string;
  races: string;
  nextRaces: string;
  browse: string;
  sections: { h: string; p: string[] }[];
};

/**
 * Who makes the site and where its races come from. A search engine — and a
 * parent deciding whether to drive two hours on the strength of a listing —
 * wants to know both, and the site said neither anywhere.
 */
const DOCS: Record<Locale, Doc> = {
  cs: {
    title: "O projektu",
    intro: "Cyklistické závody z různých zdrojů na jedné mapě. Vzniklo to z docela obyčejné otázky: kam pojedeme o víkendu závodit?",
    updated: "Poslední změna",
    season: "Sezóna 2026 · stav k 17. 10. 2026",
    sites: "načtených webů",
    races: "závodů v katalogu",
    nextRaces: "Na rok 2027 už je v katalogu {n} plánovaných závodů. Další kalendáře průběžně přibývají.",
    browse: "Prohlédnout mapu závodů",
    sections: [
      {
        h: "Proč to vzniklo",
        p: [
          `Jmenuju se ${SITE_AUTHOR.name} a ${SITE_NAME} jsem postavil pro sebe a svou rodinu. Chtěl jsem rychle zjistit, kam můžeme vyrazit s dětmi o víkendu nebo na výletě. Při hledání na různých webech nám navíc utíkaly závody hned za hranicemi.`,
        ],
      },
      {
        h: "Jak to funguje",
        p: [
          "Sledujeme kalendáře svazů i weby pořadatelů a seriálů. Z nalezených závodů skládáme přehled termínů, míst, disciplín, kategorií a odkazů na přihlášky. Na mapě a v kalendáři si pak můžeš vybrat bez přeskakování mezi zdroji.",
        ],
      },
      {
        h: "Odkud jsou údaje",
        p: [
          "U závodu najdeš odkaz na pořadatele, propozice nebo kalendář svazu a údaj o tom, kdy jsme ho naposledy našli. Zdroje průběžně kontrolujeme; rozhodující informace si před startem vždy ověř u pořadatele.",
        ],
      },
      {
        h: "Když něco nesedí",
        p: [
          `Našel jsi chybu nebo tu některý závod chybí? Napiš mi na ${CONTACT}. Odkaz na původní zdroj mi pomůže údaj rychle ověřit.`,
        ],
      },
    ],
  },
  en: {
    title: "About",
    intro: `${SITE_NAME} puts the bike races of Central Europe in one place, on a map and in a calendar.`,
    updated: "Last updated",
    season: "2026 season · as of 17 October 2026",
    sites: "websites read",
    races: "races in the catalogue",
    nextRaces: "The 2027 catalogue already has {n} scheduled races. More calendars are being published.",
    browse: "Explore the race map",
    sections: [
      {
        h: "Why it exists",
        p: [
          `I'm ${SITE_AUTHOR.name}. I built ${SITE_NAME} to find races for weekends and trips with my family, including those just across the border that we would otherwise miss.`,
        ],
      },
      {
        h: "How it works",
        p: [
          "The site reads thousands of pages from federations, organisers and race series. It takes what matters from each race: the date, the place, the discipline, the categories and the entry link. Then it puts all of it on one map and in one calendar, across countries.",
        ],
      },
      {
        h: "Where the information comes from",
        p: [
          "Every race links to its source: the organiser's site, the regulations or a federation calendar. The catalogue is refreshed every day, and each race shows when we last found it at its source.",
        ],
      },
      {
        h: "When something is wrong",
        p: [
          `We take our information from organisers and sometimes get it wrong. Always check the date and conditions in the regulations before you go. Tell us about a mistake, or a race that is missing, at ${CONTACT}.`,
        ],
      },
    ],
  },
  pl: {
    title: "O projekcie",
    intro: `${SITE_NAME} zbiera wyścigi rowerowe z Europy Środkowej w jednym miejscu, na mapie i w kalendarzu.`,
    updated: "Ostatnia zmiana",
    season: "Sezon 2026 · stan na 17.10.2026",
    sites: "przeczytanych serwisów",
    races: "wyścigów w katalogu",
    nextRaces: "W katalogu na 2027 rok jest już {n} zaplanowanych wyścigów. Kolejne kalendarze stopniowo się pojawiają.",
    browse: "Zobacz mapę wyścigów",
    sections: [
      {
        h: "Skąd ten pomysł",
        p: [
          `Nazywam się ${SITE_AUTHOR.name}. Stworzyłem ${SITE_NAME}, żeby łatwiej znajdować wyścigi na weekendy i wyjazdy z rodziną, także te tuż za granicą, o których wcześniej nie wiedzieliśmy.`,
        ],
      },
      {
        h: "Jak to działa",
        p: [
          "Strona przegląda tysiące stron związków, organizatorów i cykli. Z każdego wyścigu wyciąga to, co ważne: termin, miejsce, dyscyplinę, kategorie i link do zapisów. Wszystko trafia na jedną mapę i do jednego kalendarza, ponad granicami.",
        ],
      },
      {
        h: "Skąd są dane",
        p: [
          "Każdy wyścig ma link do źródła: strony organizatora, regulaminu lub kalendarza związku. Katalog odświeżamy codziennie, a przy wyścigu widać, kiedy ostatnio znaleźliśmy go w źródle.",
        ],
      },
      {
        h: "Gdy coś się nie zgadza",
        p: [
          `Dane bierzemy od organizatorów i czasem się mylimy. Przed startem zawsze sprawdź termin i warunki w regulaminie. Błąd albo brakujący wyścig zgłoś na ${CONTACT}.`,
        ],
      },
    ],
  },
  sk: {
    title: "O projekte",
    intro: `${SITE_NAME} dáva cyklistické preteky zo strednej Európy na jedno miesto, na mapu a do kalendára.`,
    updated: "Posledná zmena",
    season: "Sezóna 2026 · stav k 17. 10. 2026",
    sites: "prečítaných webov",
    races: "pretekov v katalógu",
    nextRaces: "V katalógu na rok 2027 je už {n} plánovaných pretekov. Ďalšie kalendáre postupne pribúdajú.",
    browse: "Pozrieť mapu pretekov",
    sections: [
      {
        h: "Prečo to vzniklo",
        p: [
          `Volám sa ${SITE_AUTHOR.name}. ${SITE_NAME} som vytvoril, aby som ľahšie našiel preteky na víkendy a výlety s rodinou, aj tie kúsok za hranicami, o ktorých sme predtým nevedeli.`,
        ],
      },
      {
        h: "Ako to funguje",
        p: [
          "Web prechádza tisíce stránok zväzov, organizátorov a seriálov. Pri každých pretekoch vytiahne to podstatné: termín, miesto, disciplínu, kategórie a odkaz na prihlášky. Všetko je potom na jednej mape a v jednom kalendári, naprieč krajinami.",
        ],
      },
      {
        h: "Odkiaľ sú údaje",
        p: [
          "Každé preteky odkazujú na svoj zdroj: web organizátora, propozície alebo kalendár zväzu. Katalóg sa obnovuje každý deň a pri pretekoch vidíš, kedy sme ich naposledy našli v zdroji.",
        ],
      },
      {
        h: "Keď niečo nesedí",
        p: [
          `Údaje preberáme od organizátorov a niekedy sa pomýlime. Pred štartom si termín a podmienky vždy over v propozíciách. Chybu alebo chýbajúce preteky nám napíš na ${CONTACT}.`,
        ],
      },
    ],
  },
  de: {
    title: "Über das Projekt",
    intro: `${SITE_NAME} bringt die Radrennen Mitteleuropas an einen Ort, auf eine Karte und in einen Kalender.`,
    updated: "Zuletzt geändert",
    season: "Saison 2026 · Stand 17.10.2026",
    sites: "gelesene Websites",
    races: "Rennen im Katalog",
    nextRaces: "Für 2027 stehen bereits {n} geplante Rennen im Katalog. Weitere Kalender kommen nach und nach hinzu.",
    browse: "Rennkarte ansehen",
    sections: [
      {
        h: "Warum es das gibt",
        p: [
          `Ich bin ${SITE_AUTHOR.name}. Ich habe ${SITE_NAME} gebaut, um Rennen für Wochenenden und Ausflüge mit meiner Familie zu finden, auch direkt hinter der Grenze, wo wir früher oft nichts mitbekamen.`,
        ],
      },
      {
        h: "Wie es funktioniert",
        p: [
          "Die Seite liest Tausende Seiten von Verbänden, Veranstaltern und Rennserien. Sie nimmt aus jedem Rennen das Wesentliche: Termin, Ort, Disziplin, Klassen und den Link zur Anmeldung. Alles landet auf einer Karte und in einem Kalender, über Ländergrenzen hinweg.",
        ],
      },
      {
        h: "Woher die Angaben stammen",
        p: [
          "Jedes Rennen verlinkt auf seine Quelle: die Website des Veranstalters, die Ausschreibung oder einen Verbandskalender. Der Katalog wird täglich aktualisiert, und bei jedem Rennen steht, wann wir es zuletzt in der Quelle gefunden haben.",
        ],
      },
      {
        h: "Wenn etwas nicht stimmt",
        p: [
          `Wir übernehmen die Angaben von den Veranstaltern und irren uns manchmal. Prüfe Termin und Bedingungen vor dem Start immer in der Ausschreibung. Fehler oder fehlende Rennen gerne an ${CONTACT}.`,
        ],
      },
    ],
  },
};

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const doc = DOCS[locale];
  return {
    title: { absolute: `${doc.title} · ${SITE_NAME}` },
    description: doc.intro,
    alternates: { canonical: absoluteUrl(`/${locale}/about`), languages: localeAlternates("about") },
  };
}

export default async function AboutPage({ params }: Props) {
  const raw = (await params).locale;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const doc = DOCS[locale];
  const site = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: doc.title,
    url: absoluteUrl(`/${locale}/about`),
    inLanguage: locale,
    dateModified: UPDATED,
    about: { "@id": `${site}/#organization` },
    mainEntity: {
      "@type": "Organization",
      "@id": `${site}/#organization`,
      name: SITE_NAME,
      url: site,
      email: CONTACT,
      founder: { "@type": "Person", name: SITE_AUTHOR.name, url: SITE_AUTHOR.url },
    },
  };
  return (
    <main className="p-4 md:p-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <article className={DOC_WIDTH}>
        <header className="border-b pb-7 md:pb-9">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{doc.title}</p>
          <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-balance md:text-4xl">{doc.intro}</h1>
          <a href={`/${locale}`} className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            {doc.browse} <span aria-hidden="true" className="ml-2">↗</span>
          </a>
        </header>
        <section aria-label={doc.season} className="border-b pb-7 md:pb-9">
          <p className="mb-4 text-xs text-muted-foreground">{doc.season}</p>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="text-4xl font-semibold tabular-nums tracking-tight md:text-5xl">{new Intl.NumberFormat(locale).format(SEASON_SNAPSHOT.sites)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{doc.sites}</p>
            </div>
            <div>
              <p className="text-4xl font-semibold tabular-nums tracking-tight md:text-5xl">{new Intl.NumberFormat(locale).format(SEASON_SNAPSHOT.races)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{doc.races}</p>
            </div>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            {doc.nextRaces.replace("{n}", new Intl.NumberFormat(locale).format(SEASON_SNAPSHOT.nextRaces))}
          </p>
        </section>
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          {doc.sections.map((s) => (
            <section key={s.h} className="flex flex-col gap-2">
              <h2 className="text-base font-semibold">{s.h}</h2>
              {s.p.map((p) => (
                <p key={p} className="text-sm leading-relaxed text-pretty text-muted-foreground">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
        <p className="border-t pt-5 text-xs text-muted-foreground">
          {doc.updated}: {UPDATED} · <a href={`mailto:${CONTACT}`} className="underline underline-offset-2">{CONTACT}</a> ·{" "}
          <a href={SITE_AUTHOR.url} className="underline underline-offset-2">{SITE_AUTHOR.url.replace(/^https?:\/\//, "")}</a>
        </p>
      </article>
    </main>
  );
}
