# Let's Race: co teď dokončujeme

Aktualizováno 5. listopadu 2026 při kontrole předání o propozicích. Toto je hlavní aktuální seznam práce. Předchozí znění s historickými počty je [zachované zde](../reports/pdf-extraction-2026-11-05/continuation/operations-progress-before.md).

## Cíl

**Co nejúplnější katalog skutečných závodů, správné a užitečné údaje pro jezdce a rodiče, bez duplicit. Pomocník práci průběžně dokončuje na Macu a doložené výsledky doručuje na web.**

Teď má přednost čtení propozic a doplňování údajů: místo startu, pořadatel, program, startovné, trasy a kategorie. Přiblížit se 95 % je cíl, nikoli změřený výsledek. Počet přijatých polí ani úspěšných testů neříká, kolik správných údajů se podařilo získat.

Nový ročník stavíme na posledním ověřeném ročníku podle [pravidel ročníků](annual-editions.md). Minulý ročník zůstává zachovaný; staré propozice nepotvrzují letošní program a startovné.

## Pořadí práce

| Priorita | Výsledek, který potřebujeme | Aktuální stav a další krok |
| --- | --- | --- |
| **1. Správně přečíst propozice** | Získat doložené údaje z textových PDF, skenů a obrázků; nezaměnit závod, ročník, vstupenku ani peněžní cenu. | Skeny čteme přes macOS Vision, opravena chyba vykreslení v 72 DPI ([výsledek](../reports/pdf-extraction-2026-11-05/ocr-render-fix/RESULT.md)). Zbývá: u akcí s více sporty se bere běžecká tabulka nebo čas. |
| **2. Doložit kvalitu výsledku** | Odděleně změřit, zda propozice najdeme, přečteme a správně z nich získáme dostupné údaje. | Tři nezávislé vzorky s ručními očekáváními: 45 %, 68 %, 94 % polí po postupných opravách, poslední jen 16 polí ([výsledek](../reports/pdf-extraction-2026-11-05/independent-sample/RESULT.md)). **U 12 z 27 závodů odkaz nevede na údaje tohoto ročníku**, to je teď největší ztráta. Cíl 95 % doložený není. |
| **3. Dovést doplňování do pravidelného běhu** | Stejné čtení propozic v řízeném průchodu Macu, sdílené náklady, pokračování po přerušení a bezpečné doručení. | **Zapojeno.** Krok „Čtu propozice“ po 6 hodinách, nejvýš 30 závodů; části údajů se doplňují zvlášť a jen do prázdných polí. Ověřit první dávky na webu a útratu. [Výsledek](../reports/pdf-extraction-2026-11-05/find-documents/RESULT.md). |
| **4. Najít chybějící podklady a závody** | Hledat propozice přes web pořadatele a minulý ročník; zachytit nové termíny z federací i vlastních webů. | Řazení odkazů a přechod z kalendářů na web pořadatele: startovné 23 → 29 %, program 49 → 56 % závodů. Většina zbytku jsou závody 2027 bez vydaných propozic. Další možnosti: 141 závodů odjazd.pl bez webu pořadatele, stránky chráněné proti robotům přes Chrome na Macu. |
| **5. Bez duplicit a chybných spojení** | Posoudit stejný závod napříč zdroji, ale zachovat různá kola a ročníky. | Přečteno 104 dvojic, sloučeno 13 ([výsledek](../reports/pdf-extraction-2026-11-05/duplicates/RESULT.md)). Zbývá 43 podezřelých dřívějších spojení. Nejasnosti odložit; slučovat vratně a se zachovanými zdroji. |
| **6. Ověřit skutečný veřejný výsledek** | Správné údaje a přesměrování jsou opravdu vidět lidem. | Ověřit Wels, Perun, Lakeland a GR8; u MSR Selce vyřešit rozpor dat. PGR, Grudziądz a Gravel Trans Jura jsou opravené; Saint Gravel a Selce zůstávají nerozhodnuté. Staré počty čekajících kontrol nepovažovat za aktuální; nejdřív přečíst dnešní stav. |
| **7. Udržet provoz levný a spolehlivý** | Mac pokračuje v práci, uchovává výsledky a zbytečně nezatěžuje veřejný web. | Přesun a průběžné navazování již mají implementaci i dřívější provozní důkazy. Zbývá srovnat spotřebu po několika dnech a ověřit dvě úplná čtení i pokračování po pádu. Placené limity nezvyšovat. |

Nález 6. 11.: část termínů 2027 byly data z roku 2026 s novým letopočtem. CUBE Cup je skrytý, RoadCup opravený a přidaná pojistka pro celé tabulky. [Výsledek](../reports/pdf-extraction-2026-11-05/shifted-dates/RESULT.md).

## Co je doložené a kde to běží

Dřívější provozní výsledky jsou v [reportu přesunu na Mac](../reports/mac-offload-2026-11-05/RESULT.md). Následující tabulka rozlišuje tyto výsledky od nové rozpracované práce; není novým měřením produkce.

| Část | Doložený stav |
| --- | --- |
| Sběr ze známých zdrojů a webů pořadatelů | Implementovaný řízený místní průchod; po práci navazuje, bez práce čeká na splatný krok. Zachovává pracovní databázi a uložené stránky. |
| Kategorie, přihlášky a odkazy z webů závodů | Místní krok po 6 hodinách. Odesílání doplňuje jen povolená prázdná pole; automaticky neopravuje už vyplněná data, názvy nebo místa. |
| Místa a zdraví zdrojů | Místní doplnění souřadnic po 12 hodinách a kontrola zdrojů jednou týdně. |
| Veřejný web a krátké serverové úlohy | Podle reportu přesunu nasazeno v `03f379a5`: zůstává zveřejnění, upozornění, přehled, údržba bez čtení webů a historie počasí. Úspora dosud není změřená. |
| Nové čtení PDF a strukturovaných praktických údajů | Běží v místním cyklu po 6 hodinách, doručení přes doplňování prázdných polí. |

## Jak měříme úspěch

- **Najdeme:** kolik závodů má použitelný podklad a kolik jej postrádá.
- **Přečteme:** kolik podkladů skutečně dává použitelný text včetně skenů; chyba a časový limit nejsou „bez údaje“.
- **Získáme správné údaje:** porovnání s ručně připravenými očekávanými údaji. Zvlášť počet správných přijetí, chybných přijetí a dostupných údajů, které jsme vynechali.
- **Doručíme:** co je jen místní návrh, co prošlo zápisem a co je ověřené na veřejném webu.
- **Zaplatíme:** skutečná útrata a doba běhu. Bezplatné OCR neznamená nulové náklady celého provozu.

Soubor s 36 závody obsahuje i webové stránky, nikoli jen PDF. Slouží k opravám a už není nezávislým vzorkem. Starší kontrola 80 závodů ověřovala hlavně datum u závodů s vlastním webem, nikoli celý detail nebo úplnost katalogu.

## Zachované otevřené úkoly

- Změny již vyplněných hodnot, ruční zámky a návrhy s nejasnou identitou.
- Chybějící weby, nečitelné zdroje a čekající termíny: počty z předání jsou historické, nejdřív přeměřit. Absence data na přečtené stránce není důkaz, že nebylo oznámeno jinde.
- **Docling: rozhodnuto nepřidávat.** Po opravě našeho vykreslení nepřináší žádný doložený údaj navíc a na plakátech je výrazně horší. [Výsledek](../reports/pdf-extraction-2026-11-05/ocr-render-fix/RESULT.md).
- Průběžné hledání nových závodů a oznámených ročníků, ne pouze doplňování těch známých.
- Oprava budoucích přihlášek Dětského MTB Cupu; srovnání kol, pravidla seriálů a přiřazení krajů.
- Dokončení historie počasí, ověření indexace, staré adresy sloučených seriálů a povolený přístup k Eventivu.
- Facebook: další postup vyžaduje rozhodnutí vlastníka; nynější opravy na něm nezávisí.

## Hranice této práce

Zápisy nových výsledků z propozic do produkční databáze a nasazení se provádějí až s výslovným souhlasem. Rozpracované soubory a podklady se zachovávají. Sdílené limity AI zůstávají **0,50 USD za den a 5 USD za měsíc**; nové měření ze zdejších uložených odpovědí další placenou AI nevolá.

„Co je nového“ popisuje pouze uživatelsky znatelné změny aplikace. Opravy katalogu, čteček a měření se tam nepřidávají.

[Podrobné předání propozic](../reports/pdf-extraction-2026-11-05/HANDOFF.md) a [starší historie úkolů](../reports/takeover-review-2026-11-05/tracker-before-simplification.md) zůstávají podklady. Aktuální pořadí určuje tento soubor.

Nejnovější výsledky: [hledání propozic](../reports/pdf-extraction-2026-11-05/find-documents/RESULT.md), [nezávislá kontrola vytěžování](../reports/pdf-extraction-2026-11-05/independent-sample/RESULT.md). Předchozí checkpoint: [předání po Codexu](../reports/pdf-extraction-2026-11-05/HANDOFF-CODEX.md).
