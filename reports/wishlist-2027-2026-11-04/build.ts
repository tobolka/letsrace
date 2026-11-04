/** Builds the reviewed manifest and apply.sql. Writes nothing to the database. Run from the repo root. */
import { writeFileSync } from "node:fs";
import { fingerprint, normalizeName, slugifyEvent } from "../../src/lib/domain";
import { practicalDetailsSchema } from "../../src/lib/practical-details";
const DIR = "reports/wishlist-2027-2026-11-04";
const CHECKED = "2026-11-04T21:30:00+01:00", V = "wishlist-2027-v1";
const STUPAVA = "9b37c02f-d50a-4493-8354-7a6ba59b3c0d", ARENA = "22d4849c-31d9-4aa2-baca-8f1e20bce1e6";
type Cat = { name: string; km?: number; up?: number; min?: number; max?: number; aud?: string };
type Ev = { key: string; id?: string; revision?: string; slug?: string; name: string; start: string; tz?: string; patch: Record<string, unknown>; cats?: Cat[]; practical?: Record<string, unknown>; locks: string[]; sources: { url: string; kind: string; quote: string; fields: string[] }[]; watch?: string[] };
const q = (quote: string) => quote;
const ev = (sourceUrl: string, quote: string, status: "current" | "year_neutral" = "current") => ({ sourceUrl, quote: q(quote), checkedAt: CHECKED, editionYear: 2027, status });
const venue = (name: string, streetAddress: string | undefined, postalCode: string | undefined, locality: string, countryCode: string, precision: "venue" | "start") => ({ name, ...(streetAddress ? { streetAddress } : {}), ...(postalCode ? { postalCode } : {}), locality, countryCode, precision });

const ST_HOME = "https://www.stupavskymaraton.sk/", ST_MTB = "https://www.stupavskymaraton.sk/inpage/mtb-maraton/", ST_JR = "https://www.stupavskymaraton.sk/inpage/junior-mtb/", ST_SPR = "https://www.stupavskymaraton.sk/inpage/mtb-sprint-biely-kriz-2024/", ST_OVER = "https://www.stupavskymaraton.sk/rubrika/skoda-stupava-maraton-2024/";
const OZ = { name: "Občianske združenie Maratón" };
const OA = "https://www.ostalbgravel.de/", OD = "https://www.datasport.de/anmeldeservice/ostalbgravel2027", OF = "https://www.ostalbgravel.de/alle-infos/anmeldung/", OS = "https://www.ostalbgravel.de/alle-infos/strecken/", OQ = "https://www.ostalbgravel.de/alle-infos/faq-s/";
const DH = "https://www.dirndltal-race.at/", DF = "https://www.dirndltal-race.at/funundtrophyrace", DA = "https://www.dirndltal-race.at/adventurerace", DK = "https://www.dirndltal-race.at/kids-und-youth-race";
const GH = "https://goodtimesgravel.at/", GB = "https://bikeboard.at/termine/good-times-gravel-termin16408", GW = "https://www.wienerwald.info/presse-202609-goodtimesgravel";
const SH = "https://szutrypremium.pl/", SZ = "https://szutrypremium.pl/zapisy-szutry/", SC = "https://szutrypremium.pl/ceny/", SR = "https://szutrypremium.pl/wp-content/uploads/2026/09/regulamin-2027.pdf";
const CH = "https://cyklomaratontour.cz/";

function szutry(key: string, id: string, revision: string, name: string, start: string, kms: number[], early: number, late: number, trasy: string, dates: string): Ev {
  return { key, id, revision, name, start, patch: {
    status: "registration_open", registration_url: SZ, registration_opens_at: "2026-09-20T22:00:00Z", regulations_url: SR, source_kind: "official",
    description: `Gravelový maraton ve Wrocławi nebo do 30 km od města, na ${kms.join(", ").replace(/, (\d+)$/, " a $1")} km. Délka tras se může lišit o 10 %. Zapisují se jen plnoletí, přesné místo startu pořadatel oznámí nejpozději 14 dní předem.`,
  }, cats: kms.map(km => ({ name: `${km} km`, km, min: 18 })), practical: {
    organizer: { ...ev(SR, "Organizatorem wydarzeń rowerowych Szutry Premium jest programersi.com sp. z o.o. z siedzibą we Wrocławiu"), value: { name: "programersi.com sp. z o.o.", url: SH } },
    fees: { ...ev(SC, "do 14.02.2027 – " + early + " zł; od 15.02.2027 – " + late + " zł; Obowiązuje jedna cena na wszystkie dystanse"), value: [{ label: "Všechny trasy", amount: early, currency: "PLN", validUntil: "2027-02-14" }, { label: "Všechny trasy od 15. 2. 2027", amount: late, currency: "PLN" }] },
    routes: { ...ev(trasy, `${dates} – WROCŁAW. Dystanse ${kms.length === 2 ? "100 i 200" : "100, 200, 300 i 400"} km.`), value: kms.map(km => ({ name: `${km} km`, distanceKm: km })) },
  }, locks: ["registration_url", "registration_opens_at", "regulations_url", "categories"], sources: [
    { url: SH, kind: "official", quote: "ZAPISY NA SEZON 2027 WYSTARTOWAŁY", fields: ["status", "registration_url"] },
    { url: SZ, kind: "official", quote: `${dates} ${kms.join("/")} km. ZAPIS - Edycja ${{ "szutry-w": "Wiosenna", "szutry-l": "Letnia", "szutry-j": "Jesienna" }[key]} 2027. Zapisz się`, fields: ["registration_url"] },
    { url: SC, kind: "official", quote: "START ZAPISÓW 21.09.2026", fields: ["registration_opens_at"] },
    { url: SR, kind: "official", quote: "Uczestnikiem Imprez może być wyłącznie osoba fizyczna, która najpóźniej w dniu rozpoczęcia danego wydarzenia sportowego ukończyła 18 lat", fields: ["regulations_url", "categories"] },
  ], watch: [SH] };
}

const CM_FEES = (a: number, b: number, c: number, d: number, label: string) => [{ label, amount: a, currency: "CZK", validUntil: "2026-12-31" }, { label, amount: b, currency: "CZK", validUntil: "2027-03-01" }, { label, amount: c, currency: "CZK", validUntil: "2027-05-27" }, { label: `${label} na místě`, amount: d, currency: "CZK", validUntil: "2027-05-30" }];
const CM_Q = "Online registrace - jen do 27.5.2027 do 18:00 nebo do naplnění limitu 1000; Aktuálně přihlášených 76 cyklistů na startu";
const CM_V = venue("Malšovická aréna", undefined, undefined, "Hradec Králové", "CZ", "venue");

const EVENTS: Ev[] = [
  { key: "ostalb", id: "0c5b3456-b536-4fe8-a834-c72d898303af", revision: "48bd5b56-f1ba-4714-9161-17a8b6ec849c", name: "Ostalb Gravel", start: "2027-04-11", patch: {
    event_type: "race", status: "registration_open", registration_url: OD, registration_opens_at: "2026-11-01T08:00:00Z", audience: "mixed", age_categories: ["u13", "u15", "u17", "amateur", "masters"], age_confidence: "explicit", source_kind: "official",
    description: "Gravel s měřeným časem na Ostalbu, start a cíl v hale 18 Spedition Brucker v Aalenu. Povolený je gravel i MTB včetně elektrokol. Krátká trasa od 12 let, dlouhá od 16 let, počet míst je omezený.",
  }, cats: [{ name: "Kurzstrecke 55 km", km: 55, up: 800, min: 12 }, { name: "Langstrecke 83 km", km: 83, up: 1400, min: 16 }], practical: {
    venue: { ...ev(OS, "Start für alle Strecken: Halle 18, Spedition Brucker GmbH, Daimlerstraße 15, 73430 Aalen"), value: venue("Halle 18, Spedition Brucker", "Daimlerstraße 15", "73430", "Aalen", "DE", "start") },
    organizer: { ...ev(OA, "Veranstalter: Ostalb Giro GmbH"), value: { name: "Ostalb Giro GmbH", url: OA } },
    schedule: { ...ev(OD, "So. 11.04.27 11:00 Uhr Kurzstrecke 55 km | ca. 800 hm So. 11.04.27 10:00 Uhr Langstrecke 83 km | 1.400 hm"), value: [{ label: "Langstrecke 83 km", date: "2027-04-11", time: "10:00", timeZone: "Europe/Berlin" }, { label: "Kurzstrecke 55 km", date: "2027-04-11", time: "11:00", timeZone: "Europe/Berlin" }] },
    fees: { ...ev(OF, "Teilnahmegebühr: 69 €; Ermäßigte Teilnahmegebühr (U18): 39 €"), value: [{ label: "Teilnahmegebühr", amount: 69, currency: "EUR" }, { label: "U18", amount: 39, currency: "EUR" }] },
    routes: { ...ev(OD, "Kurzstrecke 55 km | ca. 800 hm; Langstrecke 83 km | 1.400 hm"), value: [{ name: "Kurzstrecke", distanceKm: 55, elevationM: 800 }, { name: "Langstrecke", distanceKm: 83, elevationM: 1400 }] },
  }, locks: ["event_type", "registration_url", "registration_opens_at", "categories"], sources: [
    { url: OA, kind: "official", quote: "Am 11. April 2027 geht der Ostalb Gravel in Aalen an den Start. Willkommen sind Gravelbikes, Mountainbikes sowie E-Gravel- und E-Mountainbikes.", fields: ["start_date", "description"] },
    { url: OD, kind: "official", quote: "Ostalb Gravel am 11. April 2027. Kurzstrecke 55 km | ca. 800 hm, Langstrecke 83 km | 1.400 hm", fields: ["registration_url", "categories"] },
    { url: OF, kind: "official", quote: "Die Anmeldung erfolgt über unseren externen Dienstleister Datasport. Kurzstrecke: ab 12 Jahre; Langstrecke: ab 16 Jahre", fields: ["registration_url", "age_categories"] },
    { url: OQ, kind: "official", quote: "Ab dem 01.11.2026, 9 Uhr ist die Anmeldung für den Ostalb Gravel geöffnet. Die Wertung erfolgt nach Positionserfassung an den jeweiligen Kontrollpunkten.", fields: ["status", "registration_opens_at", "event_type"] },
  ], watch: [OA] },

  { key: "dirndltal", id: "d57834f6-a747-4237-9507-c7e3a41c63bc", revision: "b01a5ab4-a98f-48f2-9215-4cdb0370f829", name: "Dirndltal Race Gravel & MTB", start: "2027-09-18", patch: {
    website_url: DH, registration_url: null, disciplines: ["mtb", "xcm", "gravel"], formats: ["xcm"], audience: "mixed", age_categories: ["u7", "u9", "u11", "u13", "u15", "u17", "amateur"], age_confidence: "explicit", source_kind: "official", series_id: "44322b75-313d-4723-9ff0-8abab96b376d",
    description: "MTB a gravel v Laubenbachmühle u Frankenfelsu, kolo seriálu TopSix MTB Trophy. Fun Race, Trophy Race, Adventure Race ze St. Pöltenu s vlastní navigací podle GPS a dětské závody U7 až U15. Přímou přihlášku pro rok 2027 jsme zatím neověřili.",
  }, cats: [
    { name: "Fun Race 20 km", km: 20, up: 800 }, { name: "Trophy Race 40 km", km: 40, up: 1600 }, { name: "Adventure Race cca 100 km (MTB nebo gravel, GPS)", km: 100, up: 1800 },
    { name: "Kids U7 Laufrad", max: 6, aud: "kids" }, { name: "Kids U7", max: 6, aud: "kids" }, { name: "Kids U9", min: 7, max: 8, aud: "kids" }, { name: "Kids U11", min: 9, max: 10, aud: "kids" }, { name: "Youth U13", min: 11, max: 12, aud: "youth" }, { name: "Youth U15", min: 13, max: 14, aud: "youth" },
  ], practical: {
    venue: { ...ev(DF, "Start und Ziel direkt bei Betriebszentrum Laubenbachmühle ( Bahnhof der Mariazellerbahn ) in 3213 Frankenfels, Laubenbachgegend."), value: venue("Bahnhof Laubenbachmühle", undefined, "3213", "Frankenfels", "AT", "start") },
    organizer: { ...ev(DH, "Veranstalter ARBÖ RC Purgstall, Fasangartengasse 9, 3251 Purgstall"), value: { name: "ARBÖ RC Purgstall", url: "https://www.rcpurgstall.at/" } },
    schedule: { ...ev(DK, "Rennen 1: 09:30 Uhr - U7 Laufrad; Fun und Trophy Race ab 13:30 Uhr; Neutraler Start St. Pölten ab circa 10:00 Uhr"), value: [
      { label: "Kids und Youth Race", date: "2027-09-18", time: "09:30", timeZone: "Europe/Vienna", sourceUrl: DK, sourceQuote: "Rennen 1: 09:30 Uhr - U7 Laufrad" },
      { label: "Adventure Race, St. Pölten", date: "2027-09-18", time: "10:00", timeZone: "Europe/Vienna", approximate: true, sourceUrl: DA, sourceQuote: "St. Pölten Rathausplatz, ab circa 10:00 Uhr im Minutentakt" },
      { label: "Fun und Trophy Race", date: "2027-09-18", time: "13:30", timeZone: "Europe/Vienna", sourceUrl: DF, sourceQuote: "Fun und Trophy Race ab 13:30 Uhr" }] },
    fees: { ...ev(DK, "U7 bis U11 = kostenlos (freiwillige Spende); U13 bis U15 laut ÖRV = 11 Euro"), value: [
      { label: "Kids U7 bis U11", amount: 0, currency: "EUR", sourceUrl: DK, sourceQuote: "U7 bis U11 = kostenlos (freiwillige Spende)" }, { label: "Youth U13 bis U15", amount: 11, currency: "EUR", sourceUrl: DK, sourceQuote: "U13 bis U15 laut ÖRV = 11 Euro" },
      { label: "Fun Race", amount: 45, currency: "EUR", sourceUrl: DF, sourceQuote: "Fun Race : € 45,- (ab 16.09.2027 + € 10,- Nachnenngebühr" }, { label: "Fun Race Jugend (2009-2012)", amount: 40, currency: "EUR", sourceUrl: DF, sourceQuote: "Fun Race für Jugend (2009-2012): € 40,-" },
      { label: "Adventure Race", amount: 88, currency: "EUR", sourceUrl: DA, sourceQuote: "Startgebühr bis 10.9.2027 € 88,-" }] },
    routes: { ...ev(DH, "Fun Race 20km und 800hm; Trophy Race 40km 1600hm; Adventure Race rund 100 km und 1.800hm"), value: [{ name: "Fun Race", distanceKm: 20, elevationM: 800 }, { name: "Trophy Race", distanceKm: 40, elevationM: 1600 }, { name: "Adventure Race (Richtwert)", distanceKm: 100, elevationM: 1800, surface: "MTB oder Gravel" }] },
  }, locks: ["website_url", "categories", "age_categories", "age_confidence", "audience", "series_id"], sources: [
    { url: DH, kind: "official", quote: "18. September 2027. Das DTR ist Teil der MTB Trophy, niederösterreichs größter MTB Rennserie.", fields: ["start_date", "series_id", "website_url"] },
    { url: DF, kind: "official", quote: "Am Samstag, den 18. September 2027 ... im Rahmen der Top-Six MTB-Trophy. Trophy Race ca. 40km und ca. 1.600hm; Fun Race ca. 20km und ca. 800hm", fields: ["series_id", "categories"] },
    { url: DA, kind: "official", quote: "18 September 2027 / St. Pölten - Frankenfels. Distanz: rund 100km / Änderungen vorbehalten. Höhenmeter: rund 1.800 hm", fields: ["categories", "disciplines"] },
    { url: DK, kind: "official", quote: "Kids Race und Youth Race 2027. Rennen 1: U7 Laufrad; U7; U11 und U9; U15 und U13", fields: ["categories", "age_categories"] },
  ], watch: [DH, DK] },

  { key: "goodtimes", id: "8439de52-4a9f-4bb7-a55b-92032d905a6a", revision: "44688aaa-28f4-42a4-b08f-d30bdd0a3916", name: "Good Times Gravel", start: "2027-09-25", patch: {
    event_type: "race", registration_url: null, source_kind: "official",
    description: "Gravel v jižním Vídeňském lese s měřenými úseky, jejichž časy tvoří výsledkové pořadí. Krátká trasa má přibližně 50 km a 3 úseky, dlouhá přibližně 85 až 92 km a 6 úseků; zdroje se v délce liší a trasy pro rok 2027 pořadatel zatím výslovně nepotvrdil. Přihlášky na rok 2027 zatím nejsou otevřené.",
  }, cats: [{ name: "Krátká trasa cca 50 km, 3 měřené úseky", km: 50, up: 900 }, { name: "Dlouhá trasa cca 85–92 km, 6 měřených úseků", km: 85, up: 1600 }], practical: {
    venue: { ...ev(GH, "This is the event location – Freizeitgelände, Maria Enzersdorf", "year_neutral"), value: venue("Freizeitgelände", undefined, "2344", "Maria Enzersdorf", "AT", "venue") },
    organizer: { ...ev(GB, "Ort 2344 Maria Enzersdorf, Niederösterreich. Veranstalter BikeSchneiderei e.U."), value: { name: "BikeSchneiderei e.U.", url: GH } },
  }, locks: ["event_type", "categories"], sources: [
    { url: GH, kind: "official", quote: "See you on 25.09.2027! Some segments are timed. You compete on the timed and marked segments for the fastest overall time.", fields: ["start_date", "event_type"] },
    { url: GW, kind: "official", quote: "Save the Date für 25.9.2027 für more „good time gravel“ im Wienerwald.", fields: ["start_date"] },
    { url: GB, kind: "aggregator", quote: "Samstag 25 September 2027. Kurze Strecke 50 km 900 hm; Lange Strecke 85 km 1.600 hm; sechs gezeitete Segmente; drei gezeiteten Segmenten", fields: ["categories"] },
    { url: "https://www.tickettailor.com/all-tickets/radsportunionmariaenzersdorf/", kind: "official", quote: "There are no events listed at the moment. Please check back soon.", fields: ["registration_url"] },
  ], watch: [GH] },

  szutry("szutry-w", "c9bd52a6-5c75-4b18-a747-87cb7595e874", "614884f9-0218-4e57-a9a6-70a1eb95d70a", "Wiosenne Szutry Premium", "2027-04-17", [100, 200], 249, 299, "https://szutrypremium.pl/trasy-edycja-wiosenna/", "17.04.2027"),
  szutry("szutry-l", "87b2f415-1481-43d7-91b3-03d959d0ca6a", "ad1be375-2a91-48ae-82e1-32780a0c281c", "Letnie Szutry Premium", "2027-07-31", [100, 200, 300, 400], 349, 399, "https://szutrypremium.pl/trasy-edycja-letnia/", "31.07.2027"),
  szutry("szutry-j", "0eadbfa6-38ce-46f5-bec9-820da406dba3", "832370cb-ae85-48fb-aa51-2444d02c6d04", "Jesienne Szutry Premium", "2027-09-25", [100, 200], 249, 299, "https://szutrypremium.pl/trasy-edycja-jesienna/", "25.09.2027"),

  { key: "cyklomaraton", id: "f1d40430-b0ae-4dcf-9b94-0288fd48e3b4", revision: "c40ae788-90d6-4512-9670-4ffd49fc89ff", name: "Decathlon Cyklomaraton Hradec Králové", start: "2027-05-30", patch: {
    status: "registration_open", website_url: CH, registration_url: CH, registration_closes_at: "2027-05-27T16:00:00Z", location_id: ARENA, disciplines: ["mtb", "xcm", "gravel"], formats: ["xcm"], age_categories: ["u17", "amateur", "masters"], age_confidence: "explicit", source_kind: "official",
    description: "25. ročník závodu se startem a cílem v Malšovické aréně. MTB na 60 a 30 km a gravel na 30 km. Online přihláška je otevřená do 27. 5. 2027 do 18:00 nebo do naplnění limitu 1 000 závodníků; do systému EventReg vede tlačítko na stránce pořadatele. Dětské závody mají vlastní záznam NN Kids Race.",
  }, cats: [{ name: "MTB 60 km", km: 60, min: 15 }, { name: "MTB 30 km", km: 30, min: 15 }, { name: "Gravel 30 km", km: 30, min: 15 }], practical: {
    venue: { ...ev(CH, "Místo Malšovická Aréna. Místo prezentace Hradec Králové"), value: CM_V },
    organizer: { ...ev(CH, "Kontakt EVENT media s.r.o., Kaprova 42/14, 110 00 Praha 1"), value: { name: "EVENT media s.r.o.", url: CH } },
    schedule: { ...ev(CH, "12:00 START DECATHLON CYKLOMARATON HRADEC KRÁLOVÉ 6Okm; 12:20 START 30 km"), value: [{ label: "Start 60 km", date: "2027-05-30", time: "12:00", timeZone: "Europe/Prague" }, { label: "Start 30 km", date: "2027-05-30", time: "12:20", timeZone: "Europe/Prague" }] },
    fees: { ...ev(CH, "Startovné 2027: do 31.12.2026 750 Kč; do 1.3.2027 800 Kč; do 27.5.2027 900 Kč; na místě 1000 Kč"), value: CM_FEES(750, 800, 900, 1000, "Dospělí 60 a 30 km") },
    routes: { ...ev(CH, "60 km DECATHLON CYKLOMARATON Hradec Králové; 30 km krátký závod; 30 km krátký závod + Gravel"), value: [{ name: "MTB 60 km", distanceKm: 60 }, { name: "MTB 30 km", distanceKm: 30 }, { name: "Gravel 30 km", distanceKm: 30 }] },
  }, locks: ["registration_url", "registration_closes_at", "website_url", "status", "disciplines", "formats", "age_categories", "age_confidence", "categories", "description", "location_id"], sources: [
    { url: CH, kind: "official", quote: "Neděle 30. května 2027. " + CM_Q + ". Malšovická Aréna. 30 km krátký závod + Gravel.", fields: ["status", "registration_url", "registration_closes_at", "disciplines", "categories", "location_id"] },
  ], watch: [CH] },

  { key: "nnkids", id: "00862df3-deff-45d8-816b-13a72191e6b9", revision: "bc40410a-67e6-404c-8fde-dc983f92be8b", name: "NN KIDS RACE", start: "2027-05-30", patch: {
    status: "registration_open", website_url: CH, registration_url: CH, registration_closes_at: "2027-05-27T16:00:00Z", regulations_url: "https://cyklomaratontour.cz/informace/dulezite-informace/pravidla-zavodu.html", disciplines: ["mtb"], audience: "kids", age_categories: ["kids", "u7", "u9", "u11", "u13", "u15"], age_confidence: "explicit", source_kind: "official",
    description: "Dětské MTB závody u Decathlon Cyklomaratonu v Malšovické aréně, v kategoriích od 2 do 14 let a s limitem 200 dětí. Roky narození v kategoriích pořadatel na stránce uvádí rozdílně, proto je nepřebíráme.",
  }, cats: [{ name: "NN Kids Race 2–14 let", min: 2, max: 14, aud: "kids" }], practical: {
    venue: { ...ev(CH, "NN KIDS RACE 2027, Hradec Králové - Malšovická aréna, 30.5.2027"), value: CM_V },
    organizer: { ...ev(CH, "Kontakt EVENT media s.r.o., Kaprova 42/14, 110 00 Praha 1"), value: { name: "EVENT media s.r.o.", url: CH } },
    schedule: { ...ev(CH, "10:00 - 11:00 Start Dětských závodů NN Kids Race - starty dle kategorií"), value: [{ label: "Start dětských závodů", date: "2027-05-30", time: "10:00", timeZone: "Europe/Prague" }] },
    fees: { ...ev(CH, "NN Kids race: do 31.12.2026 250 Kč; do 1.3.2027 300 Kč; do 27.5.2027 350 Kč; na místě 400 Kč"), value: CM_FEES(250, 300, 350, 400, "NN Kids Race") },
  }, locks: ["registration_url", "registration_closes_at", "website_url", "disciplines", "audience", "age_categories", "age_confidence", "categories"], sources: [
    { url: CH, kind: "official", quote: "Jsou připravené kategorie od 2 let do 14 let. CELKOVÝ LIMIT JE 200 DĚTÍ. NN Kids Race MTB - dětské závody", fields: ["disciplines", "age_categories", "categories", "registration_url"] },
  ] },

  { key: "stupava-mtb", name: "BAJKSERVIS Stupava maratón MTB", start: "2027-06-19", tz: "Europe/Bratislava", patch: {
    location_id: STUPAVA, disciplines: ["mtb", "xcm"], formats: ["xcm"], status: "scheduled", visibility: "public", event_type: "race", competition_type: "community", level: "local", season: "2027", audience: "mixed", age_categories: ["u15", "u17", "junior", "amateur", "masters"], age_confidence: "explicit", source_kind: "official", website_url: ST_MTB, registration_url: null,
    description: "21. ročník MTB maratónu v Malých Karpatech na tratích 78, 42, 25 a 7 km, se samostatným startem elektrokol na 42 km. Pořadatel ho uvádí v Župném a Slovenském poháru. Přihláška pro rok 2027 zatím vede na loňský ročník, proto ji neuvádíme. Doprovodný běh není součástí tohoto záznamu.",
  }, cats: [{ name: "Dlhá trať 78 km", km: 78, up: 1900, min: 19 }, { name: "Stredná trať 42 km", km: 42, up: 950, min: 17 }, { name: "Stredná trať 42 km E-bike", km: 42, up: 950, min: 17 }, { name: "Krátka trať 25 km", km: 25, up: 500 }, { name: "Family trať 7 km", km: 7, up: 120 }], practical: {
    venue: { ...ev(ST_MTB, "Miesto: Stupava, Penzión INTENZÍVA/BAJKSERVIS (Nová ulica 66)."), value: venue("Penzión INTENZÍVA / BAJKSERVIS", "Nová ulica 66", undefined, "Stupava", "SK", "venue") },
    organizer: { ...ev(ST_HOME, "USPoriadateĽ Občianske združenie Maratón, Štúrova 50, 900 33 Marianka"), value: { ...OZ, url: ST_HOME } },
    schedule: { ...ev(ST_MTB, "10:00 Dlhá trať MTB 78 km; 10:40 Stredná trať MTB 42 km E-bike; 11:00 Stredná trať MTB 42 km; 11:30 Krátka trať MTB 25 km; 11:40 Family trať MTB 7km"), value: [["Dlhá trať 78 km", "10:00"], ["Stredná trať 42 km E-bike", "10:40"], ["Stredná trať 42 km", "11:00"], ["Krátka trať 25 km", "11:30"], ["Family trať 7 km", "11:40"]].map(([label, time]) => ({ label, date: "2027-06-19", time, timeZone: "Europe/Bratislava" })) },
    fees: { ...ev(ST_MTB, "uhradené od 1.12. 2026 do polnoci 31.3. 2027 - 35 €"), value: [{ label: "Uhradené do 31. 3. 2027", amount: 35, currency: "EUR", validUntil: "2027-03-31" }] },
    routes: { ...ev(ST_MTB, "Maratón - dlhá trať - 78 km, Prevýšenie 1900m; stredná trať - 42km, 950m; krátka trať - 25km, 500m; family trať - 7km, 120m"), value: [{ name: "Dlhá trať", distanceKm: 78, elevationM: 1900 }, { name: "Stredná trať", distanceKm: 42, elevationM: 950 }, { name: "Krátka trať", distanceKm: 25, elevationM: 500 }, { name: "Family trať", distanceKm: 7, elevationM: 120 }] },
  }, locks: ["disciplines", "start_date", "end_date", "website_url", "categories"], sources: [
    { url: ST_MTB, kind: "official", quote: "BAJKSERVIS Stupava maraton MTB&RUN 2027. Kedy: sobota 19.06.2027. 21.ročník vytrvalostných pretekov horských bicyklov", fields: ["start_date", "disciplines", "categories"] },
    { url: ST_OVER, kind: "official", quote: "MTB maratón 2027. Kedy: 19.06.2027. Miesto: Stupava, BAJKSERVIS (Nová ulica 66).", fields: ["start_date", "location_id"] },
    { url: ST_HOME, kind: "official", quote: "V sobotu preteky na horských bicykloch pre dospelých.", fields: ["event_type"] },
  ], watch: [ST_MTB] },

  { key: "stupava-kids", name: "Detský MTB cyklomaratónik Stupava", start: "2027-06-20", tz: "Europe/Bratislava", patch: {
    location_id: STUPAVA, disciplines: ["mtb"], formats: [], status: "scheduled", visibility: "public", event_type: "race", competition_type: "community", level: "local", season: "2027", audience: "kids", age_categories: ["kids", "u7", "u9", "u11", "u13", "u15"], age_confidence: "explicit", source_kind: "official", website_url: ST_JR, registration_url: null, registration_closes_at: "2027-06-17T21:59:00Z",
    description: "Dětský MTB závod v areálu BAJKSERVIS a ve Stupavském parku. Kategorie jsou od odrážedel po starší žáky narozené v letech 2013 a 2014. Přihláška pro rok 2027 zatím není ověřená.",
  }, cats: [{ name: "BABY odrážedla, nar. 2023 a později", km: 0.1, max: 4, aud: "kids" }, { name: "MIKRO, nar. 2021–2022", km: 0.4, min: 5, max: 6, aud: "kids" }, { name: "MILI, nar. 2019–2020", km: 0.8, min: 7, max: 8, aud: "kids" }, { name: "MINI, nar. 2017–2018", km: 1.2, min: 9, max: 10, aud: "kids" }, { name: "Mladší žáci a žákyně, nar. 2015–2016", km: 6, min: 11, max: 12, aud: "youth" }, { name: "Starší žáci a žákyně, nar. 2013–2014", km: 6, min: 13, max: 14, aud: "youth" }], practical: {
    venue: { ...ev(ST_OVER, "DETSKÝ MTB CYKLOMARATÓNIK. Kedy: 20.6.2027. Miesto: BAJKSERVIS (Nová ulica 66)"), value: venue("BAJKSERVIS", "Nová ulica 66", undefined, "Stupava", "SK", "venue") },
    organizer: { ...ev(ST_HOME, "USPoriadateĽ Občianske združenie Maratón, Štúrova 50, 900 33 Marianka"), value: { ...OZ, url: ST_HOME } },
    schedule: { ...ev(ST_JR, "Štart 11:00 kategória BABY a ostatné následne"), value: [{ label: "Start kategorie BABY, ostatní následně", date: "2027-06-20", time: "11:00", timeZone: "Europe/Bratislava" }] },
    fees: { ...ev(ST_JR, "cez online registráciu - 7€; uhradené v mieste konania - 10€"), value: [{ label: "Online", amount: 7, currency: "EUR" }, { label: "Na místě", amount: 10, currency: "EUR" }] },
  }, locks: ["disciplines", "start_date", "end_date", "audience", "website_url", "categories"], sources: [
    { url: ST_JR, kind: "official", quote: "DETSKÝ MTB CYKLOMARATÓNIK. Kdy: 20.06.2027. Na preteky sa môžete prihlásiť cez online registráciu do 17.06. 2027 23:59 hod.", fields: ["start_date", "categories", "registration_closes_at"] },
    { url: ST_HOME, kind: "official", quote: "V nedeľu samostatný alebo kombinačný beh a juniorský a detský cyklomaratónik.", fields: ["event_type"] },
  ], watch: [ST_JR] },

  { key: "stupava-sprint", name: "BAJKSERVIS Stupava MTB sprint Biely kríž", start: "2027-08-29", tz: "Europe/Bratislava", patch: {
    location_id: STUPAVA, disciplines: ["mtb", "tt", "hill_climb"], formats: [], status: "scheduled", visibility: "public", event_type: "race", competition_type: "community", level: "local", season: "2027", audience: "mixed", age_categories: ["u17", "junior", "amateur", "masters"], age_confidence: "explicit", source_kind: "official", website_url: ST_SPR, registration_url: null, registration_closes_at: "2027-08-28T10:00:00Z",
    description: "MTB časovka do vrchu ze Stupavy na Biely kríž po lesních cestách a singletracích, 11 km a 400 m převýšení. Startuje se v minutových intervalech. Online uzávěrka je 28. 8. 2027 ve 12:00, formulář pro rok 2027 ale zatím není ověřený.",
  }, cats: [{ name: "Kadeti a kadetky 15–16 let", km: 11, up: 400, min: 15, max: 16, aud: "youth" }, { name: "Junioři a juniorky 17–18 let", km: 11, up: 400, min: 17, max: 18, aud: "youth" }, { name: "Dospělí 19–59 let", km: 11, up: 400, min: 19, max: 59, aud: "adults" }, { name: "Veteráni 60+", km: 11, up: 400, min: 60, aud: "adults" }, { name: "E-bike open", km: 11, up: 400 }], practical: {
    venue: { ...ev(ST_SPR, "Kde Stupava, Penzión INTENZÍVA/BAJKSERVIS (Nová ulica 66). Cieľ Biely Kríž / CHATA KLINEC"), value: venue("BAJKSERVIS, cíl Biely kríž / Chata Klinec", "Nová ulica 66", undefined, "Stupava", "SK", "start") },
    organizer: { ...ev(ST_HOME, "USPoriadateĽ Občianske združenie Maratón, Štúrova 50, 900 33 Marianka"), value: { ...OZ, url: ST_HOME } },
    schedule: { ...ev(ST_SPR, "E-bike 10:30; MTB 11:00 v 1 minútových intervaloch"), value: [{ label: "E-bike", date: "2027-08-29", time: "10:30", timeZone: "Europe/Bratislava" }, { label: "MTB", date: "2027-08-29", time: "11:00", timeZone: "Europe/Bratislava" }] },
    fees: { ...ev(ST_SPR, "štartovné prevodom do 27.08.2027 20€; štartovné v hotovosti od 28.08.2027 do 29.08.2027 10:00 25€"), value: [{ label: "Převodem", amount: 20, currency: "EUR", validUntil: "2027-08-27" }, { label: "V hotovosti", amount: 25, currency: "EUR", validUntil: "2027-08-29" }] },
    routes: { ...ev(ST_SPR, "11km/400m prevýšenie"), value: [{ name: "Stupava – Biely kríž", distanceKm: 11, elevationM: 400 }] },
  }, locks: ["disciplines", "start_date", "end_date", "website_url", "categories"], sources: [
    { url: ST_SPR, kind: "official", quote: "MTB sprint Biely kríž 2027. 29.08.2027. Na preteky sa môžete prihlásiť cez online registráciu do 28.08. 2027, 12:00 hod", fields: ["start_date", "registration_closes_at", "categories"] },
    { url: ST_HOME, kind: "official", quote: "BAJKSERVIS stupava MTB SPRINT 2027. Časovka určená pre horské bicykle so štartom zo Stupavy na Bilely Kríž po lesných cestách a singletrack och. Štartuje sa v minútových intervaloch.", fields: ["disciplines"] },
  ], watch: [ST_SPR] },
];

const lit = (v: unknown): string => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return String(v);
  if (typeof v === "string") { const tag = "$lr$"; if (v.includes(tag)) throw new Error("tag"); return `${tag}${v}${tag}`; }
  return `${lit(JSON.stringify(v))}::jsonb`;
};
const arr = (v: string[]) => v.length ? `array[${v.map(lit).join(",")}]::text[]` : "array[]::text[]";
const col = (k: string, v: unknown) => Array.isArray(v) ? arr(v as string[]) : (k.endsWith("_id") && v ? `${lit(v)}::uuid` : (k.endsWith("_at") && v ? `${lit(v)}::timestamptz` : lit(v)));
const LAT = 48.2795206, LNG = 17.0487959;
const id3 = { "stupava-mtb": "3e2b7f10-6a54-4d1e-9c11-7f0b1a2c3d01", "stupava-kids": "3e2b7f10-6a54-4d1e-9c11-7f0b1a2c3d02", "stupava-sprint": "3e2b7f10-6a54-4d1e-9c11-7f0b1a2c3d03" } as Record<string, string>;
const manifest: unknown[] = [];
const blocks: string[] = [];
for (const e of EVENTS) {
  const practical = e.practical ? practicalDetailsSchema.parse(e.practical) : undefined;
  const patch: Record<string, unknown> = { ...e.patch };
  const id = e.id ?? id3[e.key]!;
  let slug = e.slug;
  const cats = (e.cats ?? []).map(c => ({ n: c.name, k: c.km, u: c.up, a: c.min, b: c.max, g: c.aud }));
  const srcs = e.sources.map(s => ({ u: s.url, k: s.kind, q: s.quote, f: s.fields }));
  const o: string[] = [`do $do$ declare v uuid:='${id}'; c jsonb:=${lit(JSON.stringify(cats))}; s jsonb:=${lit(JSON.stringify(srcs))}; l text[]:=${arr(e.locks)}; r jsonb; begin`, "perform pg_advisory_xact_lock(hashtext('wishlist-2027-2026-11-04'));"];
  if (e.id) o.push(`perform 1 from events where id=v and public_revision='${e.revision}' and merged_into_id is null for update; if not found then raise exception 'changed since review: ${e.key}'; end if;`);
  else o.push(`if exists(select 1 from events x left join locations m on m.id=x.location_id where x.start_date='${e.start}' and x.merged_into_id is null and (m.municipality='Stupava' or x.website_url ilike '%stupavskymaraton%')) then raise exception 'now exists: ${e.key}'; end if;`);
  if (e.key === "cyklomaraton") o.push(`update locations set municipality='Hradec Králové',venue='Malšovická aréna',region='Královéhradecký kraj',updated_at=now() where id='${ARENA}' and municipality='Malšovická aréna';`);
  if (!e.id) {
    slug = slugifyEvent(e.name, e.start);
    const row: Record<string, unknown> = { slug, name: e.name, name_normalized: normalizeName(e.name), fingerprint: fingerprint({ startDate: e.start, name: e.name, lat: LAT, lng: LNG }), start_date: e.start, end_date: e.start, timezone: e.tz, ...patch };
    if (practical) row.practical_details = practical;
    const k = Object.keys(row);
    o.push(`insert into events(id,${k.join(",")}) values(v,${k.map(c => c === "start_date" || c === "end_date" ? `'${row[c]}'::date` : col(c, row[c])).join(",")});`);
  } else {
    const set = Object.keys(patch).map(k => `${k}=${col(k, patch[k])}`);
    if (practical) set.push(`practical_details=${lit(practical)}`);
    set.push("updated_at=now()", "last_seen_at=now()");
    o.push(`update events set ${set.join(",")} where id=v;`);
  }
  o.push(`delete from event_categories where event_id=v;`);
  o.push(`insert into event_categories(event_id,name,distance_km,elevation_m,age_min,age_max,audience) select v,n,k,u,a,b,coalesce(g,'mixed') from jsonb_to_recordset(c) x(n text,k float8,u float8,a int,b int,g text);`);
  o.push(`select to_jsonb(e) into r from events e where id=v;`);
  o.push(`insert into event_sources(event_id,source_url,external_id,is_canonical,kind) select v,x.u,'${"wishlist-2027-" + e.key}-'||row_number() over (),false,x.k from jsonb_to_recordset(s) x(u text,k text) where not exists(select 1 from event_sources z where z.event_id=v and z.source_url=x.u);`);
  o.push(`insert into event_facts(event_id,field,value,source_url,quote,method,version) select v,fl,case when fl='categories' then c else coalesce(r->fl,'null'::jsonb) end,x.u,x.q,'manual_source_review','${V}' from jsonb_to_recordset(s) x(u text,q text,f text[]) cross join lateral unnest(x.f) fl;`);
  o.push(`insert into event_overrides(event_id,fields,locked_fields,updated_by) select v,(select jsonb_object_agg(lk,case when lk='categories' then (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('name',y.n,'distanceKm',y.k,'ageMin',y.a,'ageMax',y.b))) from jsonb_to_recordset(c) y(n text,k float8,a int,b int)) else coalesce(r->lk,'null'::jsonb) end) from unnest(l) lk),l,'owner wishlist 2027 review 2026-11-04' on conflict(event_id) do update set fields=event_overrides.fields||excluded.fields,locked_fields=array(select distinct q from unnest(event_overrides.locked_fields||excluded.locked_fields) q),updated_by=excluded.updated_by,updated_at=now();`);
  if (e.watch?.length) o.push(`insert into watched_urls(url,kind,added_by,notes) select w,'race','owner-wishlist-2026-11-04','Organiser page for the 2027 edition; reviewed by hand' from unnest(${arr(e.watch)}) w on conflict(url) do nothing;`);
  o.push("end $do$;");
  blocks.push(`-- ${e.key}\n` + o.join("\n"));
  manifest.push({ key: e.key, id, slug: slug ?? null, name: e.name, start: e.start, action: e.id ? "updated" : "created", locks: e.locks, patch, categories: e.cats ?? null, practical: practical ?? null, sources: e.sources });
}
writeFileSync(`${DIR}/apply.sql`, blocks.join("\n\n") + "\n");
writeFileSync(`${DIR}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
console.log(blocks.map((b, i) => `${i} ${EVENTS[i]!.key} ${Buffer.byteLength(b)}`).join("\n"));
