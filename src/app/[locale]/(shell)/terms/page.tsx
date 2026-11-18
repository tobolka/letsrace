import type { Metadata } from "next";
import { LegalDoc, type LegalDocument } from "@/components/legal/legal-doc";
import { asLocale, type Locale } from "@/lib/i18n/messages";
import { LEGAL_CONTACT as CONTACT, OPERATOR } from "@/lib/legal";
import { SITE_NAME, absoluteUrl, localeAlternates } from "@/lib/seo";

const UPDATED = "2026-11-18";

/**
 * The rules of using the site: who runs it, what the race listings are and
 * are not, what people may post, and what happens when something goes wrong.
 * Plain words first; it still has to say what a court would look for.
 */
const DOCS: Record<Locale, LegalDocument> = {
  cs: {
    title: "Podmínky užití",
    intro: `Pravidla používání ${SITE_NAME}. Používáním webu s nimi souhlasíš.`,
    updated: "Platné od",
    sections: [
      {
        h: "Kdo web provozuje",
        p: [
          `${SITE_NAME} provozuje ${OPERATOR.name} (${OPERATOR.url}). Kontakt: ${CONTACT}.`,
        ],
      },
      {
        h: "Co Let's Race je",
        p: [
          "Bezplatný přehled cyklistických závodů z různých zdrojů na mapě a v kalendáři, s možností plánovat sezónu pro sebe nebo pro své jezdce.",
          "Nejsme pořadatelem žádného závodu. Nepřijímáme přihlášky ani startovné; přihlášení a platba probíhají vždy u pořadatele nebo na jeho registračním portálu a řídí se jeho podmínkami.",
        ],
      },
      {
        h: "Údaje o závodech",
        p: [
          "Údaje sbíráme z veřejných zdrojů: kalendářů svazů, webů pořadatelů a seriálů a z propozic. Pečlivě je kontrolujeme, ale mohou být neúplné, zastaralé nebo chybné a pořadatel je může kdykoli změnit nebo závod zrušit.",
          "Termín, místo, kategorie, startovné a další podmínky si proto před cestou vždy ověř u pořadatele. Rozhodující jsou jeho propozice. Doporučení kategorie podle roku narození je jen pomůcka.",
          "Názvy závodů, loga a texty patří jejich pořadatelům. Pokud jsi pořadatel a chceš údaje opravit nebo odstranit, přihlas se u závodu jako pořadatel nebo nám napiš.",
        ],
      },
      {
        h: "Účet",
        p: [
          "Některé funkce (plán, jezdci, upozornění) potřebují účet. Uváděj pravdivé údaje a přístup k účtu nikomu nedávej. Účet si můžeš kdykoli smazat v Nastavení.",
          "Účet můžeme omezit nebo zrušit, pokud je zneužíván nebo porušuje tyto podmínky.",
        ],
      },
      {
        h: "Co přidáš ty",
        p: [
          "Když nahlásíš závod, pošleš opravu nebo zpětnou vazbu, potvrzuješ, že údaje jsou podle tvého nejlepšího vědomí pravdivé a že je smíš sdílet. Dovoluješ nám je bezplatně použít, upravit a zveřejnit v rámci Let's Race. Nemusíme je zveřejnit a můžeme je kdykoli upravit nebo smazat.",
        ],
      },
      {
        h: "Co je zakázané",
        p: [
          "Zadávat nepravdivé nebo cizí údaje, vydávat se za pořadatele, kterým nejsi, rozesílat spam, útočit na web nebo obcházet jeho ochranu a hromadně stahovat obsah jinak než přes veřejné rozhraní a v rozsahu, který povoluje soubor robots.txt.",
        ],
      },
      {
        h: "Odkazy a mapové podklady",
        p: [
          "Odkazujeme na weby pořadatelů a další stránky, za jejichž obsah neodpovídáme. Mapové podklady jsou © OpenStreetMap contributors a CARTO, data o místech z GeoNames, počasí z Open-Meteo; platí pro ně jejich licence.",
        ],
      },
      {
        h: "Dostupnost a odpovědnost",
        p: [
          "Web poskytujeme zdarma a tak, jak je. Snažíme se, aby fungoval a byl přesný, ale nezaručujeme nepřetržitou dostupnost ani bezchybnost údajů.",
          "Neodpovídáme za škodu vzniklou tím, že ses spolehl na údaj o závodě, který se ukázal jako chybný nebo změněný (například zbytečná cesta nebo propadlé startovné), ani za obsah cizích webů. To neplatí pro škodu způsobenou úmyslně nebo z hrubé nedbalosti a pro práva, která ti jako spotřebiteli nelze smluvně vzít.",
        ],
      },
      {
        h: "Změny podmínek",
        p: [
          "Podmínky můžeme upravit, například když přidáme novou funkci. Novou verzi zveřejníme tady s datem platnosti a podstatné změny popíšeme v novinkách na stránce O projektu. Pokud s nimi nesouhlasíš, můžeš účet smazat.",
        ],
      },
      {
        h: "Rozhodné právo",
        p: [
          "Platí české právo. Jsi-li spotřebitel, zůstává ti ochrana, kterou ti dávají kogentní předpisy státu, kde žiješ. Spory se pokusíme vyřešit dohodou; spotřebitel se může obrátit i na Českou obchodní inspekci (adr.coi.cz), která řeší spotřebitelské spory mimosoudně.",
        ],
      },
    ],
  },
  en: {
    title: "Terms of use",
    intro: `The rules for using ${SITE_NAME}. By using the site you agree to them.`,
    updated: "Effective from",
    sections: [
      {
        h: "Who runs the site",
        p: [`${SITE_NAME} is run by ${OPERATOR.name} (${OPERATOR.url}). Contact: ${CONTACT}.`],
      },
      {
        h: "What Let's Race is",
        p: [
          "A free overview of bike races from many sources on a map and in a calendar, with a way to plan the season for yourself or your riders.",
          "We do not organise any race. We do not take entries or entry fees; signing up and paying always happen with the organiser or their registration portal, under their terms.",
        ],
      },
      {
        h: "Race information",
        p: [
          "We gather details from public sources: federation calendars, organiser and series websites, and race regulations. We check them carefully, but they may be incomplete, out of date or wrong, and organisers can change them or cancel a race at any time.",
          "Always confirm the date, place, categories, fees and other conditions with the organiser before you travel. Their regulations are what counts. The category suggested from a birth year is only a guide.",
          "Race names, logos and texts belong to their organisers. If you are an organiser and want details corrected or removed, claim the race as its organiser or write to us.",
        ],
      },
      {
        h: "Your account",
        p: [
          "Some features (plan, riders, alerts) need an account. Give true details and do not share access to your account. You can delete it at any time in Settings.",
          "We may restrict or close an account that is misused or breaks these terms.",
        ],
      },
      {
        h: "What you add",
        p: [
          "When you report a race, send a correction or feedback, you confirm that it is true to the best of your knowledge and that you may share it. You allow us to use, edit and publish it within Let's Race free of charge. We do not have to publish it and may edit or delete it at any time.",
        ],
      },
      {
        h: "What is not allowed",
        p: [
          "Entering false details or someone else's, posing as an organiser you are not, sending spam, attacking the site or getting around its protection, and bulk downloading content other than through the public interface and within what robots.txt allows.",
        ],
      },
      {
        h: "Links and maps",
        p: [
          "We link to organisers' websites and other pages whose content we are not responsible for. Map data is © OpenStreetMap contributors and CARTO, place data comes from GeoNames, weather from Open-Meteo; their licences apply.",
        ],
      },
      {
        h: "Availability and liability",
        p: [
          "The site is provided free of charge and as it is. We try to keep it running and accurate, but we do not guarantee uninterrupted availability or error-free information.",
          "We are not liable for loss caused by relying on race information that turned out wrong or changed (such as a wasted trip or a lost entry fee), or for the content of other websites. This does not apply to loss caused intentionally or by gross negligence, or to rights you have as a consumer that cannot be taken away by contract.",
        ],
      },
      {
        h: "Changes to these terms",
        p: [
          "We may update these terms, for example when we add a feature. The new version is published here with its effective date, and important changes are described under “What’s new” on the About page. If you do not agree with them, you can delete your account.",
        ],
      },
      {
        h: "Governing law",
        p: [
          "Czech law applies. If you are a consumer, you keep the protection given by the mandatory laws of the country where you live. We will try to settle any dispute by agreement; consumers can also turn to the Czech Trade Inspection Authority (adr.coi.cz) for out-of-court resolution.",
        ],
      },
    ],
  },
  pl: {
    title: "Warunki korzystania",
    intro: `Zasady korzystania z ${SITE_NAME}. Korzystając z serwisu, akceptujesz je.`,
    updated: "Obowiązuje od",
    sections: [
      {
        h: "Kto prowadzi serwis",
        p: [`${SITE_NAME} prowadzi ${OPERATOR.name} (${OPERATOR.url}). Kontakt: ${CONTACT}.`],
      },
      {
        h: "Czym jest Let's Race",
        p: [
          "Bezpłatnym przeglądem wyścigów rowerowych z wielu źródeł na mapie i w kalendarzu, z możliwością planowania sezonu dla siebie lub swoich zawodników.",
          "Nie jesteśmy organizatorem żadnego wyścigu. Nie przyjmujemy zapisów ani opłat startowych; zapisy i płatności odbywają się zawsze u organizatora lub w jego systemie zapisów, na jego warunkach.",
        ],
      },
      {
        h: "Informacje o wyścigach",
        p: [
          "Dane zbieramy z publicznych źródeł: kalendarzy związków, stron organizatorów i cykli oraz regulaminów. Starannie je sprawdzamy, ale mogą być niepełne, nieaktualne lub błędne, a organizator może je w każdej chwili zmienić lub odwołać wyścig.",
          "Przed wyjazdem zawsze potwierdź termin, miejsce, kategorie, opłaty i inne warunki u organizatora. Rozstrzyga jego regulamin. Kategoria wskazana na podstawie roku urodzenia jest tylko podpowiedzią.",
          "Nazwy wyścigów, logotypy i teksty należą do ich organizatorów. Jeśli jesteś organizatorem i chcesz poprawić lub usunąć dane, zgłoś się przy wyścigu jako organizator albo napisz do nas.",
        ],
      },
      {
        h: "Konto",
        p: [
          "Niektóre funkcje (plan, zawodnicy, powiadomienia) wymagają konta. Podawaj prawdziwe dane i nie udostępniaj konta innym. Możesz je w każdej chwili usunąć w Ustawieniach.",
          "Możemy ograniczyć lub zamknąć konto, które jest nadużywane lub narusza te warunki.",
        ],
      },
      {
        h: "Co dodajesz Ty",
        p: [
          "Zgłaszając wyścig, poprawkę lub opinię, potwierdzasz, że według Twojej najlepszej wiedzy są prawdziwe i że możesz je udostępnić. Pozwalasz nam bezpłatnie je wykorzystać, edytować i publikować w ramach Let's Race. Nie musimy ich publikować i możemy je w każdej chwili zmienić lub usunąć.",
        ],
      },
      {
        h: "Czego nie wolno",
        p: [
          "Podawać fałszywych lub cudzych danych, podszywać się pod organizatora, którym nie jesteś, wysyłać spamu, atakować serwisu lub obchodzić jego zabezpieczeń oraz masowo pobierać treści inaczej niż przez publiczny interfejs i w zakresie dozwolonym w pliku robots.txt.",
        ],
      },
      {
        h: "Linki i mapy",
        p: [
          "Odsyłamy do stron organizatorów i innych witryn, za których treść nie odpowiadamy. Dane mapy © autorzy OpenStreetMap i CARTO, dane o miejscach z GeoNames, pogoda z Open-Meteo; obowiązują ich licencje.",
        ],
      },
      {
        h: "Dostępność i odpowiedzialność",
        p: [
          "Serwis udostępniamy bezpłatnie i w takim stanie, w jakim jest. Staramy się, by działał i był dokładny, ale nie gwarantujemy nieprzerwanej dostępności ani bezbłędności danych.",
          "Nie odpowiadamy za szkodę wynikłą z polegania na informacji o wyścigu, która okazała się błędna lub zmieniona (np. niepotrzebna podróż lub utracona opłata startowa), ani za treść cudzych stron. Nie dotyczy to szkody wyrządzonej umyślnie lub przez rażące niedbalstwo ani praw konsumenta, których nie można wyłączyć umową.",
        ],
      },
      {
        h: "Zmiany warunków",
        p: [
          "Możemy zmienić warunki, np. przy dodaniu nowej funkcji. Nową wersję opublikujemy tutaj z datą obowiązywania, a istotne zmiany opiszemy w nowościach na stronie O projekcie. Jeśli się z nimi nie zgadzasz, możesz usunąć konto.",
        ],
      },
      {
        h: "Prawo właściwe",
        p: [
          "Obowiązuje prawo czeskie. Jeśli jesteś konsumentem, zachowujesz ochronę, jaką dają Ci bezwzględnie obowiązujące przepisy kraju, w którym mieszkasz. Spory postaramy się rozwiązać polubownie; konsument może też zwrócić się do czeskiej Inspekcji Handlowej (adr.coi.cz), która pozasądowo rozwiązuje spory konsumenckie.",
        ],
      },
    ],
  },
  sk: {
    title: "Podmienky používania",
    intro: `Pravidlá používania ${SITE_NAME}. Používaním webu s nimi súhlasíš.`,
    updated: "Platné od",
    sections: [
      {
        h: "Kto web prevádzkuje",
        p: [`${SITE_NAME} prevádzkuje ${OPERATOR.name} (${OPERATOR.url}). Kontakt: ${CONTACT}.`],
      },
      {
        h: "Čo je Let's Race",
        p: [
          "Bezplatný prehľad cyklistických pretekov z rôznych zdrojov na mape a v kalendári, s možnosťou plánovať sezónu pre seba alebo pre svojich jazdcov.",
          "Nie sme organizátorom žiadnych pretekov. Neprijímame prihlášky ani štartovné; prihlásenie a platba prebiehajú vždy u organizátora alebo na jeho registračnom portáli a riadia sa jeho podmienkami.",
        ],
      },
      {
        h: "Údaje o pretekoch",
        p: [
          "Údaje zbierame z verejných zdrojov: kalendárov zväzov, webov organizátorov a seriálov a z propozícií. Starostlivo ich kontrolujeme, ale môžu byť neúplné, zastarané alebo chybné a organizátor ich môže kedykoľvek zmeniť alebo preteky zrušiť.",
          "Termín, miesto, kategórie, štartovné a ďalšie podmienky si preto pred cestou vždy over u organizátora. Rozhodujúce sú jeho propozície. Odporúčanie kategórie podľa roku narodenia je len pomôcka.",
          "Názvy pretekov, logá a texty patria ich organizátorom. Ak si organizátor a chceš údaje opraviť alebo odstrániť, prihlás sa pri pretekoch ako organizátor alebo nám napíš.",
        ],
      },
      {
        h: "Účet",
        p: [
          "Niektoré funkcie (plán, jazdci, upozornenia) potrebujú účet. Uvádzaj pravdivé údaje a prístup k účtu nikomu nedávaj. Účet si môžeš kedykoľvek zmazať v Nastaveniach.",
          "Účet môžeme obmedziť alebo zrušiť, ak je zneužívaný alebo porušuje tieto podmienky.",
        ],
      },
      {
        h: "Čo pridáš ty",
        p: [
          "Keď nahlásiš preteky, pošleš opravu alebo spätnú väzbu, potvrdzuješ, že údaje sú podľa tvojho najlepšieho vedomia pravdivé a že ich smieš zdieľať. Dovoľuješ nám ich bezplatne použiť, upraviť a zverejniť v rámci Let's Race. Nemusíme ich zverejniť a môžeme ich kedykoľvek upraviť alebo zmazať.",
        ],
      },
      {
        h: "Čo je zakázané",
        p: [
          "Zadávať nepravdivé alebo cudzie údaje, vydávať sa za organizátora, ktorým nie si, rozosielať spam, útočiť na web alebo obchádzať jeho ochranu a hromadne sťahovať obsah inak než cez verejné rozhranie a v rozsahu, ktorý povoľuje súbor robots.txt.",
        ],
      },
      {
        h: "Odkazy a mapové podklady",
        p: [
          "Odkazujeme na weby organizátorov a ďalšie stránky, za ktorých obsah nezodpovedáme. Mapové podklady sú © prispievatelia OpenStreetMap a CARTO, údaje o miestach z GeoNames, počasie z Open-Meteo; platia pre ne ich licencie.",
        ],
      },
      {
        h: "Dostupnosť a zodpovednosť",
        p: [
          "Web poskytujeme zadarmo a tak, ako je. Snažíme sa, aby fungoval a bol presný, ale nezaručujeme nepretržitú dostupnosť ani bezchybnosť údajov.",
          "Nezodpovedáme za škodu vzniknutú tým, že si sa spoľahol na údaj o pretekoch, ktorý sa ukázal ako chybný alebo zmenený (napríklad zbytočná cesta alebo prepadnuté štartovné), ani za obsah cudzích webov. Neplatí to pre škodu spôsobenú úmyselne alebo z hrubej nedbanlivosti a pre práva, ktoré ti ako spotrebiteľovi nemožno zmluvne vziať.",
        ],
      },
      {
        h: "Zmeny podmienok",
        p: [
          "Podmienky môžeme upraviť, napríklad keď pridáme novú funkciu. Novú verziu zverejníme tu s dátumom platnosti a podstatné zmeny popíšeme v novinkách na stránke O projekte. Ak s nimi nesúhlasíš, môžeš účet zmazať.",
        ],
      },
      {
        h: "Rozhodné právo",
        p: [
          "Platí české právo. Ak si spotrebiteľ, zostáva ti ochrana, ktorú ti dávajú kogentné predpisy štátu, kde žiješ. Spory sa pokúsime vyriešiť dohodou; spotrebiteľ sa môže obrátiť aj na Českú obchodnú inšpekciu (adr.coi.cz), ktorá rieši spotrebiteľské spory mimosúdne.",
        ],
      },
    ],
  },
  de: {
    title: "Nutzungsbedingungen",
    intro: `Die Regeln für die Nutzung von ${SITE_NAME}. Mit der Nutzung der Seite stimmst du ihnen zu.`,
    updated: "Gültig ab",
    sections: [
      {
        h: "Wer die Seite betreibt",
        p: [`${SITE_NAME} wird von ${OPERATOR.name} betrieben (${OPERATOR.url}). Kontakt: ${CONTACT}.`],
      },
      {
        h: "Was Let's Race ist",
        p: [
          "Eine kostenlose Übersicht über Radrennen aus vielen Quellen auf einer Karte und in einem Kalender, mit der du die Saison für dich oder deine Fahrer planen kannst.",
          "Wir veranstalten keine Rennen. Wir nehmen keine Anmeldungen und kein Startgeld entgegen; Anmeldung und Bezahlung laufen immer beim Veranstalter oder über sein Anmeldeportal und nach dessen Bedingungen.",
        ],
      },
      {
        h: "Angaben zu Rennen",
        p: [
          "Wir sammeln Angaben aus öffentlichen Quellen: Verbandskalendern, Websites von Veranstaltern und Serien sowie Ausschreibungen. Wir prüfen sie sorgfältig, aber sie können unvollständig, veraltet oder falsch sein, und Veranstalter können sie jederzeit ändern oder ein Rennen absagen.",
          "Prüfe Datum, Ort, Klassen, Startgeld und weitere Bedingungen deshalb vor der Anreise immer beim Veranstalter. Maßgeblich ist seine Ausschreibung. Die aus dem Geburtsjahr vorgeschlagene Klasse ist nur eine Hilfe.",
          "Namen, Logos und Texte der Rennen gehören ihren Veranstaltern. Wenn du Veranstalter bist und Angaben korrigieren oder entfernen lassen willst, melde dich beim Rennen als Veranstalter oder schreib uns.",
        ],
      },
      {
        h: "Dein Konto",
        p: [
          "Einige Funktionen (Plan, Fahrer, Hinweise) brauchen ein Konto. Mach wahre Angaben und gib den Zugang zu deinem Konto nicht weiter. Du kannst es jederzeit in den Einstellungen löschen.",
          "Wir können ein Konto einschränken oder schließen, das missbraucht wird oder gegen diese Bedingungen verstößt.",
        ],
      },
      {
        h: "Was du beiträgst",
        p: [
          "Wenn du ein Rennen meldest, eine Korrektur oder Feedback schickst, bestätigst du, dass die Angaben nach bestem Wissen stimmen und du sie teilen darfst. Du erlaubst uns, sie kostenlos innerhalb von Let's Race zu nutzen, zu bearbeiten und zu veröffentlichen. Wir müssen sie nicht veröffentlichen und können sie jederzeit ändern oder löschen.",
        ],
      },
      {
        h: "Was nicht erlaubt ist",
        p: [
          "Falsche oder fremde Angaben machen, dich als Veranstalter ausgeben, der du nicht bist, Spam verschicken, die Seite angreifen oder ihren Schutz umgehen und Inhalte massenhaft herunterladen, außer über die öffentliche Schnittstelle und im Rahmen dessen, was robots.txt erlaubt.",
        ],
      },
      {
        h: "Links und Karten",
        p: [
          "Wir verlinken auf Websites von Veranstaltern und andere Seiten, für deren Inhalt wir nicht verantwortlich sind. Kartendaten © OpenStreetMap-Mitwirkende und CARTO, Ortsdaten von GeoNames, Wetter von Open-Meteo; es gelten deren Lizenzen.",
        ],
      },
      {
        h: "Verfügbarkeit und Haftung",
        p: [
          "Die Seite wird kostenlos und so, wie sie ist, bereitgestellt. Wir bemühen uns, dass sie läuft und stimmt, garantieren aber weder ständige Verfügbarkeit noch fehlerfreie Angaben.",
          "Wir haften nicht für Schäden, die entstehen, weil du dich auf eine Rennangabe verlassen hast, die sich als falsch oder geändert herausstellt (etwa eine umsonst gemachte Anreise oder ein verlorenes Startgeld), und nicht für Inhalte fremder Websites. Das gilt nicht für vorsätzlich oder grob fahrlässig verursachte Schäden und nicht für Verbraucherrechte, die vertraglich nicht ausgeschlossen werden können.",
        ],
      },
      {
        h: "Änderungen dieser Bedingungen",
        p: [
          "Wir können die Bedingungen anpassen, etwa wenn eine neue Funktion dazukommt. Die neue Fassung veröffentlichen wir hier mit ihrem Gültigkeitsdatum, wesentliche Änderungen beschreiben wir unter den Neuigkeiten auf der Seite „Über das Projekt“. Bist du nicht einverstanden, kannst du dein Konto löschen.",
        ],
      },
      {
        h: "Anwendbares Recht",
        p: [
          "Es gilt tschechisches Recht. Als Verbraucher behältst du den Schutz der zwingenden Vorschriften des Landes, in dem du lebst. Streitigkeiten versuchen wir einvernehmlich zu lösen; Verbraucher können sich auch an die tschechische Handelsinspektion (adr.coi.cz) zur außergerichtlichen Streitbeilegung wenden.",
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
  const locale = asLocale((await params).locale);
  const doc = DOCS[locale];
  return {
    title: { absolute: `${doc.title} · ${SITE_NAME}` },
    description: doc.intro,
    alternates: { canonical: absoluteUrl(`/${locale}/terms`), languages: localeAlternates("terms") },
  };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = asLocale((await params).locale);
  return <LegalDoc doc={DOCS[locale]} locale={locale} page="terms" updatedOn={UPDATED} />;
}
