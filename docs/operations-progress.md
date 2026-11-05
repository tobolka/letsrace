# LetsRace: co teď děláme

Aktualizováno 5. listopadu 2026. Toto je hlavní seznam práce.

## Čeho chceme dosáhnout

**Pomocník sám najde závody, doplní správné informace a ukáže je lidem na webu. Stejný závod tam nebude dvakrát. Ty ho nemusíš hlídat.**

To ještě nemáme hotové. Opravené části nejsou důkazem, že dobře funguje celý pomocník.

## Co dělám právě teď

**Nové omezení, přímo ověřené ve Vercelu:** za zobrazených posledních 30 dní je využito 9 hodin 28 minut CPU proti limitu 4 hodin. Samotný LetsRace tvoří 9 hodin 1 minutu (95,3 %). Je potřeba zjistit podíl veřejného webu a sběru a omezit největší příčinu. Další velké běhy se zatím nepouštějí; první malá zkouška už skončila.

**Opravuju, jak si pomocník rozděluje práci. Našel jsem i zbytečné výpočty při zobrazování ročníků. Místní porovnání na stejných datech zrychlilo tuto část ze 4,7 sekundy na 0,064 sekundy a vrátilo stejné odkazy. Úsporu celého Vercelu ještě nemáme změřenou.**

Dosavadní průchod mohl dlouho hledat a opakovaně číst stejné stránky. Doplnění a zobrazení informací přišlo na řadu až pozdě. Nový průchod dokončuje menší kus práce: našel → doplnil → ukázal.

| Pořadí | Úkol | Stav |
| --- | --- | --- |
| **1** | Dlouhé hledání musí skončit včas. Doplnění údajů a zobrazení na webu dostane vlastní čas. Stejná stránka se v jednom průchodu nebude stahovat znovu pro každý závod. | **HOTOVÉ A OTESTOVANÉ.** Malý běh doběhl. Nasazeno v hlavní větvi i na serveru (`1ba374af`). Kopie na Macu je aktualizovaná; velké pravidelné běhy ještě nepouštím. |
| **2** | Pustit malý skutečný běh a zkontrolovat, co přinesl. | **PRVNÍ BĚH DOBĚHL za 39 sekund.** Čtyři zdroje, sedm přečtených detailů, 18 stažených dokumentů. Žádný nový závod ani užitečné doplnění, bez placené AI. Samotná nula není chyba; u části načtených propozic ale pořadatel i program existují a čtečka je nezískala. |
| **3** | Když něco nedotáhne, opravit příčinu a zkusit to znovu. | **OPRAVENO A NA JIČÍNĚ ŽIVĚ OVĚŘENO.** Výběr vynechává automaticky přidané stránky výsledků a slavnostního vyhlášení. Čtečka nově rozumí běžným propozicím v PDF: v Jičíně uložila pořadatele, areál a šest startů. Na veřejném detailu jsou tyto údaje vidět. Oprava programu je nasazená. Další dosud nepoužité propozice se teprve musí ověřit. |
| **4** | Zapnout pravidelné běhy v ověřeném rozsahu. | **ČEKÁ na ověření spotřeby a širšího vzorku.** Velké automatické scany jsou zatím pozastavené. |

Tyto kroky mají značky P0.6a–c. Původní číslování není pořadí práce.

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

Při dnešní kontrole jsme v sedmi podporovaných zemích našli **947 veřejných závodů pro rok 2027**. Jen **14** má vyplněný nový blok praktických informací. Některé údaje jsou uložené i jinde; tato čísla neříkají, že ostatní detaily jsou úplně prázdné ani že těch 14 je všechno správně.

Sledujeme **736 aktivních zdrojů**. Na rozhodnutí čeká **30 nalezených záznamů**: 11 nových a 19 odložených. Není tedy doložené, že máme tisíce hotových závodů, které stačí zveřejnit.

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
