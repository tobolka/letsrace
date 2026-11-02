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
    badge: "Ověřeno pořadatelem",
    badgeHelp: "Údaje spravuje přímo pořadatel závodu.",
    claimLink: "Pořádáš tento závod? Převezmi ho",
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
    badge: "Verified by the organiser",
    badgeHelp: "The race's organiser looks after these details.",
    claimLink: "Organising this race? Take it over",
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
    badge: "Overené organizátorom",
    badgeHelp: "Údaje spravuje priamo organizátor preteku.",
    claimLink: "Organizuješ tento pretek? Prevezmi ho",
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
    badge: "Zweryfikowane przez organizatora",
    badgeHelp: "Dane prowadzi bezpośrednio organizator wyścigu.",
    claimLink: "Organizujesz ten wyścig? Przejmij go",
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
    badge: "Vom Veranstalter bestätigt",
    badgeHelp: "Die Angaben pflegt der Veranstalter des Rennens selbst.",
    claimLink: "Du veranstaltest dieses Rennen? Übernimm es",
  },
};
