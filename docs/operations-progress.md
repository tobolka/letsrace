# Zjednodušení provozu LetsRace — stav realizace

Aktualizováno 3. listopadu 2026. Číslování odpovídá původním sedmi etapám. Jednotlivá dokončená oprava neznamená dokončenou etapu. Původní časové odhady se nepoužívají.

| Etapa | Dokončená část | Co ještě chybí | Celkový stav |
|---|---|---|---|
| **0. Společná pravidla a výchozí měření** | Server a Mac stejně rozlišují skutečnou chybu, nepodporované čtení a odloženou práci. | Nezávislé výchozí měření správnosti/pokrytí a dokončení kontroly všech pravidelných zapisovačů. | Částečně |
| **1. Jednoduchý přehled a panel** | Na Macu jeden stav a poslední výsledek; „Co systém dělá“ vysvětluje čtyři činnosti. Webový `/admin` má stejný účel, oddělené servisní nástroje a soukromou schránku s ochranou zastaralých odpovědí. | Automatické vytváření a provedení jednotlivých typů rozhodnutí; prázdná schránka sama nedokazuje samostatný provoz. | Částečně |
| **2. Trvalé řízení práce** | Čekající podklady mají společně uložené další pokusy, převzetí s expirací a ochranu souběžné změny rozhodnutí. | Společné řízení všech druhů práce mezi serverem a Macem, priority a bezpečné pokračování všech zapisovacích kroků. Vazby hlavního i vedlejšího seriálu již mají společný transakční zápis. | Částečně |
| **3. Společné ověření a zveřejnění** | Posouzení kandidátů kontroluje podklad v zapisovači. Úpravy pořadatele mají společný transakční zápis. Změny závodů a míst vytvářejí trvalou práci s kontrolou veřejného detailu. Společný seznam/mapa/kalendář mají samostatnou dávku s porovnáním celého veřejného seznamu proti databázi; první dávka na produkci ověřila 1 006 závodů. | Ostatní zapisovací cesty, úplnost změn vedlejších vazeb a zvládnutí nahromaděných kontrol jednotlivých detailů v zachovaném limitu 60 pokusů za den. Požadavky na aktualizaci jsou nově samostatné, dávkované a mají vlastní účtenky; vyžádání není ověření výsledku. | Částečně |
| **4. Automatické řešení podkladů a duplicit** | Existují dílčí opravy konkrétních duplicit a bezpečnostní pravidla; opakované čtení podkladů již běží. | Samostatné posouzení podkladů, řešení rozporů a jednotné podmínky automatického slučování. Opakované čtení není vyřešený případ. | Nedokončeno |
| **5. Lepší pokrytí a doplňování** | U detailů Bikepointu kontrola následuje skutečně odkazované pořadatele. Na Jarném šprintu a BikeFestu ověřeno načtení a uložení podkladů, ne pravdivost termínu. | Systematické hledání chybějících ročníků a mezer po zemích/disciplinách, měřený přínos a dokončení ověřování nových údajů. | Nedokončeno |
| **6. Nezávislé ověření zlepšení** | Průběžně běží regresní a provozní testy. | Oddělená kontrolní sada, porovnání skutečné správnosti a pokrytí, nákladů a práce vlastníka. Testy kódu toto nenahrazují. | Nezahájeno |

## Hranice současné automatizace

- Čekající podklad není automaticky otázka pro vlastníka.
- Změna stránky ani úspěšné přečtení nejsou ověřený údaj.
- Zápis do katalogu není potvrzený veřejný výsledek. Kontrola detailu navíc neprokazuje aktualizaci společného seznamu ani pravdivost zdrojového údaje.
- Modelový návrh není zdroj pravdy a opakovaný pokus není souhlas se zveřejněním.
- Žádná ze sedmi etap zatím není dokončená v celém původním rozsahu.

## Právě dokončená změna v etapě 3

`validateReviewSource` používá náhled i `ingestReviewedCandidate` před prvními zápisy. Zapisovač znovu čte zdroj, takže starý náhled není důkazem aktuálního stavu. U textového důkazu musí každá citovaná část skutečně existovat v dokumentu; strukturovaná karta se kontroluje jako skutečný HTML fragment včetně údaje o roku. Nesoulad kontrolu zastaví. Tato změna sama nepublikuje žádný z čekajících podkladů a nedokončuje samostatné rozhodování AI.

Přehled běžného provozu: [keep-fresh.md](keep-fresh.md). Pravidla ročníků: [annual-editions.md](annual-editions.md).

Nasazený přehled a jeho přesné hranice: [výsledek změny adminu](../reports/owner-admin-2026-11-02/RESULT.md). Společné zveřejnění: [výsledek a důkazy](../reports/aggregate-publication-2026-11-02/RESULT.md). Další konkrétní práce: oprava zbývajících chyb čtení, kontrola seznamu dodaných závodů proti dnešní databázi a následně ostatní zapisovače a nezávislá kontrolní sada.

## Pokračování 3. listopadu

Opraveno čtení oficiálních zdrojů, Chotěbuz ověřena bez nové duplicity a Mac aktualizován na `7a591cbd`. Dávka závodů z přílohy již byla importována; aktuální inventura potvrdila hlavní záznamy. Nové praktické údaje mají samostatné podklady po jednotlivých položkách a zápis se zámky; první skutečně uložené příklady jsou adresa JBC a program/startovné/trasy Podkrkonošského maratonu. Není tím dokončeno plošné doplnění katalogu ani nezávislé měření. Aktuální úkoly a hranice: [tracker](work-tracker-2026-11-03.md).

## Dokončená návaznost seriálů

Změna názvu, adresy, viditelnosti či kategorií seriálu nově vytvoří trvalý požadavek na aktualizaci jeho stránky; vložené údaje seriálu zároveň změní veřejnou verzi příslušných závodů. Změna termínu, viditelnosti nebo přiřazení kola aktualizuje i starý a nový seriál. Zachovávají se staré adresy při přejmenování. Pouhé hlášení času přečtení nové úkoly nevytváří.

Požadavky používají stávající dávku nejvýše 200 položek a stejný limit čtyř pokusů za 24 hodin. Potvrzení požadavku na seriál není potvrzením správného veřejného obsahu. Zkouška v databázi ověřuje vložení, přejmenování, přesun kola, smazání, souběh verzí a návrat celé transakce. Tím je uzavřena tato konkrétní mezera etapy 3, nikoli celá etapa.

Zbývající konkrétní práce: transakční zápis kandidátů a hlavního sběrače, audit ostatních přímých zapisovačů, vykonávání rozhodnutí ze schránky, samostatné řešení bezpečných shod a nezávislá sada pro měření pokrytí a pravdivosti. Tyto body se neoznačují jako hotové na základě úprav přehledu nebo běžných regresních testů.

Další dokončený krok: [společný zápis vazeb seriálů](../reports/atomic-series-membership-2026-11-03/RESULT.md). Selhání ukládání historie vrátí celý zápis, ruční zámky zůstávají respektované a vedlejší vazby se promítají do přehledu seriálu. Hlavní import a kandidáti zůstávají samostatné nedokončené zapisovací cesty.

## Další opravené zapisovací cesty

Doplňování prázdné disciplíny z hlavního seriálu ukládá údaj, původ a požadavek na zveřejnění společně. Bere aktuální stav pod zámkem, chrání ruční zámky a již vyplněné údaje; počet doplnění potvrzuje databáze. Výběr omezuje až způsobilé závody, takže jej nezaplní prvních 3 000 již vyplněných záznamů.

Návrat jedné doložené automatické změny je také společná operace. Změna údaje nebo odstranění původně vložených kategorií se vrátí při selhání zápisu historie. Novější opravy, ruční zámky, sloučené závody a později přidané kategorie zůstávají chráněné. Návrat celé dříve nahrazené sady kategorií zatím není podporován; tento případ zůstává beze změny s konkrétním důvodem.

Čtenář zdrojů nově kontroluje i přijetí výsledku a opakovaného pokusu. Odmítnuté dokončení po změně adresy nebo vypršení převzetí se nehlásí jako úspěšný běh. To samo ještě nezajišťuje transakčnost hlavního importu ani nezastaví již zahájené zápisy po ztrátě převzetí.

Zkoušky včetně úmyslného selhání a produkčních náhledů: [výsledek](../reports/atomic-catalog-writes-2026-11-03/RESULT.md). Etapy 2 a 3 zůstávají částečné; hlavní import, kandidáti, vykonávání rozhodnutí a nezávislá kontrolní sada zůstávají na seznamu.

Navazující krok v hlavním sběrači: změna **existujícího** závodu a historie jednotlivých změněných údajů se nyní ukládají společně. Zapisovač znovu kontroluje aktuální ruční zámky, sloučení a veřejnou verzi závodu. Starý návrh po souběžné změně odloží k novému výpočtu, nikoli ke schválení vlastníkem. Kolize jedinečného klíče zachová klíč původního záznamu a nedotkne se jeho jiného vlastníka. Nový závod, místa, zdrojové vazby, kategorie a následná upozornění zatím nejsou jeden společný zápis. [Důkazy a hranice](../reports/atomic-watcher-update-2026-11-03/RESULT.md).

## Rozšíření skutečného doplňování údajů

Bezplatná čtečka nově podporuje i tabulky údaj/hodnota s výslovným závodem a termínem ročníku. Z propozic Rohálovské 2027 uložila pořadatele a hlavní start 12:30, každý s vlastním podkladem. Sběr více dokumentů zachovává jejich různé položky místo nahrazení celé sady posledním dokumentem. Při dosažení limitu čtení zůstává práce výslovně částečná a pořadí následných odkazů se při dalších pokusech střídá. [Výsledek](../reports/practical-reader-v3-2026-11-03/RESULT.md). Toto je další dílčí krok etapy 5, nikoli dokončené plošné doplnění ani nezávislé měření pravdivosti.
