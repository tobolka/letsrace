import type { Metadata } from "next";
import { DOC_WIDTH, PageHeader } from "@/components/account/panel";
import { asLocale, type Locale } from "@/lib/i18n/messages";
import { SITE_NAME, absoluteUrl } from "@/lib/seo";

const CONTACT = "info@letsrace.cz";
const UPDATED = "2026-09-30";

type Doc = {
  title: string;
  intro: string;
  updated: string;
  sections: { h: string; p: string[] }[];
};

/**
 * What we keep about people and why. Google shows the app's name on its
 * sign-in screen only once the brand is verified, and verification asks for
 * this page.
 */
const DOCS: Record<Locale, Doc> = {
  cs: {
    title: "Ochrana soukromí",
    intro: `${SITE_NAME} je kalendář cyklistických závodů. Tady je, jaké údaje o tobě máme, k čemu je používáme a jak se jich zbavit.`,
    updated: "Poslední změna",
    sections: [
      {
        h: "Co ukládáme",
        p: [
          "Účet: e-mail, jméno a u přihlášení přes Google i profilový obrázek, který Google předá. Heslo ukládáme jen jako hash.",
          "Co si v aplikaci sám vyplníš: jezdce (jméno, rok narození, oblíbené disciplíny), plán závodů, oblíbené závody, blokované dny, upozornění na závody v okolí (místo a okruh), nahlášené závody a zpětnou vazbu.",
          "Záznam o odeslaných e-mailech, abychom stejnou zprávu neposlali dvakrát.",
        ],
      },
      {
        h: "K čemu to používáme",
        p: [
          "Jen k tomu, aby aplikace fungovala: ukázat tvůj plán, doporučit závody pro tvé jezdce a poslat e-maily, které sis zapnul (upozornění na nové závody, změny v plánu, týdenní přehled). Údaje neprodáváme a nepoužíváme k reklamě.",
          "Právním základem je plnění služby, o kterou sis řekl (čl. 6 odst. 1 písm. b GDPR).",
        ],
      },
      {
        h: "Poloha",
        p: [
          "Filtr vzdálenosti se na polohu ptá prohlížeče a používá ji jen v tvém zařízení. Na server ji neposíláme. U upozornění ukládáme jen místo, které sám zvolíš.",
        ],
      },
      {
        h: "Cookies a úložiště prohlížeče",
        p: [
          "Používáme jen nezbytné cookies pro přihlášení. V úložišti prohlížeče si pamatujeme nastavení, jako jsou filtry a sloupce tabulky. Návštěvnost a vybrané interakce měříme vlastní instalací Umami na Vercelu s databází Neon v EU, bez analytických cookies a bez propojování návštěv mezi weby. Odesíláme veřejné cesty stránek, zdroj návštěvy, označení kampaně a základní informace o zařízení. Neodesíláme obsah vyhledávání, údaje účtu ani formulářů. Respektujeme signály Do Not Track a Global Privacy Control.",
        ],
      },
      {
        h: "Kdo s daty pracuje za nás",
        p: [
          "Supabase (databáze a přihlášení, servery v EU – Frankfurt), Vercel (provoz webu), Resend (odesílání e-mailů) a Google (jen pokud se přihlásíš přes Google).",
        ],
      },
      {
        h: "Jak dlouho",
        p: [
          "Dokud máš účet. Po zrušení účtu údaje smažeme do 30 dnů, kromě toho, co musíme uchovat ze zákona.",
        ],
      },
      {
        h: "Tvoje práva",
        p: [
          `Můžeš chtít přístup ke svým údajům, jejich opravu, smazání, přenos nebo vznést námitku. Stačí napsat na ${CONTACT}. Každý e-mail od nás má odkaz na odhlášení jedním klikem. Stížnost můžeš podat u Úřadu pro ochranu osobních údajů (uoou.cz).`,
        ],
      },
    ],
  },
  en: {
    title: "Privacy",
    intro: `${SITE_NAME} is a calendar of bike races. This is what we keep about you, why, and how to get rid of it.`,
    updated: "Last updated",
    sections: [
      {
        h: "What we store",
        p: [
          "Your account: email, name and, if you sign in with Google, the profile picture Google shares. Passwords are stored only as a hash.",
          "What you add in the app: riders (name, birth year, favourite disciplines), your race plan, favourites, blocked days, alerts for races nearby (a place and a radius), races you report and feedback.",
          "A log of the emails we sent, so the same message never goes out twice.",
        ],
      },
      {
        h: "What we use it for",
        p: [
          "Only to make the app work: show your plan, suggest races for your riders and send the emails you switched on (new races nearby, changes to your plan, the weekly digest). We do not sell your data or use it for advertising.",
          "The legal basis is providing the service you asked for (Art. 6(1)(b) GDPR).",
        ],
      },
      {
        h: "Location",
        p: [
          "The distance filter asks your browser for your location and uses it only on your device. It is never sent to our server. For alerts we store only the place you choose.",
        ],
      },
      {
        h: "Cookies and browser storage",
        p: [
          "We use only the cookies needed to keep you signed in. Browser storage remembers settings such as filters and table columns. Visits and selected interactions are measured with our own Umami installation on Vercel and a Neon database in the EU, without analytics cookies or linking visitors across websites. We send public page paths, referral sources, campaign labels and basic device information. Search text, account details and form contents are excluded. We respect Do Not Track and Global Privacy Control.",
        ],
      },
      {
        h: "Who processes data for us",
        p: [
          "Supabase (database and sign-in, servers in the EU – Frankfurt), Vercel (hosting), Resend (sending email) and Google (only if you sign in with Google).",
        ],
      },
      {
        h: "How long",
        p: [
          "For as long as you have an account. When you close it we delete your data within 30 days, except what the law requires us to keep.",
        ],
      },
      {
        h: "Your rights",
        p: [
          `You can ask to access, correct, delete or export your data, or object to how we use it — write to ${CONTACT}. Every email from us has a one-click unsubscribe link. You can also complain to your data protection authority.`,
        ],
      },
    ],
  },
  pl: {
    title: "Prywatność",
    intro: `${SITE_NAME} to kalendarz wyścigów rowerowych. Oto jakie dane o Tobie przechowujemy, do czego ich używamy i jak je usunąć.`,
    updated: "Ostatnia zmiana",
    sections: [
      {
        h: "Co przechowujemy",
        p: [
          "Konto: e-mail, imię, a przy logowaniu przez Google także zdjęcie profilowe przekazane przez Google. Hasła przechowujemy wyłącznie jako hash.",
          "To, co sam dodasz w aplikacji: zawodników (imię, rok urodzenia, ulubione dyscypliny), plan wyścigów, ulubione, zablokowane dni, powiadomienia o wyścigach w okolicy (miejsce i promień), zgłoszone wyścigi i opinie.",
          "Zapis wysłanych e-maili, aby ta sama wiadomość nie poszła dwa razy.",
        ],
      },
      {
        h: "Do czego ich używamy",
        p: [
          "Wyłącznie do działania aplikacji: pokazania planu, polecania wyścigów dla Twoich zawodników i wysyłania e-maili, które włączyłeś. Nie sprzedajemy danych i nie używamy ich do reklam.",
          "Podstawą prawną jest świadczenie usługi, o którą prosisz (art. 6 ust. 1 lit. b RODO).",
        ],
      },
      {
        h: "Lokalizacja",
        p: [
          "Filtr odległości pyta przeglądarkę o lokalizację i używa jej tylko na Twoim urządzeniu. Nie wysyłamy jej na serwer. Przy powiadomieniach zapisujemy tylko wybrane przez Ciebie miejsce.",
        ],
      },
      {
        h: "Cookies i pamięć przeglądarki",
        p: [
          "Używamy tylko niezbędnych cookies do logowania. Pamięć przeglądarki zapamiętuje ustawienia, np. filtry i kolumny tabeli. Ruch i wybrane interakcje mierzymy we własnej instalacji Umami na Vercel, z bazą Neon w UE, bez analitycznych cookies i łączenia odwiedzin między witrynami. Przesyłamy publiczne ścieżki stron, źródła wizyt, oznaczenia kampanii i podstawowe informacje o urządzeniu. Wykluczamy treść wyszukiwania, dane konta i formularzy. Respektujemy Do Not Track i Global Privacy Control.",
        ],
      },
      {
        h: "Kto przetwarza dane w naszym imieniu",
        p: [
          "Supabase (baza danych i logowanie, serwery w UE – Frankfurt), Vercel (hosting), Resend (wysyłka e-maili) i Google (tylko przy logowaniu przez Google).",
        ],
      },
      {
        h: "Jak długo",
        p: [
          "Dopóki masz konto. Po jego usunięciu kasujemy dane w ciągu 30 dni, z wyjątkiem tego, co musimy przechowywać zgodnie z prawem.",
        ],
      },
      {
        h: "Twoje prawa",
        p: [
          `Możesz żądać dostępu do danych, ich poprawienia, usunięcia, przeniesienia lub wnieść sprzeciw — napisz na ${CONTACT}. Każdy e-mail od nas ma link do wypisania jednym kliknięciem. Możesz też złożyć skargę do PUODO.`,
        ],
      },
    ],
  },
  sk: {
    title: "Ochrana súkromia",
    intro: `${SITE_NAME} je kalendár cyklistických pretekov. Tu je, aké údaje o tebe máme, na čo ich používame a ako sa ich zbaviť.`,
    updated: "Posledná zmena",
    sections: [
      {
        h: "Čo ukladáme",
        p: [
          "Účet: e-mail, meno a pri prihlásení cez Google aj profilový obrázok, ktorý Google odovzdá. Heslo ukladáme len ako hash.",
          "Čo si v aplikácii sám vyplníš: jazdcov (meno, rok narodenia, obľúbené disciplíny), plán pretekov, obľúbené preteky, blokované dni, upozornenia na preteky v okolí (miesto a okruh), nahlásené preteky a spätnú väzbu.",
          "Záznam o odoslaných e-mailoch, aby sme rovnakú správu neposlali dvakrát.",
        ],
      },
      {
        h: "Na čo to používame",
        p: [
          "Len na to, aby aplikácia fungovala: ukázať tvoj plán, odporučiť preteky pre tvojich jazdcov a posielať e-maily, ktoré si si zapol. Údaje nepredávame a nepoužívame na reklamu.",
          "Právnym základom je plnenie služby, o ktorú si požiadal (čl. 6 ods. 1 písm. b GDPR).",
        ],
      },
      {
        h: "Poloha",
        p: [
          "Filter vzdialenosti sa na polohu pýta prehliadača a používa ju len v tvojom zariadení. Na server ju neposielame. Pri upozorneniach ukladáme len miesto, ktoré si sám zvolíš.",
        ],
      },
      {
        h: "Cookies a úložisko prehliadača",
        p: [
          "Používame len nevyhnutné cookies na prihlásenie. V úložisku prehliadača si pamätáme nastavenia, napríklad filtre a stĺpce tabuľky. Návštevnosť a vybrané interakcie meriame vlastnou inštaláciou Umami na Verceli s databázou Neon v EÚ, bez analytických cookies a prepájania návštev medzi webmi. Posielame verejné cesty stránok, zdroj návštevy, označenia kampaní a základné informácie o zariadení. Neposielame obsah vyhľadávania, údaje účtu ani formulárov. Rešpektujeme Do Not Track a Global Privacy Control.",
        ],
      },
      {
        h: "Kto s údajmi pracuje za nás",
        p: [
          "Supabase (databáza a prihlásenie, servery v EÚ – Frankfurt), Vercel (prevádzka webu), Resend (odosielanie e-mailov) a Google (len ak sa prihlásiš cez Google).",
        ],
      },
      {
        h: "Ako dlho",
        p: [
          "Kým máš účet. Po zrušení účtu údaje zmažeme do 30 dní, okrem toho, čo musíme uchovať zo zákona.",
        ],
      },
      {
        h: "Tvoje práva",
        p: [
          `Môžeš žiadať prístup k údajom, ich opravu, vymazanie, prenos alebo namietať — napíš na ${CONTACT}. Každý e-mail od nás má odkaz na odhlásenie jedným klikom. Sťažnosť môžeš podať na Úrad na ochranu osobných údajov SR.`,
        ],
      },
    ],
  },
  de: {
    title: "Datenschutz",
    intro: `${SITE_NAME} ist ein Kalender für Radrennen. Hier steht, was wir über dich speichern, wozu und wie du es wieder loswirst.`,
    updated: "Zuletzt geändert",
    sections: [
      {
        h: "Was wir speichern",
        p: [
          "Dein Konto: E-Mail, Name und, wenn du dich mit Google anmeldest, das Profilbild, das Google teilt. Passwörter speichern wir nur als Hash.",
          "Was du in der App anlegst: Fahrer (Name, Geburtsjahr, bevorzugte Disziplinen), deinen Rennplan, Favoriten, belegte Tage, Hinweise auf Rennen in der Nähe (ein Ort und ein Umkreis), gemeldete Rennen und Feedback.",
          "Ein Protokoll der gesendeten E-Mails, damit dieselbe Nachricht nie zweimal rausgeht.",
        ],
      },
      {
        h: "Wozu wir es nutzen",
        p: [
          "Nur damit die App funktioniert: deinen Plan zeigen, Rennen für deine Fahrer vorschlagen und die E-Mails schicken, die du eingeschaltet hast (neue Rennen in der Nähe, Änderungen in deinem Plan, die Wochenübersicht). Wir verkaufen deine Daten nicht und nutzen sie nicht für Werbung.",
          "Rechtsgrundlage ist die Erbringung des Dienstes, den du angefordert hast (Art. 6 Abs. 1 lit. b DSGVO).",
        ],
      },
      {
        h: "Standort",
        p: [
          "Der Entfernungsfilter fragt deinen Browser nach dem Standort und nutzt ihn nur auf deinem Gerät. Er wird nie an unseren Server geschickt. Für Hinweise speichern wir nur den Ort, den du wählst.",
        ],
      },
      {
        h: "Cookies und Browserspeicher",
        p: [
          "Wir nutzen nur die Cookies, die nötig sind, damit du angemeldet bleibst. Der Browserspeicher merkt sich Einstellungen wie Filter und Tabellenspalten. Besuche und ausgewählte Interaktionen messen wir mit einer eigenen Umami-Installation auf Vercel und einer Neon-Datenbank in der EU, ohne Analyse-Cookies oder websiteübergreifende Verknüpfung. Erfasst werden öffentliche Seitenpfade, Verweisquellen, Kampagnenkennzeichnungen und grundlegende Geräteinformationen. Suchtexte, Kontodaten und Formularinhalte sind ausgeschlossen. Do Not Track und Global Privacy Control werden respektiert.",
        ],
      },
      {
        h: "Wer Daten für uns verarbeitet",
        p: [
          "Supabase (Datenbank und Anmeldung, Server in der EU – Frankfurt), Vercel (Hosting), Resend (E-Mail-Versand) und Google (nur wenn du dich mit Google anmeldest).",
        ],
      },
      {
        h: "Wie lange",
        p: [
          "Solange du ein Konto hast. Wenn du es schließt, löschen wir deine Daten innerhalb von 30 Tagen, außer was wir gesetzlich aufbewahren müssen.",
        ],
      },
      {
        h: "Deine Rechte",
        p: [
          `Du kannst Auskunft, Berichtigung, Löschung oder Export deiner Daten verlangen oder der Nutzung widersprechen — schreib an ${CONTACT}. Jede E-Mail von uns hat einen Abmeldelink mit einem Klick. Du kannst dich auch bei deiner Datenschutzbehörde beschweren.`,
        ],
      },
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const doc = DOCS[asLocale(locale)];
  return {
    title: { absolute: `${doc.title} · ${SITE_NAME}` },
    description: doc.intro,
    alternates: { canonical: absoluteUrl(`/${asLocale(locale)}/privacy`) },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const doc = DOCS[asLocale(locale)];
  return (
    <main className="p-4 md:p-8">
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
          {doc.updated}: {UPDATED} · {CONTACT}
        </p>
      </article>
    </main>
  );
}
