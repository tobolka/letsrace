# LetsRace: co teď děláme

Aktualizováno 5. listopadu 2026 večer. Toto je hlavní seznam práce.

## Čeho chceme dosáhnout

**Pomocník sám najde závody, doplní správné informace a ukáže je lidem na webu. Stejný závod tam nebude dvakrát. Ty ho nemusíš hlídat.**

To ještě nemáme hotové. Opravené části nejsou důkazem, že dobře funguje celý pomocník.

## Co teď běží kde

Ověřeno 5. listopadu 2026 večer. **Jeden společný kód; rozdílné místo spouštění.** Část vpravo se změní až po nasazení; změna je připravená, nenasazená.

| Činnost | Mac | Server |
| --- | --- | --- |
| Sběr ze známých zdrojů | **Průběžně.** Je-li co dělat, navazuje do 30 s; jinak čeká na další splatnou práci, nejdéle 6 hodin. | `watch` a `explore` blokované firewallem; **po nasazení zrušené** |
| Weby pořadatelů | **Zapojené do každého průchodu.** Pokračuje v uloženém čtení a zakládá oznámené ročníky. | Nic |
| Údaje z webů závodů (kategorie, přihlášky, odkazy) | **Každých 6 hodin**, do místní kopie | **Po nasazení přestane číst weby.** Do té doby běží obojí; plní se jen prázdná pole, takže se nepřepisují. |
| Geokódování | **Každých 12 hodin**, 120 míst | **Po nasazení zrušené** |
| Kontrola zmlklých zdrojů | **Jednou týdně**, výsledek v soukromých datech | **Po nasazení zrušená** |
| Údržba bez čtení webů (slučování, přenos z minulého ročníku, dokončené závody) | Nic | Zůstává |
| Historie počasí | Nic | **Zůstává záměrně:** 60 s denně, ukládá na server a sdílí rozpočet poskytovatele. Přesun by serveru neulevil. |
| Zveřejnění, upozornění, přehled | Nic | Zůstávají; server smí ověřit 60 stránek denně |

**Původní zadání dál platí:** pokrytí závodů, správné a bohaté údaje, minimum duplicit, aktuální veřejný web, srozumitelný přehled a hlídané náklady.

## Aktuální priorita

Úplné předání a podklady: [předání od Codexu](../reports/codex-handoff-2026-11-05/HANDOFF-CLAUDE.md), [výsledek přesunu na Mac](../reports/mac-offload-2026-11-05/RESULT.md).

| Pořadí | Co zbývá dokončit | Stav |
| --- | --- | --- |
| **1** | Přesunout náročnou práci ze serveru na Mac. | **MAC HOTOVO, SERVER ČEKÁ NA NASAZENÍ.** Na Macu běží vše výše. Odstranění čtyř serverových úloh a čtení webů z `catalog` je připravené, ale nenasazené. |
| **2** | Mac průběžně dokončuje práci, nečeká 12 hodin. | **HOTOVO a ověřeno:** po práci navazuje, bez práce čeká a nesahá na server. Snímek serveru se stahuje nejvýše jednou za 3 hodiny a je o více než polovinu menší. |
| **3** | Weby pořadatelů a jejich nálezy v automatickém ukládání. | **HOTOVO a ověřeno:** prvních 12 ročníků 2027 je na webu. Čeká 212 závodů, které doslovné čtení nerozhodne; 604 nečitelných; 975 bez webu. |
| **4** | Bezpečně odesílat doložená doplnění existujících závodů. | **ČÁSTEČNĚ:** odesílá se jen to, co je na serveru prázdné a bylo prázdné i v kopii. První dávka 24 závodů a 3 místa bez konfliktu. Změny už vyplněných hodnot, dat a míst dál čekají (2 717 závodů má v kopii nějaký rozdíl, většinou jen čas posledního čtení). |
| **5** | Dotáhnout veřejné změny a staré odkazy. | **ČÁSTEČNĚ.** Sloučený Wels: stará adresa při kontrole dál vrací 200, nepřesměrovává. Na serveru čeká 292 kontrol stránek při 60 denně. Perun/Lakeland/GR8 neověřeno. |
| **6** | Chybně spojené závody a opakované chyby zápisu. | **ČÁSTEČNĚ.** Hlavní příčina opakovaných chyb opravena (ověřeno na 3 dříve padajících zdrojích). Řádky `identity_review_required` a původních 43 podezřelých spojení zbývají. |
| **7** | Dvě úplná čtení, nezávislá kvalita, skutečná spotřeba po přesunu. | **ZBÝVÁ.** Spotřebu lze změřit až po nasazení. |

### Co zůstává skutečně hotové

- Nový automatický režim Macu je nainstalovaný a zapnutý. **Oprava dřívějšího tvrzení:** „první automatický běh za 24 s, 0 splatných čtení“ nebyl prázdný běh. Čtečka v plánovači padala na mezeře v cestě a průchod to hlásil jako hotovo; to je opravené a nově to skončí jako chyba.
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
