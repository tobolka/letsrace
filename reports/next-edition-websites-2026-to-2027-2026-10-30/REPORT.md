> Aktualizace 30. 10. 2026: všech devět níže uvedených oznámených ročníků je po výslovném pokynu uživatele zveřejněno na letsrace.cz. Každá veřejná stránka vrací HTTP 200 a obsahuje správný název a termín. Původní auditní stav níže zachycuje stav před publikací; aktuální ověření je v `publication/public-verification.json`.

# Kontrola webů závodů 2026: oznámené ročníky 2027

Kontrola 30. 10. 2026, všechny země v katalogu. Zahrnuté jsou veřejné, nesloučené závody se začátkem v roce 2026, včetně již dokončených.

**Průchod je uzavřený, ale ověření všech webů není úplné:** 12 adres registračního portálu zůstalo bez požadavku kvůli opakované blokaci. Další nečitelné, odstraněné či prohlížeč vyžadující stránky jsou evidované zvlášť. U nich nelze tvrdit, že pořadatel termín ještě nezveřejnil.

## Rozsah a výsledky

| Co | Počet |
| --- | ---: |
| Veřejné nesloučené závody 2026 | 4685 |
| Závody s vyplněným odkazem na web | 3616 |
| Závody bez webového odkazu | 1069 |
| Závody s chybnou adresou (`https://`) | 1 |
| Unikátní platné výchozí webové adresy po sjednocení | 2928 |
| Z nich skutečně vyžádáno | 2916 |
| Výchozí adresy odložené kvůli blokaci | 12 |
| Všechny evidované adresy včetně doplněných stránek | 3639 |
| Z nich skutečně vyžádáno alespoň jednou | 3627 |
| Spolehlivě čitelné stránky | 2953 |
| Nevyřešené stránky včetně odložených | 686 |
| Stránky obsahující celé datum 2027 nebo údaje o události 2027 | 437 |

Počty stránek zahrnují hlavní stránky pořadatelů i navazující odkazy výslovně označené rokem 2027. Sdílené adresy se načítají společně. Při dočasném selhání proběhl druhý pokus. Počet unikátních adres není počet síťových pokusů. V evidenci zůstávají i stránky načtené v předchozí fázi kontroly.

**437 stránek není 437 nových závodů.** Na společném webu může jít o termín jiné akce, uzávěrku přihlášek nebo související novinku. Automatický nález proto nezakládá ani nepřepisuje veřejný závod.

## Výsledek pro jednotlivé závody 2026

| Výsledek | Závodů |
| --- | ---: |
| Na související stránce nalezené celé datum 2027; totožnost a význam data vyžadují ověření | 450 |
| Zmíněný rok 2027 bez zachyceného celého data | 434 |
| Celé nové datum nebylo zachyceno | 2177 |
| Všechny kontrolované související stránky nečitelné či nedostupné | 554 |
| Chybný webový odkaz | 1 |
| Bez webového odkazu | 1069 |

U závodu s některou čitelnou stránkou mohou být další související stránky nedostupné. V úplném seznamu jsou proto i sloupce s nevyřešenými adresami. Absence zachyceného data není důkazem absence oznámení, zejména u obrázkových plakátů a obsahu vyžadujícího prohlížeč.

## Konkrétní oznámené termíny

[Devět ručně ověřených příkladů](REVIEWED.md) zahrnuje Krkonošskou 70 MTB, Lesák Cup, Praha–Doksy, OZP 50 Podralsko, Montes Ferrei, časovku 3xTOP Lysá hora, Morava Bike, Švejkovu sobotu a hlavní závod Cyklo Maštale. U každého je zdroj a poznámka, co se smí přenést z minulého ročníku. U nových ročníků nebyly v katalogu nalezeny odpovídající veřejné nesloučené záznamy; nejde o tvrzení, že byly vyřešeny všechny možné varianty totožnosti. Tento výběr není úplný seznam všech nových termínů z celého průchodu.

Zachycené příklady, které brání slepému kopírování:

- Časovka 3xTOP: 7. 8. 2027 je uzávěrka registrace; závod je 8. 8. 2027.
- Lesák Cup: oznámený nový ročník mění dějiště do centra Červeného Kostelce.
- Krkonošská 70 MTB: starý údaj obce v katalogu je chybně datum; musí se opravit podle pořadatele.
- Cyklo Maštale: datum hlavního závodu samo nepotvrzuje novou gravelovou variantu.
- Morava Bike a Morava Footbike jsou dvě různé akce s různými termíny.
- Sudety Tour a Tour de Zeleňák už mají podobné záznamy 2027 s rozpory v termínech; přehled obsahuje podklady pro jejich následné vyřešení.

## Soubory

- [Úplný seznam všech závodů v CSV](race-review.csv): jméno, země, web, výsledek, orientační shody s rokem 2027, nalezená data a nevyřešené adresy.
- `race-review.json`: podrobnosti včetně úryvků zdrojů, všech vazeb a existujících záznamů 2027. Shoda názvu je jen orientační, ne potvrzení totožnosti.
- `reviewed-announcements.json` a [REVIEWED.md](REVIEWED.md): devět ručně ověřených oznámení.
- `candidates.json`: automatické nálezy dat 2027, dosud nepotvrzené jako konkrétní závody.
- `unresolved.json`: nečitelné, chybové a odložené stránky s důvodem.
- `coverage.json`, `races.json`, `jobs.json`: rozsah, vstupní snímek a seznam plánovaných adres.
- `pages.jsonl`: historie pokusů; při opakovaném načtení platí poslední záznam dané adresy.
- `pages/`: texty skutečně načtených zdrojů pro dohledání důkazů.

`complete: true` znamená, že každá naplánovaná adresa má zaznamenaný výsledek nebo výslovné odložení. `allRequestsAttempted: false` a `deferredPages: 12` zachovávají informaci, že 12 adres nebylo vyžádáno.

## Provedené změny a ověření

Produkčně byl samostatně doplněn [Rožmitálský cyklokros 2027](https://letsrace.cz/en/race/rozmitalsky-cyklokros-2027) na 16. 10. 2027 a jeho oficiální web přidán ke sledování. Detail vrací HTTP 200 a zobrazuje převzaté kategorie jako „podle minulého ročníku“. Ostatní nálezy tohoto hromadného průchodu nebyly publikovány ani předány jako potvrzené do katalogu.

Obecná pravidla přenosu údajů jsou v `AGENTS.md` a `docs/annual-editions.md`. Kontrola je opakovatelná skriptem `scripts/audit-next-edition-websites.ts`; nepoužívá placenou AI, nic nezapisuje do katalogu a nevytváří pravidelnou úlohu. Záznam do „Co je nového“ je připraven v češtině a angličtině pro Rožmitál. Webový kód nebyl v rámci tohoto zásahu nasazen.

Kontrola upraveného skriptu a poznámek: ESLint a cílená kontrola typů prošly. Celková kontrola typů projektu narazila na dříve existující chybějící `race-skeleton` v archivní kopii `reports/search-console-2026-10-29/release-source/`; tento nesouvisející podklad nebyl měněn. Výstupní seznam je ověřený proti vstupním ID, součtům a záznamům načtených adres.
