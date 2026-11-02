import type { Locale } from "@/lib/i18n/messages";

type Copy = {
  title: string;
  description: string;
  claimTitle: string;
  claimBody: string;
  account: string;
  notePlaceholder: string;
  claimRace: string;
  claimSeries: string;
  claimVerified: string;
  claimPending: string;
  mine: string;
  none: string;
  status: Record<"pending" | "verified" | "rejected" | "revoked", string>;
  series: string;
  edit: string;
  view: string;
  back: string;
  startDate: string;
  endDate: string;
  raceStatus: string;
  raceStatuses: Record<"scheduled" | "postponed" | "cancelled", string>;
  website: string;
  registration: string;
  regulations: string;
  closes: string;
  about: string;
  categories: string;
  catName: string;
  catKm: string;
  catAgeMin: string;
  catAgeMax: string;
  addCategory: string;
  remove: string;
  save: string;
  saved: string;
  failed: string;
  badge: string;
  badgeHelp: string;
  claimLink: string;
  dialogTitle: string;
  dialogIntro: string;
  points: string[];
  verify: string;
  signIn: string;
  manage: string;
  editLink: string;
  editTitle: string;
  editIntro: string;
  optionOrganizer: string;
  optionSuggest: string;
  suggestPlaceholder: string;
  suggestSend: string;
  suggestThanks: string;
  adminNote: string;
  adminEdit: string;
  organizerNote: string;
  pendingNote: string;
  seriesClaim: {
    claimLink: string;
    dialogTitle: string;
    dialogIntro: string;
    editTitle: string;
    editIntro: string;
    points: string[];
    manage: string;
  };
};

/** The organiser's pages and the bits of the race page that point to them. */
export const organizerCopy: Record<Locale, Copy> = {
  cs: {
    title: "Pro pořadatele",
    description: "Převezmi svůj závod nebo seriál a upravuj ho sám – termín, odkazy, propozice, trasy a kategorie.",
    claimTitle: "Převzít: {name}",
    claimBody: "Když jsi přihlášený e-mailem na doméně webu závodu, ověříme tě hned. Jinak žádost potvrdíme ručně, obvykle do dvou dnů.",
    account: "Účet: {email}",
    notePlaceholder: "Kdo jsi a jak tě můžeme ověřit – klub, funkce, telefon",
    claimRace: "Převzít závod",
    claimSeries: "Převzít seriál",
    claimVerified: "Hotovo – závod spravuješ ty. Můžeš ho upravovat.",
    claimPending: "Žádost jsme přijali. Jakmile ji potvrdíme, objeví se tady.",
    mine: "Moje závody a seriály",
    none: "Zatím nespravuješ žádný závod. Převzít ho můžeš z jeho stránky.",
    status: { pending: "Čeká na ověření", verified: "Ověřeno", rejected: "Zamítnuto", revoked: "Zrušeno" },
    series: "Seriál",
    edit: "Upravit",
    view: "Zobrazit",
    back: "Zpět na seznam",
    startDate: "Začátek",
    endDate: "Konec (u vícedenních)",
    raceStatus: "Stav",
    raceStatuses: { scheduled: "Koná se", postponed: "Odloženo", cancelled: "Zrušeno" },
    website: "Web závodu",
    registration: "Přihlášky",
    regulations: "Propozice",
    closes: "Uzávěrka přihlášek",
    about: "Popis závodu",
    categories: "Trasy a kategorie",
    catName: "Název",
    catKm: "km",
    catAgeMin: "Věk od",
    catAgeMax: "Věk do",
    addCategory: "Přidat trasu nebo kategorii",
    remove: "Odebrat",
    save: "Uložit",
    saved: "Uloženo – změna je na webu.",
    failed: "Uložení se nepovedlo. Zkus to znovu.",
    badge: "Spravuje pořadatel",
    badgeHelp: "Údaje spravuje přímo pořadatel závodu.",
    claimLink: "Pořádáš tento závod? Převezmi ho",
    dialogTitle: "Převzít závod",
    dialogIntro: "Pořádáš {name}? Převezmi ho a údaje u nás spravuj sám.",
    points: ["Upravíš termín, odkazy na přihlášky a propozice, popis i trasy a kategorie.", "Změny jsou na webu hned a naše automatické stahování je už nepřepíše.", "Závod dostane odznak Ověřeno pořadatelem."],
    verify: "Když se přihlásíš e-mailem na doméně webu závodu, ověříme tě hned. Jinak žádost potvrdíme ručně, obvykle do dvou dnů.",
    signIn: "Nejdřív se přihlas:",
    manage: "Otevřít správu závodu",
    editLink: "Upravit údaje",
    editTitle: "Upravit závod",
    editIntro: "Vidíš u {name} chybu, nebo ho pořádáš? Pořadatel si závod převezme a upravuje ho sám, ostatní nám pošlou opravu.",
    optionOrganizer: "Pořádám ho",
    optionSuggest: "Navrhnout opravu",
    suggestPlaceholder: "Co je špatně a jak to má být správně? Ideálně i s odkazem na zdroj.",
    suggestSend: "Odeslat opravu",
    suggestThanks: "Díky! Opravu zkontrolujeme a zapracujeme.",
    adminNote: "Jsi admin – upravit můžeš rovnou.",
    adminEdit: "Upravit v administraci",
    organizerNote: "Tohle spravuješ jako pořadatel.",
    pendingNote: "Tvoje žádost o převzetí čeká na potvrzení. Mezitím nám můžeš poslat opravu.",
    seriesClaim: {
      claimLink: "Pořádáš tento seriál? Převezmi ho",
      dialogTitle: "Převzít seriál",
      dialogIntro: "Pořádáš {name}? Převezmi celý seriál a spravuj všechna jeho kola sám.",
      editTitle: "Upravit seriál",
      editIntro: "Vidíš u {name} chybu, nebo ho pořádáš? Pořadatel si seriál převezme a upravuje všechna kola sám, ostatní nám pošlou opravu.",
      points: ["Upravíš termíny, odkazy, popis, trasy a kategorie u každého kola.", "Změny jsou na webu hned a naše automatické stahování je už nepřepíše.", "Seriál i jeho kola dostanou odznak Ověřeno pořadatelem."],
      manage: "Otevřít správu seriálu",
    },
  },
  en: {
    title: "For organisers",
    description: "Take over your race or series and edit it yourself: date, links, regulations, routes and categories.",
    claimTitle: "Take over: {name}",
    claimBody: "If you are signed in with an address on the race website's domain, you are verified at once. Otherwise we confirm the request by hand, usually within two days.",
    account: "Account: {email}",
    notePlaceholder: "Who you are and how we can check: club, role, phone",
    claimRace: "Take over this race",
    claimSeries: "Take over this series",
    claimVerified: "Done: the race is yours to edit.",
    claimPending: "Request received. It shows here once we confirm it.",
    mine: "My races and series",
    none: "You do not look after any race yet. Take one over from its page.",
    status: { pending: "Waiting for verification", verified: "Verified", rejected: "Rejected", revoked: "Withdrawn" },
    series: "Series",
    edit: "Edit",
    view: "View",
    back: "Back to the list",
    startDate: "Start",
    endDate: "End (multi-day races)",
    raceStatus: "Status",
    raceStatuses: { scheduled: "Going ahead", postponed: "Postponed", cancelled: "Cancelled" },
    website: "Race website",
    registration: "Entries",
    regulations: "Regulations",
    closes: "Entry deadline",
    about: "About the race",
    categories: "Routes and categories",
    catName: "Name",
    catKm: "km",
    catAgeMin: "Age from",
    catAgeMax: "Age to",
    addCategory: "Add a route or category",
    remove: "Remove",
    save: "Save",
    saved: "Saved: the change is on the site.",
    failed: "Saving failed. Please try again.",
    badge: "Managed by the organiser",
    badgeHelp: "The race's organiser looks after these details.",
    claimLink: "Organising this race? Take it over",
    dialogTitle: "Take over this race",
    dialogIntro: "Organising {name}? Take it over and look after its details yourself.",
    points: ["Edit the date, entry and regulations links, the description, routes and categories.", "Changes are on the site at once, and our automatic updates no longer overwrite them.", "The race gets a Verified by the organiser badge."],
    verify: "If you sign in with an address on the race website's domain, you are verified at once. Otherwise we confirm the request by hand, usually within two days.",
    signIn: "Sign in first:",
    manage: "Open race management",
    editLink: "Edit details",
    editTitle: "Edit this race",
    editIntro: "Spotted a mistake in {name}, or do you organise it? The organiser takes the race over and edits it; anyone else can send us a correction.",
    optionOrganizer: "I organise it",
    optionSuggest: "Suggest a correction",
    suggestPlaceholder: "What is wrong and what should it say? A link to the source helps.",
    suggestSend: "Send correction",
    suggestThanks: "Thanks! We will check the correction and apply it.",
    adminNote: "You are an admin and can edit it directly.",
    adminEdit: "Edit in admin",
    organizerNote: "You look after this as its organiser.",
    pendingNote: "Your request to take it over is waiting for confirmation. Meanwhile you can send us a correction.",
    seriesClaim: {
      claimLink: "Organising this series? Take it over",
      dialogTitle: "Take over this series",
      dialogIntro: "Organising {name}? Take over the whole series and look after every round yourself.",
      editTitle: "Edit this series",
      editIntro: "Spotted a mistake in {name}, or do you organise it? The organiser takes the series over and edits every round; anyone else can send us a correction.",
      points: ["Edit the dates, links, description, routes and categories of every round.", "Changes are on the site at once, and our automatic updates no longer overwrite them.", "The series and its rounds get a Verified by the organiser badge."],
      manage: "Open series management",
    },
  },
  sk: {
    title: "Pre organizátorov",
    description: "Prevezmi svoj pretek alebo seriál a uprav ho sám – termín, odkazy, propozície, trasy a kategórie.",
    claimTitle: "Prevziať: {name}",
    claimBody: "Ak si prihlásený e-mailom na doméne webu preteku, overíme ťa hneď. Inak žiadosť potvrdíme ručne, zvyčajne do dvoch dní.",
    account: "Účet: {email}",
    notePlaceholder: "Kto si a ako ťa môžeme overiť – klub, funkcia, telefón",
    claimRace: "Prevziať pretek",
    claimSeries: "Prevziať seriál",
    claimVerified: "Hotovo – pretek spravuješ ty. Môžeš ho upravovať.",
    claimPending: "Žiadosť sme prijali. Keď ju potvrdíme, objaví sa tu.",
    mine: "Moje preteky a seriály",
    none: "Zatiaľ nespravuješ žiadny pretek. Prevziať ho môžeš z jeho stránky.",
    status: { pending: "Čaká na overenie", verified: "Overené", rejected: "Zamietnuté", revoked: "Zrušené" },
    series: "Seriál",
    edit: "Upraviť",
    view: "Zobraziť",
    back: "Späť na zoznam",
    startDate: "Začiatok",
    endDate: "Koniec (pri viacdňových)",
    raceStatus: "Stav",
    raceStatuses: { scheduled: "Koná sa", postponed: "Odložené", cancelled: "Zrušené" },
    website: "Web preteku",
    registration: "Prihlášky",
    regulations: "Propozície",
    closes: "Uzávierka prihlášok",
    about: "Popis preteku",
    categories: "Trasy a kategórie",
    catName: "Názov",
    catKm: "km",
    catAgeMin: "Vek od",
    catAgeMax: "Vek do",
    addCategory: "Pridať trasu alebo kategóriu",
    remove: "Odobrať",
    save: "Uložiť",
    saved: "Uložené – zmena je na webe.",
    failed: "Uloženie sa nepodarilo. Skús to znova.",
    badge: "Spravuje organizátor",
    badgeHelp: "Údaje spravuje priamo organizátor preteku.",
    claimLink: "Organizuješ tento pretek? Prevezmi ho",
    dialogTitle: "Prevziať pretek",
    dialogIntro: "Organizuješ {name}? Prevezmi ho a údaje u nás spravuj sám.",
    points: ["Upravíš termín, odkazy na prihlášky a propozície, popis aj trasy a kategórie.", "Zmeny sú na webe hneď a naše automatické sťahovanie ich už neprepíše.", "Pretek dostane odznak Overené organizátorom."],
    verify: "Ak sa prihlásiš e-mailom na doméne webu preteku, overíme ťa hneď. Inak žiadosť potvrdíme ručne, zvyčajne do dvoch dní.",
    signIn: "Najprv sa prihlás:",
    manage: "Otvoriť správu preteku",
    editLink: "Upraviť údaje",
    editTitle: "Upraviť pretek",
    editIntro: "Vidíš pri {name} chybu, alebo ho organizuješ? Organizátor si pretek prevezme a upravuje ho sám, ostatní nám pošlú opravu.",
    optionOrganizer: "Organizujem ho",
    optionSuggest: "Navrhnúť opravu",
    suggestPlaceholder: "Čo je zle a ako to má byť správne? Ideálne aj s odkazom na zdroj.",
    suggestSend: "Odoslať opravu",
    suggestThanks: "Vďaka! Opravu skontrolujeme a zapracujeme.",
    adminNote: "Si admin – upraviť môžeš rovno.",
    adminEdit: "Upraviť v administrácii",
    organizerNote: "Toto spravuješ ako organizátor.",
    pendingNote: "Tvoja žiadosť o prevzatie čaká na potvrdenie. Medzitým nám môžeš poslať opravu.",
    seriesClaim: {
      claimLink: "Organizuješ tento seriál? Prevezmi ho",
      dialogTitle: "Prevziať seriál",
      dialogIntro: "Organizuješ {name}? Prevezmi celý seriál a spravuj všetky jeho kolá sám.",
      editTitle: "Upraviť seriál",
      editIntro: "Vidíš pri {name} chybu, alebo ho organizuješ? Organizátor si seriál prevezme a upravuje všetky kolá sám, ostatní nám pošlú opravu.",
      points: ["Upravíš termíny, odkazy, popis, trasy a kategórie každého kola.", "Zmeny sú na webe hneď a naše automatické sťahovanie ich už neprepíše.", "Seriál aj jeho kolá dostanú odznak Overené organizátorom."],
      manage: "Otvoriť správu seriálu",
    },
  },
  pl: {
    title: "Dla organizatorów",
    description: "Przejmij swój wyścig lub cykl i edytuj go sam: termin, linki, regulamin, trasy i kategorie.",
    claimTitle: "Przejmij: {name}",
    claimBody: "Jeśli logujesz się adresem w domenie strony wyścigu, weryfikujemy cię od razu. W innym razie potwierdzamy prośbę ręcznie, zwykle w ciągu dwóch dni.",
    account: "Konto: {email}",
    notePlaceholder: "Kim jesteś i jak możemy to sprawdzić: klub, funkcja, telefon",
    claimRace: "Przejmij wyścig",
    claimSeries: "Przejmij cykl",
    claimVerified: "Gotowe: wyścigiem zarządzasz ty i możesz go edytować.",
    claimPending: "Prośba przyjęta. Pojawi się tutaj, gdy ją potwierdzimy.",
    mine: "Moje wyścigi i cykle",
    none: "Nie zarządzasz jeszcze żadnym wyścigiem. Przejmij go z jego strony.",
    status: { pending: "Czeka na weryfikację", verified: "Zweryfikowano", rejected: "Odrzucono", revoked: "Wycofano" },
    series: "Cykl",
    edit: "Edytuj",
    view: "Zobacz",
    back: "Wróć do listy",
    startDate: "Początek",
    endDate: "Koniec (wyścigi wielodniowe)",
    raceStatus: "Status",
    raceStatuses: { scheduled: "Odbędzie się", postponed: "Przełożony", cancelled: "Odwołany" },
    website: "Strona wyścigu",
    registration: "Zapisy",
    regulations: "Regulamin",
    closes: "Koniec zapisów",
    about: "O wyścigu",
    categories: "Trasy i kategorie",
    catName: "Nazwa",
    catKm: "km",
    catAgeMin: "Wiek od",
    catAgeMax: "Wiek do",
    addCategory: "Dodaj trasę lub kategorię",
    remove: "Usuń",
    save: "Zapisz",
    saved: "Zapisano: zmiana jest na stronie.",
    failed: "Nie udało się zapisać. Spróbuj ponownie.",
    badge: "Zarządzane przez organizatora",
    badgeHelp: "Dane prowadzi bezpośrednio organizator wyścigu.",
    claimLink: "Organizujesz ten wyścig? Przejmij go",
    dialogTitle: "Przejmij wyścig",
    dialogIntro: "Organizujesz {name}? Przejmij go i sam zarządzaj jego danymi.",
    points: ["Edytujesz termin, linki do zapisów i regulaminu, opis oraz trasy i kategorie.", "Zmiany są na stronie od razu, a nasze automatyczne aktualizacje już ich nie nadpiszą.", "Wyścig dostaje odznakę Zweryfikowane przez organizatora."],
    verify: "Jeśli logujesz się adresem w domenie strony wyścigu, weryfikujemy cię od razu. W innym razie potwierdzamy prośbę ręcznie, zwykle w ciągu dwóch dni.",
    signIn: "Najpierw się zaloguj:",
    manage: "Otwórz zarządzanie wyścigiem",
    editLink: "Edytuj dane",
    editTitle: "Edytuj wyścig",
    editIntro: "Widzisz błąd w {name} albo go organizujesz? Organizator przejmuje wyścig i sam go edytuje, pozostali przesyłają nam poprawkę.",
    optionOrganizer: "Organizuję go",
    optionSuggest: "Zaproponuj poprawkę",
    suggestPlaceholder: "Co jest nie tak i jak powinno być? Najlepiej z linkiem do źródła.",
    suggestSend: "Wyślij poprawkę",
    suggestThanks: "Dzięki! Sprawdzimy poprawkę i ją wprowadzimy.",
    adminNote: "Jesteś adminem i możesz edytować od razu.",
    adminEdit: "Edytuj w panelu admina",
    organizerNote: "Zarządzasz tym jako organizator.",
    pendingNote: "Twoja prośba o przejęcie czeka na potwierdzenie. W międzyczasie możesz wysłać nam poprawkę.",
    seriesClaim: {
      claimLink: "Organizujesz ten cykl? Przejmij go",
      dialogTitle: "Przejmij cykl",
      dialogIntro: "Organizujesz {name}? Przejmij cały cykl i sam zarządzaj wszystkimi rundami.",
      editTitle: "Edytuj cykl",
      editIntro: "Widzisz błąd w {name} albo go organizujesz? Organizator przejmuje cykl i sam edytuje wszystkie rundy, pozostali przesyłają nam poprawkę.",
      points: ["Edytujesz terminy, linki, opis, trasy i kategorie każdej rundy.", "Zmiany są na stronie od razu, a nasze automatyczne aktualizacje już ich nie nadpiszą.", "Cykl i jego rundy dostają odznakę Zweryfikowane przez organizatora."],
      manage: "Otwórz zarządzanie cyklem",
    },
  },
  de: {
    title: "Für Veranstalter",
    description: "Übernimm dein Rennen oder deine Serie und bearbeite sie selbst: Termin, Links, Ausschreibung, Strecken und Klassen.",
    claimTitle: "Übernehmen: {name}",
    claimBody: "Bist du mit einer Adresse auf der Domain der Rennwebsite angemeldet, bist du sofort bestätigt. Sonst prüfen wir die Anfrage von Hand, meist innerhalb von zwei Tagen.",
    account: "Konto: {email}",
    notePlaceholder: "Wer du bist und wie wir es prüfen können: Verein, Funktion, Telefon",
    claimRace: "Rennen übernehmen",
    claimSeries: "Serie übernehmen",
    claimVerified: "Fertig: Du betreust das Rennen und kannst es bearbeiten.",
    claimPending: "Anfrage erhalten. Sie erscheint hier, sobald wir sie bestätigen.",
    mine: "Meine Rennen und Serien",
    none: "Du betreust noch kein Rennen. Übernimm eines von seiner Seite aus.",
    status: { pending: "Wartet auf Prüfung", verified: "Bestätigt", rejected: "Abgelehnt", revoked: "Zurückgezogen" },
    series: "Serie",
    edit: "Bearbeiten",
    view: "Ansehen",
    back: "Zurück zur Liste",
    startDate: "Beginn",
    endDate: "Ende (mehrtägige Rennen)",
    raceStatus: "Status",
    raceStatuses: { scheduled: "Findet statt", postponed: "Verschoben", cancelled: "Abgesagt" },
    website: "Rennwebsite",
    registration: "Anmeldung",
    regulations: "Ausschreibung",
    closes: "Anmeldeschluss",
    about: "Über das Rennen",
    categories: "Strecken und Klassen",
    catName: "Name",
    catKm: "km",
    catAgeMin: "Alter ab",
    catAgeMax: "Alter bis",
    addCategory: "Strecke oder Klasse hinzufügen",
    remove: "Entfernen",
    save: "Speichern",
    saved: "Gespeichert: die Änderung ist online.",
    failed: "Speichern fehlgeschlagen. Bitte erneut versuchen.",
    badge: "Vom Veranstalter betreut",
    badgeHelp: "Die Angaben pflegt der Veranstalter des Rennens selbst.",
    claimLink: "Du veranstaltest dieses Rennen? Übernimm es",
    dialogTitle: "Rennen übernehmen",
    dialogIntro: "Du veranstaltest {name}? Übernimm es und pflege die Angaben selbst.",
    points: ["Du bearbeitest Termin, Anmelde- und Ausschreibungslinks, Beschreibung, Strecken und Klassen.", "Änderungen sind sofort online, und unsere automatischen Updates überschreiben sie nicht mehr.", "Das Rennen bekommt das Abzeichen Vom Veranstalter bestätigt."],
    verify: "Meldest du dich mit einer Adresse auf der Domain der Rennwebsite an, bist du sofort bestätigt. Sonst prüfen wir die Anfrage von Hand, meist innerhalb von zwei Tagen.",
    signIn: "Melde dich zuerst an:",
    manage: "Rennverwaltung öffnen",
    editLink: "Angaben bearbeiten",
    editTitle: "Rennen bearbeiten",
    editIntro: "Fehler bei {name} entdeckt, oder veranstaltest du es? Der Veranstalter übernimmt das Rennen und pflegt es selbst, alle anderen schicken uns eine Korrektur.",
    optionOrganizer: "Ich veranstalte es",
    optionSuggest: "Korrektur vorschlagen",
    suggestPlaceholder: "Was stimmt nicht und wie muss es lauten? Am besten mit Link zur Quelle.",
    suggestSend: "Korrektur senden",
    suggestThanks: "Danke! Wir prüfen die Korrektur und übernehmen sie.",
    adminNote: "Du bist Admin und kannst direkt bearbeiten.",
    adminEdit: "Im Admin bearbeiten",
    organizerNote: "Du betreust das als Veranstalter.",
    pendingNote: "Deine Übernahme-Anfrage wartet auf Bestätigung. Bis dahin kannst du uns eine Korrektur schicken.",
    seriesClaim: {
      claimLink: "Du veranstaltest diese Serie? Übernimm sie",
      dialogTitle: "Serie übernehmen",
      dialogIntro: "Du veranstaltest {name}? Übernimm die ganze Serie und betreue jeden Lauf selbst.",
      editTitle: "Serie bearbeiten",
      editIntro: "Fehler bei {name} entdeckt, oder veranstaltest du sie? Der Veranstalter übernimmt die Serie und pflegt jeden Lauf selbst, alle anderen schicken uns eine Korrektur.",
      points: ["Du bearbeitest Termine, Links, Beschreibung, Strecken und Klassen jedes Laufs.", "Änderungen sind sofort online, und unsere automatischen Updates überschreiben sie nicht mehr.", "Die Serie und ihre Läufe bekommen das Abzeichen Vom Veranstalter bestätigt."],
      manage: "Serienverwaltung öffnen",
    },
  },
};
