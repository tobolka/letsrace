import type { Metadata } from "next";
import { LegalDoc, type LegalDocument } from "@/components/legal/legal-doc";
import { asLocale, type Locale } from "@/lib/i18n/messages";
import { LEGAL_CONTACT as CONTACT, OPERATOR } from "@/lib/legal";
import { SITE_NAME, absoluteUrl, localeAlternates } from "@/lib/seo";

const UPDATED = "2026-11-18";

/**
 * What we keep about people and why — the information GDPR Articles 13 and 14
 * ask for, in plain words. Google shows the app's name on its sign-in screen
 * only once the brand is verified, and verification asks for this page.
 *
 * Keep it true to the code: when a new service sees visitors' data, or the
 * app starts keeping something new, this page changes in the same commit.
 */
const DOCS: Record<Locale, LegalDocument> = {
  cs: {
    title: "Ochrana soukromí",
    intro: `${SITE_NAME} je kalendář cyklistických závodů. Tady je, kdo za tvé údaje odpovídá, jaké údaje máme, k čemu je používáme a jak se jich zbavit.`,
    updated: "Poslední změna",
    sections: [
      {
        h: "Kdo za údaje odpovídá",
        p: [
          `Správcem osobních údajů je ${OPERATOR.name}, provozovatel ${SITE_NAME} (${OPERATOR.url}). Ve všem, co se týká tvých údajů, nám piš na ${CONTACT}.`,
        ],
      },
      {
        h: "Co ukládáme",
        p: [
          "Účet: e-mail, jméno a u přihlášení přes Google i profilový obrázek, který Google předá. Heslo ukládáme jen jako hash.",
          "Co si v aplikaci sám vyplníš: jezdce (jméno nebo přezdívku, rok narození, pohlaví, oblíbené disciplíny), plán závodů, oblíbené závody, obsazené dny, upozornění na závody v okolí (místo a okruh), nahlášené závody, opravy a zpětnou vazbu. Ke zpětné vazbě můžeš připojit e-mail, abychom ti mohli odpovědět.",
          "Pokud se přihlásíš jako pořadatel závodu, uložíme tvůj e-mail a o který závod nebo seriál jde, abychom mohli žádost ověřit.",
          "Záznam o odeslaných e-mailech, abychom stejnou zprávu neposlali dvakrát.",
        ],
      },
      {
        h: "K čemu to používáme a proč smíme",
        p: [
          "Aby aplikace fungovala: ukázat tvůj plán, doporučit závody pro tvé jezdce, ověřit pořadatele a poslat e-maily, které sis zapnul (upozornění na nové závody, změny v plánu, týdenní přehled). Právním základem je plnění služby, o kterou sis řekl (čl. 6 odst. 1 písm. b GDPR).",
          "Abychom web chránili před zneužitím a věděli, co se na něm používá: IP adresa slouží krátkodobě k omezení počtu požadavků a hosting ji zapisuje do provozních záznamů; návštěvnost měříme bez cookies (viz níže). Tady je základem náš oprávněný zájem (čl. 6 odst. 1 písm. f GDPR) a můžeš proti tomu vznést námitku.",
          "Údaje neprodáváme, nepoužíváme k reklamě a nevytváříme z nich profily.",
        ],
      },
      {
        h: "Poloha",
        p: [
          "Filtr vzdálenosti se na polohu ptá prohlížeče až s tvým svolením a používá ji jen v tvém zařízení. Na server ji neposíláme. U upozornění ukládáme jen místo, které sám zvolíš.",
        ],
      },
      {
        id: "cookies",
        h: "Cookies a úložiště prohlížeče",
        p: [
          "Používáme jen nezbytné cookies, které tě drží přihlášeného. Proto se tě na cookies neptáme. V úložišti prohlížeče si pamatujeme nastavení, jako jsou filtry, sloupce tabulky nebo zavřená upozornění.",
          "Návštěvnost a vybrané interakce měříme vlastní instalací Umami na Vercelu s databází Neon v EU, bez analytických cookies a bez propojování návštěv mezi weby. Odesíláme veřejné cesty stránek, zdroj návštěvy, označení kampaně a základní informace o zařízení. Měříme také obecné názvy navštívených sekcí, počty výsledků, použité katalogové filtry a potvrzené uložení závodu. Neodesíláme soukromé adresy stránek, obsah vyhledávání, údaje účtu ani formulářů. Rychlost načítání stránek měří anonymně Vercel Speed Insights, také bez cookies. Respektujeme signály Do Not Track a Global Privacy Control.",
        ],
      },
      {
        h: "Kdo s daty pracuje za nás",
        p: [
          "Supabase (databáze a přihlášení, servery v EU – Frankfurt), Vercel (provoz webu a měření rychlosti), Neon (databáze statistik návštěvnosti, EU), Resend (odesílání e-mailů) a Google (jen pokud se přihlásíš přes Google).",
          "Mapové podklady načítá tvůj prohlížeč přímo od CARTO, které tak vidí tvou IP adresu a která část mapy se zobrazuje. Počasí a vyhledávání míst (Open-Meteo, OpenStreetMap) volá náš server, ne tvůj prohlížeč, a nepředává jim nic o tobě.",
          "Někteří z nich sídlí v USA. Předání údajů tam je kryté rámcem EU–USA pro ochranu osobních údajů nebo standardními smluvními doložkami Evropské komise.",
        ],
      },
      {
        h: "Pořadatelé a údaje v kalendáři",
        p: [
          "U závodů zobrazujeme údaje, které pořadatelé sami zveřejnili v propozicích nebo na svém webu, například název pořádajícího klubu, jméno ředitele závodu, telefon nebo kontaktní e-mail. Děláme to v oprávněném zájmu, aby se jezdci dozvěděli, na koho se obrátit. Pokud tam je tvé jméno nebo kontakt a nechceš to, napiš nám a odstraníme ho.",
        ],
      },
      {
        h: "Děti",
        p: [
          "Účet zakládá dospělý, nebo mladší uživatel se souhlasem rodiče. Údaje o dětských jezdcích vyplňuje rodič nebo trenér; stačí křestní jméno nebo přezdívka a rok narození.",
        ],
      },
      {
        h: "Jak dlouho",
        p: [
          "Dokud máš účet. Účet si můžeš kdykoli smazat v Nastavení: jezdci, plán, oblíbené, upozornění a záznamy e-mailů zmizí hned. Závody, které jsi nahlásil, a zpětná vazba zůstanou, ale bez tvého jména a e-mailu. Ze záloh databáze údaje zmizí nejpozději do 30 dnů. Zpětnou vazbu bez účtu uchováváme, dokud ji potřebujeme k vyřízení a ke zlepšení webu; smazání si můžeš kdykoli vyžádat.",
        ],
      },
      {
        h: "Tvoje práva",
        p: [
          `Můžeš chtít přístup ke svým údajům, jejich opravu, smazání, omezení zpracování, přenos nebo vznést námitku. Stačí napsat na ${CONTACT}, odpovíme do měsíce. Každý e-mail od nás má odkaz na odhlášení jedním klikem. Stížnost můžeš podat u Úřadu pro ochranu osobních údajů (uoou.gov.cz) nebo u dozorového úřadu ve své zemi.`,
        ],
      },
      {
        h: "Změny",
        p: [
          "Když tady něco podstatného změníme, uvedeme nové datum dole na stránce a změnu popíšeme v novinkách na stránce O projektu.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy",
    intro: `${SITE_NAME} is a calendar of bike races. This is who is responsible for your data, what we keep, why, and how to get rid of it.`,
    updated: "Last updated",
    sections: [
      {
        h: "Who is responsible",
        p: [
          `The data controller is ${OPERATOR.name}, who runs ${SITE_NAME} (${OPERATOR.url}). For anything about your data, write to ${CONTACT}.`,
        ],
      },
      {
        h: "What we store",
        p: [
          "Your account: email, name and, if you sign in with Google, the profile picture Google shares. Passwords are stored only as a hash.",
          "What you add in the app: riders (name or nickname, birth year, sex, favourite disciplines), your race plan, favourites, busy days, alerts for races nearby (a place and a radius), races you report, corrections and feedback. You can add an email to feedback so we can reply.",
          "If you sign in as a race organiser, we store your email and which race or series it is about, so we can verify the request.",
          "A log of the emails we sent, so the same message never goes out twice.",
        ],
      },
      {
        h: "What we use it for, and why we may",
        p: [
          "To make the app work: show your plan, suggest races for your riders, verify organisers and send the emails you switched on (new races nearby, changes to your plan, the weekly digest). The legal basis is providing the service you asked for (Art. 6(1)(b) GDPR).",
          "To protect the site from abuse and know what is used: your IP address is used briefly to limit the number of requests, and our host writes it to its operating logs; visits are measured without cookies (see below). The legal basis is our legitimate interest (Art. 6(1)(f) GDPR), and you can object to it.",
          "We do not sell your data, use it for advertising or build profiles from it.",
        ],
      },
      {
        h: "Location",
        p: [
          "The distance filter asks your browser for your location only with your permission and uses it only on your device. It is never sent to our server. For alerts we store only the place you choose.",
        ],
      },
      {
        id: "cookies",
        h: "Cookies and browser storage",
        p: [
          "We use only the cookies needed to keep you signed in, which is why we do not ask you about cookies. Browser storage remembers settings such as filters, table columns or notices you closed.",
          "Visits and selected interactions are measured with our own Umami installation on Vercel and a Neon database in the EU, without analytics cookies or linking visitors across websites. We send public page paths, referral sources, campaign labels and basic device information. We also measure generic section names, result counts, catalogue filters and confirmed race saves. Private page paths, search text, account details and form contents are excluded. Page speed is measured anonymously by Vercel Speed Insights, also without cookies. We respect Do Not Track and Global Privacy Control.",
        ],
      },
      {
        h: "Who processes data for us",
        p: [
          "Supabase (database and sign-in, servers in the EU – Frankfurt), Vercel (hosting and speed measurement), Neon (visit statistics database, EU), Resend (sending email) and Google (only if you sign in with Google).",
          "Your browser loads the map tiles directly from CARTO, which therefore sees your IP address and which part of the map is shown. Weather and place search (Open-Meteo, OpenStreetMap) are called by our server, not your browser, and receive nothing about you.",
          "Some of these companies are based in the USA. Transfers there are covered by the EU–US Data Privacy Framework or the European Commission's standard contractual clauses.",
        ],
      },
      {
        h: "Organisers and details in the calendar",
        p: [
          "For races we show what organisers published themselves in their regulations or on their website, such as the organising club, the race director's name, a phone number or a contact email. We do this in our legitimate interest, so riders know whom to ask. If your name or contact is there and you do not want it to be, write to us and we will remove it.",
        ],
      },
      {
        h: "Children",
        p: [
          "Accounts are created by adults, or by younger users with a parent's consent. Details of young riders are entered by a parent or coach; a first name or nickname and a birth year are enough.",
        ],
      },
      {
        h: "How long",
        p: [
          "For as long as you have an account. You can delete it at any time in Settings: riders, your plan, favourites, alerts and email logs are gone at once. Races you reported and feedback stay, without your name or email. Database backups drop the data within 30 days. Feedback sent without an account is kept while we need it to deal with it and improve the site; you can ask us to delete it at any time.",
        ],
      },
      {
        h: "Your rights",
        p: [
          `You can ask to access, correct, delete or export your data, restrict how we use it, or object to it — write to ${CONTACT} and we will answer within a month. Every email from us has a one-click unsubscribe link. You can also complain to the Czech Office for Personal Data Protection (uoou.gov.cz) or to the data protection authority in your country.`,
        ],
      },
      {
        h: "Changes",
        p: [
          "When we change something important here, the date at the bottom of the page changes and the change is described under “What’s new” on the About page.",
        ],
      },
    ],
  },
  pl: {
    title: "Prywatność",
    intro: `${SITE_NAME} to kalendarz wyścigów rowerowych. Oto kto odpowiada za Twoje dane, co przechowujemy, do czego tego używamy i jak to usunąć.`,
    updated: "Ostatnia zmiana",
    sections: [
      {
        h: "Kto odpowiada za dane",
        p: [
          `Administratorem danych osobowych jest ${OPERATOR.name}, który prowadzi ${SITE_NAME} (${OPERATOR.url}). We wszystkich sprawach dotyczących Twoich danych napisz na ${CONTACT}.`,
        ],
      },
      {
        h: "Co przechowujemy",
        p: [
          "Konto: e-mail, imię, a przy logowaniu przez Google także zdjęcie profilowe przekazane przez Google. Hasła przechowujemy wyłącznie jako hash.",
          "To, co sam dodasz w aplikacji: zawodników (imię lub pseudonim, rok urodzenia, płeć, ulubione dyscypliny), plan wyścigów, ulubione, zajęte dni, powiadomienia o wyścigach w okolicy (miejsce i promień), zgłoszone wyścigi, poprawki i opinie. Do opinii możesz dołączyć e-mail, abyśmy mogli odpowiedzieć.",
          "Jeśli zgłosisz się jako organizator wyścigu, zapisujemy Twój e-mail i to, którego wyścigu lub cyklu to dotyczy, aby zweryfikować zgłoszenie.",
          "Zapis wysłanych e-maili, aby ta sama wiadomość nie poszła dwa razy.",
        ],
      },
      {
        h: "Do czego ich używamy i na jakiej podstawie",
        p: [
          "Aby aplikacja działała: pokazać plan, polecać wyścigi dla Twoich zawodników, weryfikować organizatorów i wysyłać e-maile, które włączyłeś (nowe wyścigi w okolicy, zmiany w planie, podsumowanie tygodnia). Podstawą prawną jest świadczenie usługi, o którą prosisz (art. 6 ust. 1 lit. b RODO).",
          "Aby chronić serwis przed nadużyciami i wiedzieć, z czego się korzysta: adres IP służy krótko do ograniczania liczby żądań, a hosting zapisuje go w logach; ruch mierzymy bez cookies (zob. niżej). Podstawą jest nasz prawnie uzasadniony interes (art. 6 ust. 1 lit. f RODO) i możesz wnieść sprzeciw.",
          "Nie sprzedajemy danych, nie używamy ich do reklam i nie tworzymy z nich profili.",
        ],
      },
      {
        h: "Lokalizacja",
        p: [
          "Filtr odległości pyta przeglądarkę o lokalizację tylko za Twoją zgodą i używa jej wyłącznie na Twoim urządzeniu. Nie wysyłamy jej na serwer. Przy powiadomieniach zapisujemy tylko wybrane przez Ciebie miejsce.",
        ],
      },
      {
        id: "cookies",
        h: "Cookies i pamięć przeglądarki",
        p: [
          "Używamy tylko niezbędnych cookies do utrzymania logowania, dlatego nie pytamy o zgodę na cookies. Pamięć przeglądarki zapamiętuje ustawienia, np. filtry, kolumny tabeli lub zamknięte komunikaty.",
          "Ruch i wybrane interakcje mierzymy we własnej instalacji Umami na Vercel, z bazą Neon w UE, bez analitycznych cookies i łączenia odwiedzin między witrynami. Przesyłamy publiczne ścieżki stron, źródła wizyt, oznaczenia kampanii i podstawowe informacje o urządzeniu. Mierzymy też ogólne nazwy odwiedzanych sekcji, liczbę wyników, filtry katalogu i potwierdzone zapisanie wyścigu. Wykluczamy prywatne ścieżki stron, treść wyszukiwania, dane konta i formularzy. Szybkość ładowania stron anonimowo mierzy Vercel Speed Insights, również bez cookies. Respektujemy Do Not Track i Global Privacy Control.",
        ],
      },
      {
        h: "Kto przetwarza dane w naszym imieniu",
        p: [
          "Supabase (baza danych i logowanie, serwery w UE – Frankfurt), Vercel (hosting i pomiar szybkości), Neon (baza statystyk ruchu, UE), Resend (wysyłka e-maili) i Google (tylko przy logowaniu przez Google).",
          "Podkłady mapowe Twoja przeglądarka pobiera bezpośrednio z CARTO, które widzi więc Twój adres IP i wyświetlany fragment mapy. Pogodę i wyszukiwanie miejsc (Open-Meteo, OpenStreetMap) odpytuje nasz serwer, nie Twoja przeglądarka, i nie przekazuje im nic o Tobie.",
          "Niektóre z tych firm mają siedzibę w USA. Przekazanie danych jest objęte Ramami ochrony danych UE–USA lub standardowymi klauzulami umownymi Komisji Europejskiej.",
        ],
      },
      {
        h: "Organizatorzy i dane w kalendarzu",
        p: [
          "Przy wyścigach pokazujemy to, co organizatorzy sami opublikowali w regulaminie lub na swojej stronie, np. nazwę klubu, nazwisko dyrektora wyścigu, telefon lub e-mail kontaktowy. Robimy to w prawnie uzasadnionym interesie, aby zawodnicy wiedzieli, do kogo się zwrócić. Jeśli jest tam Twoje imię lub kontakt i tego nie chcesz, napisz do nas, a usuniemy je.",
        ],
      },
      {
        h: "Dzieci",
        p: [
          "Konto zakłada osoba dorosła albo młodszy użytkownik za zgodą rodzica. Dane młodych zawodników wpisuje rodzic lub trener; wystarczy imię lub pseudonim i rok urodzenia.",
        ],
      },
      {
        h: "Jak długo",
        p: [
          "Dopóki masz konto. Możesz je w każdej chwili usunąć w Ustawieniach: zawodnicy, plan, ulubione, powiadomienia i zapis e-maili znikają od razu. Zgłoszone wyścigi i opinie zostają, ale bez Twojego imienia i e-maila. Z kopii zapasowych bazy dane znikają najpóźniej po 30 dniach. Opinie wysłane bez konta przechowujemy, dopóki są potrzebne do ich obsługi i ulepszania serwisu; w każdej chwili możesz poprosić o ich usunięcie.",
        ],
      },
      {
        h: "Twoje prawa",
        p: [
          `Możesz żądać dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przeniesienia lub wnieść sprzeciw — napisz na ${CONTACT}, odpowiemy w ciągu miesiąca. Każdy e-mail od nas ma link do wypisania jednym kliknięciem. Możesz też złożyć skargę do Prezesa UODO (uodo.gov.pl) lub do czeskiego urzędu ochrony danych (uoou.gov.cz).`,
        ],
      },
      {
        h: "Zmiany",
        p: [
          "Gdy zmienimy tu coś istotnego, zmieni się data na dole strony, a zmianę opiszemy w nowościach na stronie O projekcie.",
        ],
      },
    ],
  },
  sk: {
    title: "Ochrana súkromia",
    intro: `${SITE_NAME} je kalendár cyklistických pretekov. Tu je, kto za tvoje údaje zodpovedá, aké údaje máme, na čo ich používame a ako sa ich zbaviť.`,
    updated: "Posledná zmena",
    sections: [
      {
        h: "Kto za údaje zodpovedá",
        p: [
          `Prevádzkovateľom osobných údajov je ${OPERATOR.name}, ktorý prevádzkuje ${SITE_NAME} (${OPERATOR.url}). Vo všetkom, čo sa týka tvojich údajov, nám píš na ${CONTACT}.`,
        ],
      },
      {
        h: "Čo ukladáme",
        p: [
          "Účet: e-mail, meno a pri prihlásení cez Google aj profilový obrázok, ktorý Google odovzdá. Heslo ukladáme len ako hash.",
          "Čo si v aplikácii sám vyplníš: jazdcov (meno alebo prezývku, rok narodenia, pohlavie, obľúbené disciplíny), plán pretekov, obľúbené preteky, obsadené dni, upozornenia na preteky v okolí (miesto a okruh), nahlásené preteky, opravy a spätnú väzbu. K spätnej väzbe môžeš pripojiť e-mail, aby sme ti mohli odpovedať.",
          "Ak sa prihlásiš ako organizátor pretekov, uložíme tvoj e-mail a o ktoré preteky alebo seriál ide, aby sme mohli žiadosť overiť.",
          "Záznam o odoslaných e-mailoch, aby sme rovnakú správu neposlali dvakrát.",
        ],
      },
      {
        h: "Na čo to používame a prečo smieme",
        p: [
          "Aby aplikácia fungovala: ukázať tvoj plán, odporučiť preteky pre tvojich jazdcov, overiť organizátorov a posielať e-maily, ktoré si si zapol (nové preteky v okolí, zmeny v pláne, týždenný prehľad). Právnym základom je plnenie služby, o ktorú si požiadal (čl. 6 ods. 1 písm. b GDPR).",
          "Aby sme web chránili pred zneužitím a vedeli, čo sa na ňom používa: IP adresa slúži krátkodobo na obmedzenie počtu požiadaviek a hosting ju zapisuje do prevádzkových záznamov; návštevnosť meriame bez cookies (pozri nižšie). Základom je náš oprávnený záujem (čl. 6 ods. 1 písm. f GDPR) a môžeš proti tomu namietať.",
          "Údaje nepredávame, nepoužívame na reklamu a nevytvárame z nich profily.",
        ],
      },
      {
        h: "Poloha",
        p: [
          "Filter vzdialenosti sa na polohu pýta prehliadača až s tvojím súhlasom a používa ju len v tvojom zariadení. Na server ju neposielame. Pri upozorneniach ukladáme len miesto, ktoré si sám zvolíš.",
        ],
      },
      {
        id: "cookies",
        h: "Cookies a úložisko prehliadača",
        p: [
          "Používame len nevyhnutné cookies, ktoré ťa držia prihláseného, preto sa ťa na cookies nepýtame. V úložisku prehliadača si pamätáme nastavenia, napríklad filtre, stĺpce tabuľky alebo zavreté upozornenia.",
          "Návštevnosť a vybrané interakcie meriame vlastnou inštaláciou Umami na Verceli s databázou Neon v EÚ, bez analytických cookies a prepájania návštev medzi webmi. Posielame verejné cesty stránok, zdroj návštevy, označenia kampaní a základné informácie o zariadení. Meriame aj všeobecné názvy navštívených sekcií, počty výsledkov, katalógové filtre a potvrdené uloženie pretekov. Neposielame súkromné adresy stránok, obsah vyhľadávania, údaje účtu ani formulárov. Rýchlosť načítania stránok meria anonymne Vercel Speed Insights, tiež bez cookies. Rešpektujeme Do Not Track a Global Privacy Control.",
        ],
      },
      {
        h: "Kto s údajmi pracuje za nás",
        p: [
          "Supabase (databáza a prihlásenie, servery v EÚ – Frankfurt), Vercel (prevádzka webu a meranie rýchlosti), Neon (databáza štatistík návštevnosti, EÚ), Resend (odosielanie e-mailov) a Google (len ak sa prihlásiš cez Google).",
          "Mapové podklady načítava tvoj prehliadač priamo od CARTO, ktoré tak vidí tvoju IP adresu a ktorá časť mapy sa zobrazuje. Počasie a vyhľadávanie miest (Open-Meteo, OpenStreetMap) volá náš server, nie tvoj prehliadač, a neodovzdáva im nič o tebe.",
          "Niektorí z nich sídlia v USA. Prenos údajov tam je krytý rámcom EÚ – USA pre ochranu osobných údajov alebo štandardnými zmluvnými doložkami Európskej komisie.",
        ],
      },
      {
        h: "Organizátori a údaje v kalendári",
        p: [
          "Pri pretekoch zobrazujeme údaje, ktoré organizátori sami zverejnili v propozíciách alebo na svojom webe, napríklad názov klubu, meno riaditeľa pretekov, telefón alebo kontaktný e-mail. Robíme to v oprávnenom záujme, aby jazdci vedeli, na koho sa obrátiť. Ak je tam tvoje meno alebo kontakt a nechceš to, napíš nám a odstránime ho.",
        ],
      },
      {
        h: "Deti",
        p: [
          "Účet zakladá dospelý alebo mladší používateľ so súhlasom rodiča. Údaje o detských jazdcoch vypĺňa rodič alebo tréner; stačí krstné meno alebo prezývka a rok narodenia.",
        ],
      },
      {
        h: "Ako dlho",
        p: [
          "Kým máš účet. Účet si môžeš kedykoľvek zmazať v Nastaveniach: jazdci, plán, obľúbené, upozornenia a záznamy e-mailov zmiznú hneď. Preteky, ktoré si nahlásil, a spätná väzba zostanú, ale bez tvojho mena a e-mailu. Zo záloh databázy údaje zmiznú najneskôr do 30 dní. Spätnú väzbu bez účtu uchovávame, kým ju potrebujeme na vybavenie a zlepšenie webu; jej vymazanie si môžeš kedykoľvek vyžiadať.",
        ],
      },
      {
        h: "Tvoje práva",
        p: [
          `Môžeš žiadať prístup k údajom, ich opravu, vymazanie, obmedzenie spracúvania, prenos alebo namietať — napíš na ${CONTACT}, odpovieme do mesiaca. Každý e-mail od nás má odkaz na odhlásenie jedným klikom. Sťažnosť môžeš podať na Úrad na ochranu osobných údajov SR (dataprotection.gov.sk) alebo na český úrad (uoou.gov.cz).`,
        ],
      },
      {
        h: "Zmeny",
        p: [
          "Keď tu zmeníme niečo podstatné, zmení sa dátum dole na stránke a zmenu popíšeme v novinkách na stránke O projekte.",
        ],
      },
    ],
  },
  de: {
    title: "Datenschutz",
    intro: `${SITE_NAME} ist ein Kalender für Radrennen. Hier steht, wer für deine Daten verantwortlich ist, was wir speichern, wozu und wie du es wieder loswirst.`,
    updated: "Zuletzt geändert",
    sections: [
      {
        h: "Wer verantwortlich ist",
        p: [
          `Verantwortlicher im Sinne der DSGVO ist ${OPERATOR.name}, der ${SITE_NAME} betreibt (${OPERATOR.url}). Für alles rund um deine Daten schreib an ${CONTACT}.`,
        ],
      },
      {
        h: "Was wir speichern",
        p: [
          "Dein Konto: E-Mail, Name und, wenn du dich mit Google anmeldest, das Profilbild, das Google teilt. Passwörter speichern wir nur als Hash.",
          "Was du in der App anlegst: Fahrer (Name oder Spitzname, Geburtsjahr, Geschlecht, bevorzugte Disziplinen), deinen Rennplan, Favoriten, belegte Tage, Hinweise auf Rennen in der Nähe (ein Ort und ein Umkreis), gemeldete Rennen, Korrekturen und Feedback. Zum Feedback kannst du eine E-Mail angeben, damit wir antworten können.",
          "Wenn du dich als Veranstalter eines Rennens meldest, speichern wir deine E-Mail und um welches Rennen oder welche Serie es geht, um die Anfrage zu prüfen.",
          "Ein Protokoll der gesendeten E-Mails, damit dieselbe Nachricht nie zweimal rausgeht.",
        ],
      },
      {
        h: "Wozu wir es nutzen und warum wir dürfen",
        p: [
          "Damit die App funktioniert: deinen Plan zeigen, Rennen für deine Fahrer vorschlagen, Veranstalter prüfen und die E-Mails schicken, die du eingeschaltet hast (neue Rennen in der Nähe, Änderungen in deinem Plan, die Wochenübersicht). Rechtsgrundlage ist die Erbringung des Dienstes, den du angefordert hast (Art. 6 Abs. 1 lit. b DSGVO).",
          "Um die Seite vor Missbrauch zu schützen und zu wissen, was genutzt wird: Deine IP-Adresse dient kurzzeitig dazu, die Zahl der Anfragen zu begrenzen, und unser Hoster schreibt sie in seine Betriebsprotokolle; Besuche messen wir ohne Cookies (siehe unten). Rechtsgrundlage ist unser berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO), dem du widersprechen kannst.",
          "Wir verkaufen deine Daten nicht, nutzen sie nicht für Werbung und erstellen keine Profile.",
        ],
      },
      {
        h: "Standort",
        p: [
          "Der Entfernungsfilter fragt deinen Browser nur mit deiner Erlaubnis nach dem Standort und nutzt ihn nur auf deinem Gerät. Er wird nie an unseren Server geschickt. Für Hinweise speichern wir nur den Ort, den du wählst.",
        ],
      },
      {
        id: "cookies",
        h: "Cookies und Browserspeicher",
        p: [
          "Wir nutzen nur die Cookies, die nötig sind, damit du angemeldet bleibst; deshalb fragen wir dich nicht nach Cookies. Der Browserspeicher merkt sich Einstellungen wie Filter, Tabellenspalten oder geschlossene Hinweise.",
          "Besuche und ausgewählte Interaktionen messen wir mit einer eigenen Umami-Installation auf Vercel und einer Neon-Datenbank in der EU, ohne Analyse-Cookies oder websiteübergreifende Verknüpfung. Erfasst werden öffentliche Seitenpfade, Verweisquellen, Kampagnenkennzeichnungen und grundlegende Geräteinformationen. Wir messen auch allgemeine Bereichsnamen, Ergebniszahlen, Katalogfilter und bestätigte gespeicherte Rennen. Private Seitenpfade, Suchtexte, Kontodaten und Formularinhalte sind ausgeschlossen. Die Ladegeschwindigkeit misst Vercel Speed Insights anonym, ebenfalls ohne Cookies. Do Not Track und Global Privacy Control werden respektiert.",
        ],
      },
      {
        h: "Wer Daten für uns verarbeitet",
        p: [
          "Supabase (Datenbank und Anmeldung, Server in der EU – Frankfurt), Vercel (Hosting und Geschwindigkeitsmessung), Neon (Datenbank der Besuchsstatistik, EU), Resend (E-Mail-Versand) und Google (nur wenn du dich mit Google anmeldest).",
          "Die Kartenkacheln lädt dein Browser direkt von CARTO, das dadurch deine IP-Adresse und den angezeigten Kartenausschnitt sieht. Wetter und Ortssuche (Open-Meteo, OpenStreetMap) fragt unser Server ab, nicht dein Browser, und gibt dabei nichts über dich weiter.",
          "Einige dieser Anbieter sitzen in den USA. Die Übermittlung ist durch das EU-US Data Privacy Framework oder die Standardvertragsklauseln der Europäischen Kommission abgesichert.",
        ],
      },
      {
        h: "Veranstalter und Angaben im Kalender",
        p: [
          "Bei Rennen zeigen wir, was Veranstalter selbst in ihrer Ausschreibung oder auf ihrer Website veröffentlicht haben, etwa den ausrichtenden Verein, den Namen der Rennleitung, eine Telefonnummer oder eine Kontakt-E-Mail. Das geschieht in unserem berechtigten Interesse, damit Fahrer wissen, an wen sie sich wenden. Steht dort dein Name oder Kontakt und du willst das nicht, schreib uns und wir entfernen ihn.",
        ],
      },
      {
        h: "Kinder",
        p: [
          "Konten legen Erwachsene an, oder jüngere Nutzer mit Zustimmung der Eltern. Angaben zu jungen Fahrern trägt ein Elternteil oder Trainer ein; ein Vorname oder Spitzname und das Geburtsjahr genügen.",
        ],
      },
      {
        h: "Wie lange",
        p: [
          "Solange du ein Konto hast. Du kannst es jederzeit in den Einstellungen löschen: Fahrer, Plan, Favoriten, Hinweise und E-Mail-Protokolle sind sofort weg. Gemeldete Rennen und Feedback bleiben, aber ohne deinen Namen und deine E-Mail. Aus Datenbank-Sicherungen verschwinden die Daten spätestens nach 30 Tagen. Feedback ohne Konto bewahren wir auf, solange wir es zur Bearbeitung und zur Verbesserung der Seite brauchen; du kannst jederzeit die Löschung verlangen.",
        ],
      },
      {
        h: "Deine Rechte",
        p: [
          `Du kannst Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung oder Export deiner Daten verlangen oder der Nutzung widersprechen — schreib an ${CONTACT}, wir antworten innerhalb eines Monats. Jede E-Mail von uns hat einen Abmeldelink mit einem Klick. Du kannst dich auch bei der Datenschutzaufsichtsbehörde deines Landes oder bei der tschechischen Behörde (uoou.gov.cz) beschweren.`,
        ],
      },
      {
        h: "Änderungen",
        p: [
          "Wenn wir hier etwas Wesentliches ändern, ändert sich das Datum unten auf der Seite und wir beschreiben die Änderung unter den Neuigkeiten auf der Seite „Über das Projekt“.",
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
    alternates: { canonical: absoluteUrl(`/${locale}/privacy`), languages: localeAlternates("privacy") },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = asLocale((await params).locale);
  return <LegalDoc doc={DOCS[locale]} locale={locale} page="privacy" updatedOn={UPDATED} />;
}
