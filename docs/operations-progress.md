# Zjednodušení provozu LetsRace — stav realizace

Aktualizováno 2. listopadu 2026. Číslování odpovídá původním sedmi etapám. Jednotlivá dokončená oprava neznamená dokončenou etapu. Původní časové odhady se nepoužívají.

| Etapa | Dokončená část | Co ještě chybí | Celkový stav |
|---|---|---|---|
| **0. Společná pravidla a výchozí měření** | Server a Mac stejně rozlišují skutečnou chybu, nepodporované čtení a odloženou práci. | Nezávislé výchozí měření správnosti/pokrytí a dokončení kontroly všech pravidelných zapisovačů. | Částečně |
| **1. Jednoduchý přehled a panel** | Na Macu jeden stav a poslední výsledek; „Co systém dělá“ vysvětluje čtyři činnosti. Servisní ovládání je stranou. | Webová administrace jako jednoduchý přehled a schránka skutečných rozhodnutí. | Částečně |
| **2. Trvalé řízení práce** | Čekající podklady mají společně uložené další pokusy, převzetí s expirací a ochranu souběžné změny rozhodnutí. | Společné řízení všech druhů práce mezi serverem a Macem, priority a bezpečné pokračování všech zapisovacích kroků. | Částečně |
| **3. Společné ověření a zveřejnění** | Cesta explicitně posouzených kandidátů kontroluje důkaz i přímo v zapisovači: aktuální zdroj, shodu snímku, doslovnou citaci, výslovný rok a doložený konec závodu. Stávající ochrany identity a zámků zůstávají. | Převod ostatních cest na stejná pravidla, transakční zápis s navazující prací a kontrola skutečného veřejného výsledku. | Částečně |
| **4. Automatické řešení podkladů a duplicit** | Existují dílčí opravy konkrétních duplicit a bezpečnostní pravidla; opakované čtení podkladů již běží. | Samostatné posouzení podkladů, řešení rozporů a jednotné podmínky automatického slučování. Opakované čtení není vyřešený případ. | Nedokončeno |
| **5. Lepší pokrytí a doplňování** | U detailů Bikepointu kontrola následuje skutečně odkazované pořadatele. Na Jarném šprintu a BikeFestu ověřeno načtení a uložení podkladů, ne pravdivost termínu. | Systematické hledání chybějících ročníků a mezer po zemích/disciplinách, měřený přínos a dokončení ověřování nových údajů. | Nedokončeno |
| **6. Nezávislé ověření zlepšení** | Průběžně běží regresní a provozní testy. | Oddělená kontrolní sada, porovnání skutečné správnosti a pokrytí, nákladů a práce vlastníka. Testy kódu toto nenahrazují. | Nezahájeno |

## Hranice současné automatizace

- Čekající podklad není automaticky otázka pro vlastníka.
- Změna stránky ani úspěšné přečtení nejsou ověřený údaj.
- Zápis do katalogu zatím není nezávisle potvrzený veřejný výsledek.
- Modelový návrh není zdroj pravdy a opakovaný pokus není souhlas se zveřejněním.
- Žádná ze sedmi etap zatím není dokončená v celém původním rozsahu.

## Právě dokončená změna v etapě 3

`validateReviewSource` používá náhled i `ingestReviewedCandidate` před prvními zápisy. Zapisovač znovu čte zdroj, takže starý náhled není důkazem aktuálního stavu. U textového důkazu musí každá citovaná část skutečně existovat v dokumentu; strukturovaná karta se kontroluje jako skutečný HTML fragment včetně údaje o roku. Nesoulad kontrolu zastaví. Tato změna sama nepublikuje žádný z čekajících podkladů a nedokončuje samostatné rozhodování AI.

Přehled běžného provozu: [keep-fresh.md](keep-fresh.md). Pravidla ročníků: [annual-editions.md](annual-editions.md).
