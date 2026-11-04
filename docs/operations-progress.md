# LetsRace — priority a stav práce

Aktualizováno 4. listopadu 2026. Tento seznam spojuje provoz, pipeline, data a SEO. **P0 řešíme před živým pilotem.** Scany na Macu i serveru jsou pozastavené. Pilot vyžaduje souhlas vlastníka a jeho výsledek rozhodne o postupném obnovení.

## P0 · Bezpečný a měřitelný provoz

| Pořadí | Úkol | Stav | Co zbývá k uzavření |
| --- | --- | --- | --- |
| 1 | Převzetí zdroje a pokračování po pádu | **Hotovo v hlavním sběrači** | Plánovač pouze vybírá kandidáty. Převzetí má jediný databázový token a potvrzení výsledku, stavu a dalšího termínu se ukládá v jedné transakci. Databázový test ověřil odmítnutí druhého převzetí, vypršení tokenu, nový běh, pozdní návrat starého běhu a ruční pauzu. Ostatní pravidelné zapisovače pokrývá bod 2 a živý souběh bod 5. |
| 2 | Bezpečné zápisy mimo hlavní sběrač | **Částečně** | Dokončování závodů, registrace a údržba míst už kontrolují aktuální stav a ruční zámky. Sloučení dvojice míst ukládá přesun, historii a smazání společně. Zbývají zejména zápisy věkových kategorií a webů, metadata seriálů a obnova celé nahrazené sady kategorií. |
| 3 | Doručení změn na veřejný web | **Částečně** | Nahradit plošnou obnovu z údržby cílenými požadavky. Ověřit výsledek změny v detailu, seriálu, seznamu, mapě a kalendáři. Zpracovat nahromaděné kontroly v limitu 60 detailů za den a nejvýš čtyř dávek po 200 požadavcích na obnovu za 24 hodin. Indexace Googlu se sleduje zvlášť. |
| 4 | Rozpočet sběru a přínos jednotlivých zdrojů | **Částečně** | Měří se délka čtení a ukládají se ID vytvořených a změněných závodů. Doplnit měření požadavků a logů, plánování podle přínosu a odklad zdrojů s opakovanými selháními. V přehledu rozlišit nové závody, unikátní změněné závody, ověřená doplnění a potvrzení čerstvosti. |
| 5 | Bezpečné obnovení scanů | **Čeká na P0 a souhlas s pilotem** | Změřit celý den veřejného provozu po opravách. Potom otestovat omezenou dávku na Macu i serveru, včetně souběhu na stejném zdroji. Před rozšířením ověřit dva běžné cykly, funkční opakování, stabilitu veřejného webu a celkový provoz pod cílem 16 000 požadavků denně i v rozpočtu logů. |

Výchozí měření za 28. 10.–3. 11. eviduje **2 326 čtení, 11 h 36 min součtu časů zdrojů a 4 h 11 min po odečtení souběhů**. Bez vykázaného nového či změněného záznamu skončilo 76 % čtení s podrobnými počítadly. Počet skutečně zlepšených závodů historické záznamy neumožňují určit. [Denní rozpad, metodika a nasazené změny](../reports/pipeline-yield-2026-11-04/RESULT.md).

## P1 · Správnost dat a pokrytí závodů

| Úkol | Stav | Co zbývá |
| --- | --- | --- |
| Rozpory a duplicity | **Částečně** | Jednotná pravidla pro automatické shody, odložení nejasných případů, ochrana proti návratu duplicity a obnova chybného sloučení včetně adres, vazeb a plánů. |
| Chybějící závody a další ročníky | **Částečně** | Pravidelně hledat nové zdroje, mezery podle zemí a disciplín a další ročníky. Termín musí být výslovně doložený pro daný rok. [Pravidla ročníků](annual-editions.md). |
| Praktické údaje | **Částečně** | Schéma, původ, zámky a čtení tabulek už fungují. Rozšířit čtení běžného textu a složitějších cenových podmínek a ověřit skutečný přínos v katalogu. [Příklady uložených údajů](../reports/practical-reader-v3-2026-11-03/RESULT.md). |
| Nezávislé měření | **Výchozí vzorek hotový** | Doplnit nezávislé případy z více zemí a disciplín, negativní případy a kontrolu chybných sloučení. Porovnat správnost, pokrytí, náklady a čas vlastníka. Fullgaz a Ötztaler po cílené opravě slouží jako regresní případy. [Výchozí měření](../reports/independent-baseline-2026-11-03/RESULT.md). |
| Eventiv | **Blokuje přístup poskytovatele** | Obnovit čtení po vyřešení přístupu. Odpověď 401 už zachovává dosavadní závody a hlásí nedostupný zdroj. [Ověření](../reports/source-recovery-2026-11-02/RESULT.md). |

## P2 · Rozhraní, SEO a další obsah

| Úkol | Stav | Co zbývá |
| --- | --- | --- |
| Automatická rozhodnutí | **Částečně** | Schránka a ochrana zastaralé odpovědi existují. Doplnit vznik konkrétní otázky, dohledatelné provedení odpovědi a odklad při neodpovězení. Řešitelné technické chyby má převzít systém. |
| Detail závodu a seriálu | **Částečně** | Ročníky, okolní závody pod zdroji, praktické údaje, trvalá hlavička, odkaz na mapu a vedlejší kola fungují. Zbývá srovnání kol a doložená pravidla sezóny. [Návrh detailů](race-series-next-content-2026-11-03.md). |
| Regionální kolekce | **Čeká na data** | Doplnit spolehlivé kraje a připravit užitečný regionální výběr. |
| Historie počasí | **Částečně** | Společné úložiště, serverový běh a limity fungují. Doběhnout úvodní plnění v rozpočtu. Aktuální předpověď má krátkou platnost. |

## Uzavřené položky

- **Hlavní sběrač a schválení kandidáti.** Společný zápis nového i existujícího závodu se zdroji, snímky, kategoriemi, plánovanou změnou místa a vazbami. Upozornění mají trvalé pokračování. Schválený kandidát ukládá i konečný stav a přerušený zápis lze obnovit. Starší zápisy bez tokenu vyžadují kontrolu. [Zápis závodů](../reports/watcher-evidence-bundle-2026-11-03/RESULT.md), [kandidáti](../reports/candidate-publication-2026-11-03/RESULT.md).
- **Vazby seriálů, disciplíny a návrat jednotlivé změny.** Hlavní i vedlejší vazby se ukládají s původem. Jednotlivou doloženou změnu lze bezpečně vrátit. [Vazby](../reports/atomic-series-membership-2026-11-03/RESULT.md), [disciplína a návrat](../reports/atomic-catalog-writes-2026-11-03/RESULT.md).
- **Opakování a čerstvost kalendářů.** Kolize odloží konkrétní položku. Nezměněný kalendář se potvrzuje jedním databázovým požadavkem. Skrytí kontroluje převzetí, přečtený rozsah, další zdroje a ruční zámky. Dotazy na ročníky a seriály jsou jednodušší a okolní závody používají společný seznam mapy. [Opravy spotřeby](../reports/limits-2026-11-04/RESULT.md).
- **Mechanismus zveřejnění.** Požadavky na aktualizaci a kontroly výsledku jsou oddělené. Seriály zahrnují i starou adresu při přejmenování. První společná veřejná kontrola porovnala 1 006 záznamů. [Společný seznam](../reports/aggregate-publication-2026-11-02/RESULT.md), [seriály](../reports/uci-import-2026-11-03/RESULT.md).
- **Admin a panel.** Jednoduché rozhraní je nasazené, technické nástroje jsou v `/admin/tools` a poslední kontrola společného seznamu má vlastní údaj. [Ověření adminu](../reports/owner-admin-2026-11-02/RESULT.md).
- **SEO v dohodnutém rozsahu.** Doložený areál, adresa a pořadatel souhlasí ve viditelném detailu a JSON-LD. Čas hlavního startu se zatím neposílá jako začátek celého závodu. Kolekce Česko 2027, české MTB a dětské závody pokrývají celý rok. Měsíce odkazují na příslušnou část seznamu a nadbytečné souhrny jsou odstraněné.
- **Dodané závody.** Česká dávka 2027 je zpracovaná. Lost Ride zůstává skrytý jako provizorní záznam a Oremon je rekreační jízda. Z UCI dávky byl přidán Szczyrk, doplněn Graz a opraven Black Forest. Fullgaz 2027 je přidaný a Ötztaler má opravenou klasifikaci. [Česká dávka](../reports/cz-2027-import-2026-10-31/REPORT.md), [UCI dávka](../reports/uci-import-2026-11-03/RESULT.md), [Fullgaz a Ötztaler](../reports/coverage-recovery-2026-11-03/RESULT.md).
- **Konkrétní opravy.** Chotěbuz opakovaně prošla bez duplicity. Die Mauer von Kendenich má jeden veřejný záznam se zachovanými vazbami. Michaelis-Schanze už nezobrazuje trasu 0 km a neznámá délka zůstává prázdná. [Chotěbuz](../reports/source-recovery-2026-11-02/RESULT.md), [oprava délky](../reports/zero-distance-2026-11-03/RESULT.md).

Finanční limity platí dál. Trialové závody, nový koncept ověřovacích statusů a veřejné editační formuláře jsou mimo aktuální rozsah. Běžný provoz je popsaný v [provozním návodu](keep-fresh.md). Původní rozsah sedmi etap je v [historickém plánu](operations-autonomy-plan-2026-11-01.md).
