import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DOC_WIDTH, PageHeader } from "@/components/account/panel";
import { asLocale, locales, type Locale } from "@/lib/i18n/messages";
import { absoluteUrl, getSiteUrl, localeAlternates, SITE_AUTHOR, SITE_NAME } from "@/lib/seo";

const CONTACT = "contact@letsrace.cz";
const UPDATED = "2026-10-10";

type Doc = {
  title: string;
  intro: string;
  updated: string;
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
    intro: `${SITE_NAME} dává cyklistické závody ze střední Evropy na jedno místo – na mapu a do kalendáře.`,
    updated: "Poslední změna",
    sections: [
      {
        h: "Proč to vzniklo",
        p: [
          `${SITE_NAME} dělám já, ${SITE_AUTHOR.name}. Chyběl mi web, kde bych rychle viděl, jaký závod můžeme s dětmi jet o víkendu nebo když jsme někde na výletě – bez procházení několika webů. A taky závody kousek za hranicemi, o kterých jsme vůbec nevěděli.`,
        ],
      },
      {
        h: "Jak to funguje",
        p: [
          "Web prochází tisíce stránek – kalendáře svazů a weby pořadatelů a seriálů – a u každého závodu vytáhne to podstatné: termín, místo, disciplínu, kategorie a odkaz na přihlášky. Všechno je pak na jedné mapě a v jednom kalendáři, napříč zeměmi.",
        ],
      },
      {
        h: "Odkud jsou údaje",
        p: [
          "Každý závod odkazuje na svůj zdroj – web pořadatele, propozice nebo kalendář svazu. Katalog se obnovuje každý den a u závodu vidíš, kdy jsme ho naposledy ve zdroji našli.",
        ],
      },
      {
        h: "Když něco nesedí",
        p: [
          `Údaje přebíráme od pořadatelů a občas se spleteme. Před startem si termín a podmínky vždy ověř v propozicích. Chybu nebo závod, který tu chybí, nám napiš na ${CONTACT}.`,
        ],
      },
    ],
  },
  en: {
    title: "About",
    intro: `${SITE_NAME} puts the bike races of Central Europe in one place — on a map and in a calendar.`,
    updated: "Last updated",
    sections: [
      {
        h: "Why it exists",
        p: [
          `${SITE_NAME} is made by me, ${SITE_AUTHOR.name}. There was no site where I could quickly see which race we could ride with the kids at the weekend, or while away on a trip, without searching through several others — let alone races just across the border that we had never heard of.`,
        ],
      },
      {
        h: "How it works",
        p: [
          "The site reads thousands of pages — federation calendars and organisers' and series' own sites — and takes what matters from each race: the date, the place, the discipline, the categories and the entry link. Then it puts all of it on one map and in one calendar, across countries.",
        ],
      },
      {
        h: "Where the information comes from",
        p: [
          "Every race links to its source — the organiser's site, the regulations or a federation calendar. The catalogue is refreshed every day, and each race shows when we last found it at its source.",
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
    intro: `${SITE_NAME} zbiera wyścigi rowerowe z Europy Środkowej w jednym miejscu — na mapie i w kalendarzu.`,
    updated: "Ostatnia zmiana",
    sections: [
      {
        h: "Skąd ten pomysł",
        p: [
          `${SITE_NAME} tworzę ja, ${SITE_AUTHOR.name}. Brakowało mi strony, na której szybko zobaczę, jaki wyścig możemy pojechać z dziećmi w weekend albo na wyjeździe — bez przeszukiwania kilku serwisów. I wyścigów tuż za granicą, o których w ogóle nie wiedzieliśmy.`,
        ],
      },
      {
        h: "Jak to działa",
        p: [
          "Strona przegląda tysiące stron — kalendarze związków oraz strony organizatorów i cykli — i z każdego wyścigu wyciąga to, co ważne: termin, miejsce, dyscyplinę, kategorie i link do zapisów. Wszystko trafia na jedną mapę i do jednego kalendarza, ponad granicami.",
        ],
      },
      {
        h: "Skąd są dane",
        p: [
          "Każdy wyścig ma link do swojego źródła — strony organizatora, regulaminu lub kalendarza związku. Katalog odświeżamy codziennie, a przy wyścigu widać, kiedy ostatnio znaleźliśmy go w źródle.",
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
    intro: `${SITE_NAME} dáva cyklistické preteky zo strednej Európy na jedno miesto – na mapu a do kalendára.`,
    updated: "Posledná zmena",
    sections: [
      {
        h: "Prečo to vzniklo",
        p: [
          `${SITE_NAME} robím ja, ${SITE_AUTHOR.name}. Chýbal mi web, kde by som rýchlo videl, aké preteky môžeme s deťmi ísť cez víkend alebo keď sme niekde na výlete – bez prehľadávania niekoľkých webov. A aj preteky kúsok za hranicami, o ktorých sme vôbec nevedeli.`,
        ],
      },
      {
        h: "Ako to funguje",
        p: [
          "Web prechádza tisíce stránok – kalendáre zväzov a weby organizátorov a seriálov – a pri každých pretekoch vytiahne to podstatné: termín, miesto, disciplínu, kategórie a odkaz na prihlášky. Všetko je potom na jednej mape a v jednom kalendári, naprieč krajinami.",
        ],
      },
      {
        h: "Odkiaľ sú údaje",
        p: [
          "Každé preteky odkazujú na svoj zdroj – web organizátora, propozície alebo kalendár zväzu. Katalóg sa obnovuje každý deň a pri pretekoch vidíš, kedy sme ich naposledy našli v zdroji.",
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
    intro: `${SITE_NAME} bringt die Radrennen Mitteleuropas an einen Ort – auf eine Karte und in einen Kalender.`,
    updated: "Zuletzt geändert",
    sections: [
      {
        h: "Warum es das gibt",
        p: [
          `${SITE_NAME} mache ich, ${SITE_AUTHOR.name}. Mir fehlte eine Seite, auf der ich schnell sehe, welches Rennen wir am Wochenende oder im Urlaub mit den Kindern fahren können – ohne mehrere Websites zu durchsuchen. Und Rennen gleich hinter der Grenze, von denen wir gar nichts wussten.`,
        ],
      },
      {
        h: "Wie es funktioniert",
        p: [
          "Die Seite liest Tausende Seiten – Verbandskalender und die Websites von Veranstaltern und Serien – und nimmt aus jedem Rennen das Wesentliche: Termin, Ort, Disziplin, Klassen und den Link zur Anmeldung. Alles landet auf einer Karte und in einem Kalender, über Ländergrenzen hinweg.",
        ],
      },
      {
        h: "Woher die Angaben stammen",
        p: [
          "Jedes Rennen verlinkt auf seine Quelle – die Website des Veranstalters, die Ausschreibung oder einen Verbandskalender. Der Katalog wird täglich aktualisiert, und bei jedem Rennen steht, wann wir es zuletzt in der Quelle gefunden haben.",
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
        <PageHeader title={doc.title} description={doc.intro} />
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
        <p className="text-xs text-muted-foreground">
          {doc.updated}: {UPDATED} · <a href={`mailto:${CONTACT}`} className="underline underline-offset-2">{CONTACT}</a> ·{" "}
          <a href={SITE_AUTHOR.url} className="underline underline-offset-2">{SITE_AUTHOR.url.replace(/^https?:\/\//, "")}</a>
        </p>
      </article>
    </main>
  );
}
