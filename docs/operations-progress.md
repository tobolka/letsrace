# LetsRace: co teď děláme

Aktualizováno 5. listopadu 2026. Toto je hlavní seznam práce.

## Čeho chceme dosáhnout

**Pomocník sám najde závody, doplní správné informace a ukáže je lidem na webu. Stejný závod tam nebude dvakrát. Ty ho nemusíš hlídat.**

To ještě nemáme hotové. Opravené části nejsou důkazem, že dobře funguje celý pomocník.

## Co teď běží kde

Ověřeno 5. listopadu 2026 odpoledne. **Jeden společný kód; rozdílné místo spouštění.** Místní sběr není nová náhrada původního cíle.

| Činnost | Mac | Server |
| --- | --- | --- |
| Pravidelný sběr a hledání zdrojů | **Nový režim zapnutý:** splatné známé zdroje každých 12 hodin; hledání nových webů zatím neběží | `watch` a `explore` dál blokované |
| Nový průchod | Čte weby a trvale ukládá práci místně | Dostává prověřené nové závody; celkem 20 nových záznamů po opravě jedné duplicity |
| Geokódování | Při čtení používá známá místa; celý samostatný krok není v paralelním průchodu | Samostatná naplánovaná úloha zůstává |
| Historie počasí | Není součástí nového paralelního průchodu | Dnešní běh dokončen 5:11 bez chyby |
| Aktuální předpověď | Není závislá na zapnutém Macu | Zůstává službou veřejného webu |
| Zveřejnění, údržba katalogu a upozornění | Nástroje mohou vyžádat kontrolované zveřejnění | Zůstávají samostatné serverové úlohy |

**Původní zadání dál platí:** pokrytí závodů, správné a bohaté údaje, minimum duplicit, aktuální veřejný web, srozumitelný přehled a hlídané náklady. Přesun náročné práce na Mac řeší část nákladů; ostatní body tím nejsou dokončené.

## Aktuální priorita a předání Claudovi

**Nový pokyn vlastníka: přesunout maximum sběru a zpracování na Mac, aby tento měsíc ulevilo Supabase a Vercelu.** Dvanáctihodinové čekání není pro místní zpracování odůvodněné limity těchto služeb. Vlastník kvůli kreditům předává další práci Claudovi.

**[Úplné nové předání pro Clauda](../reports/codex-handoff-2026-11-05/HANDOFF-CLAUDE.md)** obsahuje hotové změny, všechny rozpracované části, podklady, přesné provozní omezení a postup pokračování. Má přednost před starším popisem, co se právě dělá.

| Pořadí | Co zbývá dokončit | Stav při předání |
| --- | --- | --- |
| **1** | Přesunout i zbývající náročný sběr a doplňování ze serveru na Mac. | **ZBÝVÁ.** Watch/explore jsou blokované, ale serverový catalog stále čte FCI, RaceResult, propozice, Rakousko a registrace. Source-health, geokódování a historie počasí také nejsou přesunuté. |
| **2** | Mac má průběžně dokončovat práci; nemá čekat 12 hodin, když je co dělat. | **ZBÝVÁ.** Dosud nastaveno 12 hodin. Při zrychlení odstranit i zbytečné opakované stahování celého serverového snapshotu. |
| **3** | Zapojit weby pořadatelů a jejich nálezy do automatického ukládání. | **ROZPRACOVANÉ.** Ručně přečtené podklady pro 2027 jsou uložené místně; nejsou v pravidelném průchodu a z této poslední dávky nic nešlo do produkce. Přehled pokrývá 3 758 závodů 2026, 980 nemá web. Z 2 385 původních adres se zkusilo načíst 1 999. |
| **4** | Bezpečně odesílat také doložená doplnění existujících závodů. | **ZBÝVÁ.** Nový režim posílá jen nové závody. Starší změny se drží místně, nejsou ztracené. Vyřešit i vazbu evidence-only zdrojů nových webů na cílový katalog. |
| **5** | Dotáhnout veřejné změny a staré odkazy. | **ČÁSTEČNĚ.** Iaccobike veřejně ukazuje správnou obec. Obnovu staré adresy sloučeného Welsu je ještě třeba potvrdit. Ověřit také předchozí Perun/Lakeland/GR8 opravy. |
| **6** | Rozdělit chybně spojené závody, vyřešit zadržené změny a opakované chyby zápisu. | **ZBÝVÁ.** Původní podklady: 43 podezřele spojených záznamů a 26 zadržených aktualizací; přeměřit současný stav. 13 nových nálezů z posledního běhu zůstává oddělených. |
| **7** | Dvě úplná čtení, nezávislá kvalita a skutečná spotřeba po přesunu. | **ZBÝVÁ.** Rychlé opakování bez nové práce funguje, ale neprokazuje správnost všech údajů ani pokrytí katalogu. Rozpad Vercel CPU podle tras připojený účet podmiňuje placenou službou; žádný upgrade neproběhl. |

### Co zůstává skutečně hotové

- Nový automatický režim Macu je nainstalovaný a zapnutý; první automatický běh dokončen za 24 s. Starý serverový watch/explore se nepovoloval. Další naplánovaný čas při předání: **6. 11. 03:29 CET**.
- První větší průchod: 377 zdrojů za 10 min 27 s, po opravě jedné duplicity 17 nových závodů; spolu se třemi dříve odeslanými celkem 20. Opakování 29 s bez opakovaného čtení a zápisu. [Výsledek a jeho omezení](../reports/local-release-2026-11-05/RESULT.md).
- Pracovní databáze se zachovává, zapisuje se odděleně s potvrzením, funguje zámek souběhu a zastavení před odesláním. Panel odděluje nové skutečně odeslané výsledky od starých místních počtů.
- Poslední ruční průchod webů pořadatelů je zastavený a podklady uložené. 314 stránek se zmínkou termínu **není 314 nových závodů**. U my.raceresult.com je 385 adres odložených kvůli odmítání požadavků; to je omezení cizího webu, ne Supabase/Vercelu.
- Kód je v hlavní větvi a aplikace nasazená; poslední dva CLI doplňky a toto předání jsou v závěrečném samostatném commitu. Předchozí plná kontrola: 1 622 testů, typy a build prošly; poslední CLI doplňky: typy, cílený lint a 52 cílených testů prošly.

## Co ti musí ukázat skutečný běh

- Jak dlouho běžel.
- Kolik našel nových skutečných závodů.
- Kolika závodům doplnil správné užitečné údaje a které to byly.
- Co se opravdu objevilo na veřejném webu.
- Co nešlo dokončit a proč.
- Kolik stál.

**Když nic nového není, nic nepřidáváme. To je správně.** Výsledek má rozlišit „přečteno a beze změny“, „nové údaje jsme získali“ a „nepodařilo se zkontrolovat“. Nezměněné stránky se mají číst méně často.

**Počet přečtených stránek není počet nalezených závodů. Vyplněné políčko ještě nemusí být správně.**

**Důkazy dnešního průchodu a opakování:** [stručný výsledek](../reports/productive-cycle-2026-11-05/RESULT.md). Všechny testy nyní: 1 567 prošlo. To není důkaz správnosti celého katalogu.

## Co už je dnes opravené

Tyto opravy jsou v hlavní větvi a na serveru; kopie na Macu je také aktualizovaná:

- Stejný název nebo společné město nestačí k záměně dvou závodů.
- Uzávěrka přihlášek se nesmí vydávat za den závodu.
- Pomocník nesmí spojit dva závody jen proto, že si to AI myslí.
- Dočasně nefunkční stránka se nesmí automaticky označit jako zbytečná.
- Závod, který pomocník na stránce neviděl, se nesmí označit jako znovu zkontrolovaný.

Kontroly těchto oprav prošly. **Jejich přínos pro celý katalog teprve změří skutečný běh.** [Podklady a provedené změny](../reports/takeover-review-2026-11-05/RESULT.md).

## Proč to ještě nestačí

Při dřívější dnešní kontrole (před posledními importy) jsme v sedmi podporovaných zemích našli **947 veřejných závodů pro rok 2027**. Jen **14** má vyplněný nový blok praktických informací. Některé údaje jsou uložené i jinde; tato čísla neříkají, že ostatní detaily jsou úplně prázdné ani že těch 14 je všechno správně.

Dřívější snímek uváděl **736 aktivních zdrojů**. Na rozhodnutí čeká **30 nalezených záznamů**: 11 nových a 19 odložených. Není tedy doložené, že máme tisíce hotových závodů, které stačí zveřejnit.

Dřívější měření ukázalo, že **76 % čtení s dostupnými počítadly nepřineslo nový ani změněný záznam**. Potřebujeme lépe vybírat, co číst, a dokončovat získané informace. [Dřívější měření](../reports/pipeline-yield-2026-11-04/RESULT.md).

## Co dál zbývá

| Oblast | Co ještě chybí | Stav / značka |
| --- | --- | --- |
| Nové závody | Pravidelně najít chybějící ročníky a závody, které vůbec neznáme. Změřit, kolik jich to skutečně přidává. | **ČÁSTEČNĚ.** Hledání ročníků existuje, celý nový průchod není ověřený. P1.2a, P1.2b. |
| Bohatší údaje | U většího počtu závodů získat místo startu, trasy, kategorie, časy, ceny a přihlášky. Uchovat, odkud informace pochází. | **ČÁSTEČNĚ.** Ukládání a první čtečky fungují, plošný výsledek chybí. P1.3a, P1.3b. |
| Správné přihlášky | Staré přihlášky Dětského MTB Cupu byly odstraněny, ochrana ale blokuje i doplnění budoucích správných přihlášek. | **ZBÝVÁ OPRAVIT.** P1.3e. |
| Duplicity | Poznat stejný závod ve všech cestách sběru, pamatovat si rozhodnutí a umět bezpečně vrátit chybné spojení. | **ČÁSTEČNĚ.** Konkrétní opravy a ochrany existují; celý postup není doložený. P1.1a–c. |
| Aktuální veřejný web | Dotáhnout čekající změny a opravit přetrvávající selhání načítání ročníků. | **ČÁSTEČNĚ.** P0.3a, P0.4f. |
| Čas a spotřeba | Zjistit přínos každého druhu práce a hlídat celkovou spotřebu. | **ČÁSTEČNĚ.** První čísla máme; porovnání celého dne po úsporách a výsledků nových běhů chybí. P0.4a–c. |
| Spolehlivost po pádu | Na malém běhu ověřit souběh, přerušení a pokračování bez ztráty práce nebo druhé kopie závodu. | **ZBÝVÁ ŽIVÁ ZKOUŠKA.** Souhlas jsi dnes dal. P0.5a–b. |
| Nezávislá kontrola | Porovnat katalog s předem připravenými skutečnými závody. Výsledek nesmí záviset jen na příkladech, podle kterých se systém opravoval. | **ZAČATO.** První sada má 14 závodů, původní širší cíl je 140. P1.4b, P1.4d. |
| Jednoduchý přehled pro tebe | Ukázat, co přibylo, co čeká a kdy je opravdu nutná tvoje odpověď. | **ROZHRANÍ HOTOVÉ, automatické rozhodování částečné.** P2.1a–b. |
| Seriály a kraje | Doplnit srovnání kol, pravidla seriálů a spolehlivé přiřazení ke krajům. | **ČÁSTEČNĚ.** P2.2, P2.3. |
| Počasí | Dokončit první doplnění historických údajů. | **DOBÍHÁ.** P2.4. |
| Vyhledávání a staré odkazy | Ověřit indexaci a zachovat staré adresy sloučených seriálů. | **ZBÝVÁ OVĚŘIT / OPRAVIT.** P2.5, P2.5b. |
| Eventiv | Získat povolený přístup k obsahu, který nyní odmítá čtení. | **BLOKUJE POSKYTOVATEL.** P1.5. |

## Co z dřívější práce zůstává hotové

Ukládání se zdroji a ochranou ručních oprav, pokračování části přerušené práce, jednoduchý admin a Mac panel, tři celoroční kolekce 2027, odkazy na předchozí i další ročníky, doplněné místo pro vyhledávače a konkrétní dodané importy. Duplicita Die Mauer von Kendenich byla vyřešená. Tyto jednotlivé výsledky se nemají dělat znovu.

[Historický podrobný záznam před tímto zjednodušením](../reports/takeover-review-2026-11-05/tracker-before-simplification.md) slouží pouze k dohledání starých značek a důkazů. Tento soubor je jediný aktuální plán.

**Hotovo bude tehdy, když opakované skutečné běhy přidávají správné závody a informace, změny jsou na webu a ty nemusíš pomocníka hlídat. Dnes to ještě tvrdit nemůžeme.**
