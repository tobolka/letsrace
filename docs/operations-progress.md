# LetsRace: co teď děláme

Aktualizováno 5. listopadu 2026 večer. Toto je hlavní seznam práce.

## Čeho chceme dosáhnout

**Pomocník sám najde závody, doplní správné informace a ukáže je lidem na webu. Stejný závod tam nebude dvakrát. Ty ho nemusíš hlídat.**

To ještě nemáme hotové. Opravené části nejsou důkazem, že dobře funguje celý pomocník.

## Co teď běží kde

Ověřeno 5. listopadu 2026 večer. **Jeden společný kód; rozdílné místo spouštění.** Serverová část je nasazená.

| Činnost | Mac | Server |
| --- | --- | --- |
| Sběr ze známých zdrojů | **Průběžně.** Je-li co dělat, navazuje do 30 s; jinak čeká na další splatnou práci, nejdéle 6 hodin. | Zrušené |
| Weby pořadatelů | **Zapojené do každého průchodu.** Pokračuje v uloženém čtení a zakládá oznámené ročníky. | Nic |
| Údaje z webů závodů (kategorie, přihlášky, odkazy) | **Každých 6 hodin**, do místní kopie | Weby už nečte |
| Geokódování | **Každých 12 hodin**, 120 míst | Zrušené |
| Kontrola zmlklých zdrojů | **Jednou týdně**, výsledek v soukromých datech | Zrušená |
| Údržba bez čtení webů (slučování, přenos z minulého ročníku, dokončené závody) | Nic | Zůstává |
| Historie počasí | Nic | **Zůstává záměrně:** 60 s denně, ukládá na server a sdílí rozpočet poskytovatele. Přesun by serveru neulevil. |
| Zveřejnění, upozornění, přehled | Nic | Zůstávají; server smí ověřit 60 stránek denně |

**Původní zadání dál platí:** pokrytí závodů, správné a bohaté údaje, minimum duplicit, aktuální veřejný web, srozumitelný přehled a hlídané náklady.

## Aktuální priorita

Úplné předání a podklady: [předání od Codexu](../reports/codex-handoff-2026-11-05/HANDOFF-CLAUDE.md), [výsledek přesunu na Mac](../reports/mac-offload-2026-11-05/RESULT.md).

| Pořadí | Co zbývá dokončit | Stav |
| --- | --- | --- |
| **1** | Přesunout náročnou práci ze serveru na Mac. | **HOTOVO a nasazené** (`03f379a5`). Na Vercelu zbylo 5 cronů: `alerts`, `catalog` bez čtení webů, `digest`, `publication`, `weather-history`. Úsporu lze změřit až za pár dní provozu. |
| **2** | Mac průběžně dokončuje práci, nečeká 12 hodin. | **HOTOVO a ověřeno.** Po práci navazuje, bez práce čeká a nesahá na server. Snímek serveru nejvýše po 3 hodinách. |
| **3** | Weby pořadatelů a jejich nálezy v automatickém ukládání. | **HOTOVO a ověřeno.** Prvních 18 ročníků 2027 je na webu. Placená AI v cyklu neběží. Co doslovné čtení nerozhodne, čeká; 201 případů jsem přečetl ručně, 42 mělo jasný termín a většina z nich už v katalogu byla. |
| **4** | Správnost nálezů. | **PRVNÍ MĚŘENÍ.** Doslovné čtení proti katalogu: 22 shod a 2 rozdíly ze 24. Jeden rozdíl byla skutečná chyba čtení (začátek přihlášek), opraveno; druhý je chyba spojení v katalogu (Góry 400). Ruční čtení se s katalogem shodlo ve 25 případech, u jednoho si stránka sama odporuje. Není to náhodný vzorek ani kontrola proti pořadatelům. |
| **5** | Pokrytí: závody bez výsledku čtení. | **ČÁSTEČNĚ.** Z 629 „nečitelných“ zbývá 71: 616 má jen stránku platformy (RaceResult, odjazd.pl, dostartu.pl), kde nový termín nebývá, a část přečetl Chrome (40 stránek za průchod). **Hledání webů běží po 4 hodinách, ale ve zkoušce našlo 0 jistých z 12.** Závodů bez webu je 974; většina pochází z federačních kalendářů, které ročník 2027 teprve zveřejní. |
| **6** | Doplňování existujících závodů. | **ČÁSTEČNĚ:** jen pole prázdná na obou stranách, nejvýš 60 závodů denně. Změny vyplněných hodnot, dat a míst dál čekají. |
| **7** | Veřejné změny a staré odkazy. | **ČEKÁ NA ZÍTŘEJŠÍ BĚH.** Přesměrování sloučeného Welsu je v kódu, úloha čeká s nejvyšší prioritou na běh v 5:40 UTC; ověřit. Fronta 302 kontrol: důležité jdou první, 221 má nízkou prioritu. Limit 60 denně se nezvyšoval kvůli spotřebě Vercelu. Perun/Lakeland/GR8 neověřeno. |
| **8** | Chybně spojené závody a opakované chyby zápisu. | **ROZDĚLENO.** 15 záznamů opraveno na Macu i serveru, záznam původních hodnot je v `reports/mac-offload-2026-11-05/split-journal-*.json`. Riva sloučena do správného záznamu. Stejná chyba by se už opakovat neměla: řádky jednoho kalendáře s různými ID a daty zůstávají oddělené. Ride&Rest čte správně akce přes přelom měsíce. 3 brevety vedené jako závod jsou přetypované na vyjížďku. |
| **9** | Treviso MTB. | **SLEDUJE SE NA MACU.** Přečteno 86 závodů, z toho 14 budoucích. Na server přibyl 1 nový, ostatní budoucí už v katalogu byly nebo čekají na kontrolu. Minulé závody zůstávají na Macu kvůli hledání dalších ročníků. Na rok 2027 web zatím uvádí jediný závod. |
| **10** | Dvě úplná čtení, kontrola spotřeby po přesunu. | **ZBÝVÁ.** |

## Přehodnocené pořadí (5. 11. večer)

Stav cíle: ročník 2027 má 203 z 3 760 závodů 2026 (5 %): AT 12 %, CH 10 %, DE 6 %, CZ 5 %, PL 4 %, SK 2 %, IT 2 %. Pořadatelé a federace většinu termínů teprve zveřejní, takže cíl 90 % je zatím mimo dosah a dál nejde dohnat čtením.

1. **Zdravé zdroje. PROVĚŘENO.** Číslo 299 z 737 bylo zavádějící. Rozebráno 298 stránek: skutečné chyby jsou jednotky, většina jsou weby jednoho závodu, které čte krok webů pořadatelů, a kalendáře s termíny 2027 (Roadcup, Austria Top Tour, dsergebnis) v katalogu jsou. 13 pomocných stránek už Mac nečte. Prověřené kalendáře nic zásadního neztrácejí; Chyby zápisu u velkých zdrojů je potřeba přeměřit, až doběhne dnešní vynucené čtení. Nástroj: `scripts/audit-unreadable-sources.ts`.
2. **Náhodný vzorek správnosti. PRVNÍ MĚŘENÍ.** 80 náhodných veřejných závodů 2027 s vlastním webem (`scripts/audit-race-sample.ts`, seed 20261105): 60 potvrzeno na webu pořadatele, 1 podezřelý (Gravel Trans Jura: máme 3. 6., web 2.–8. 6.), 19 nelze na vlastním webu ověřit (datum tam není, web neodpovídá nebo jde o stránku bez textu). Žádné jasně špatné datum. Kontroluje se datum, ne celý záznam, a jen u závodů s vlastním webem. Vedlejší nález: 15 závodů má v názvu předponu „Termine 2027 —“; čtečka je opravena, přejmenování na serveru čeká na souhlas.
3. **Federace a týdenní číslo pokrytí.** ČSC a FCI stojí za většinou ze 735 závodů bez webu v Česku a Itálii. Hlídat, že jejich kalendář 2027 zachytíme první den, a ukazovat číslo pokrytí po zemích.
4. **Spotřeba po přesunu.** Zkontrolovat za pár dní, jinak nevíme, jestli přesun pomohl.
5. **Údaje u závodů.** 676 z 1 211 budoucích závodů nemá odkaz na přihlášku, 171 nemá věkové kategorie.

Níž odsunuto: hledání webů (0 jistých z 12), RaceResult, změny už vyplněných údajů (většinou čas posledního čtení), navyšování limitu kontrol stránek.

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
