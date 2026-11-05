> Historický snímek před zjednodušením 5. listopadu 2026. Není to aktuální plán. Aktuální je pouze docs/operations-progress.md.

# LetsRace · hlavní seznam práce

Stav k 5. listopadu 2026. Tento soubor je jediný aktuální seznam. Každý řádek má vlastní výsledek. Jakmile projde jeho kontrola, přesune se do **Hotovo** pod stejným ID.

| Stav | Význam |
| --- | --- |
| **HOTOVO** | Uvedený výsledek má konkrétní ověření. Sloupec s důkazem říká, zda jde o test, nasazení, živou kontrolu nebo měření. |
| **PRACUJI** | Právě prováděná konkrétní změna; řádek říká, zda je pouze v kódu, v testech nebo v živém běhu. |
| **DALŠÍ** | Nejbližší práce, kterou lze udělat. |
| **OTEVŘENO** | Konkrétní práce ve frontě. |
| **ČEKÁ** | K uzavření je potřeba doběh, měření nebo předchozí krok. |
| **BLOKOVÁNO** | Chybí přístup nebo souhlas k živému běhu. |

**Rozhodnutí vlastníka 4. listopadu.** Priorita je pokrytí a aktuálnost, začíná se Českem. Na zkoušku AI je 8 USD. Vlastník nechce rozhodovat jednotlivé případy, stačí neoficiální zdroj s dostatkem údajů a duplicity se mají řešit do několika hodin. Balast je vypnutý a kontroly omezené. [Výsledek úklidu](../reports/source-cleanup-2026-11-04/RESULT.md)

## Právě probíhá · 5. listopadu

**Aktivní bod je P0.6: aby každý běh přinesl dokončenou práci do katalogu.** Prioritu měním podle dnešního požadavku vlastníka. Opravy jednotlivých ochran jsou již nasazené; samy nejsou důkazem kvalitní pipeline. Vlastník dnes povolil omezené živé běhy. Plošná automatika zatím zůstává v pauze.

| Krok | Aktuální stav | Konkrétní výsledek / co právě dělám |
| --- | --- | --- |
| P0.6a · Omezit dlouhý sběr a zajistit čas pro doplňování a zveřejnění | **PRACUJI · kód upraven, probíhají testy** | Z běžného cyklu odstraňuji dočítání až 40 dávek zdrojů. Jeden cyklus má 15minutový strop a jednotlivé části vlastní limity. Zdroje, praktické údaje a zveřejnění přicházejí před rozsáhlou denní údržbou. Stejný dokument se při doplňování více závodů znovu nestahuje. Tyto nové změny ještě nejsou nasazené. |
| P0.6b · Změřit skutečný přínos omezeného živého běhu | **DALŠÍ · běh dosud nezačal** | Po testech pustím malou dávku zdrojů a doplnění detailů bez placené AI. Uložím skutečnou dobu, nové závody, změněné údaje, neúspěchy a veřejné výsledky. Podle nálezu opravím blokující příčiny. Samotné čtení nebo úspěšný test se nezapočítá jako lepší údaj. |
| P0.6c · Obnovit řízený provoz | **ČEKÁ na P0.6b** | Nastavit běhy podle ověřené spotřeby a přínosu, zachovat pauzu a omezit neproduktivní opakování. Mac a server neobnovím současně bez kontroly prvního výsledku. |
| Převzetí druhé AI a ochrany dat | **HOTOVO · nasazeno `c83578b4`** | Opravené záměny ročníků a termínů, příliš volné slučování, vypínání zdrojů po chybě a falešné potvrzování nepřečtených závodů. 1 556 testů prošlo. Dvě migrace jsou aplikované a kopie na Macu aktualizovaná. [Rozsah a důkazy](../reports/takeover-review-2026-11-05/RESULT.md). |

**Zjištěný rozsah problému:** 947 veřejných závodů pro rok 2027 v CZ/SK/AT/DE/PL/CH/IT; pouze 14 má neprázdný nový blok praktických údajů. To není měření jejich správnosti. Aktivních je 736 zdrojů; ve frontě kandidátů čeká 11 nových a 19 odložených záznamů. Nejde tedy o tisíce nalezených závodů čekajících na schválení. Historické měření ukázalo u 76 % čtení s podrobnými počítadly nulový nový i aktualizovaný záznam.

**Další otevřené problémy:** P0.4f (timeouty veřejného načítání ročníků) a P0.4a (celodenní rozpočet). Pracovní pořadí je nyní **P0.6a → P0.6b → odstranění zjištěných příčin → P0.6c**. Níže je úplná evidence dalších úkolů.

## Otevřené úkoly P0 · bezpečný provoz

| ID | Stav | Co se udělá | Hotovo, až |
| --- | --- | --- | --- |
| P0.3a | **ČEKÁ** | Fronta měla 4. listopadu 1 104 závodů a 87 seriálů při limitu 60 kontrol denně. Dříve ověřené nezměněné záznamy se kontrolují na 10% vzorku a nové změny mají přednost. Vlastník rozhodl, že všechny kontrolovat netřeba: 830 neověřených starých úloh se žádostí o obnovu je uzavřených mimo vzorek a zůstává 261 závodů a 20 seriálů. Rozebrat položky, které se opakovaně vracejí. | Staré úlohy jsou potvrzené nebo jednotlivě vysvětlené a novější změny nezůstávají čekat přes další běžný cyklus. Požadavky na obnovu a ověřené výsledky mají oddělená čísla. |
| P0.4a | **ČEKÁ** | Vyhodnotit celý den s pozastavenými scany po nasazení úspor. Rozdělit provoz na veřejný web, zveřejnění, monitor, počasí a ostatní. | Je uložený přesný interval, počet požadavků podle činnosti a dostupný údaj o skutečném objemu logů. Pro plošné obnovení musí být doložený provozní rozpočet; původní pracovní hranice je 16 000 požadavků za den. Vlastník 5. listopadu povolil malé měřené běhy před dokončením celodenního porovnání. |
| P0.4f | **OTEVŘENO** | Zjistit, proč obnova ročníků a kol seriálů na pozadí hlásí 20s timeout. Čerstvé logy 5. listopadu potvrzují výskyty i ve vydání `c4260fda`; instrumentace již zaznamenává dobu, cílovou tabulku/funkci a stav přerušení bez klíčů a parametrů. Samotná příčina ještě není prokázaná. 4. listopadu bylo ve Vercelu asi 140 chyb, ale Supabase nezaznamenal dotaz nad 3,5 s a všech 26 kontrolovaných detailů mělo odkazy na ročníky. | Je doložená příčina na straně funkce a chyby klesly. Selhání odkazů na ročníky je nově v logu, takže lze vyhodnotit, zda se projevuje návštěvníkům. |
| P0.4b | **ČEKÁ** | Pokud rozpočet nevychází, opravit největší změřený zdroj provozu nebo timeoutů a zopakovat měření. | Celodenní měření prokáže pokles. Detail, seznam, mapa a kalendář při běžných změnách zůstávají aktuální. Při splnění rozpočtu v P0.4a se tento krok uzavře jako nepotřebný. |
| P0.5a | **ČEKÁ** | Souhlas s omezenými běhy udělen 5. listopadu. Po prvním měřeném průchodu P0.6b ověřit souběh a zotavení. Zkusit dvě převzetí stejného zdroje, přerušení běhu a pokračování při vypnutém Macu. | Pilot má pevný rozsah a limity. Výsledek dokládá, že souběh ani pád neztratí práci a nevytvoří druhý závod. |
| P0.5b | **ČEKÁ** | Vyhodnotit dva běžné cykly před postupným obnovením automatického sběru. | Jsou doložené náklady, stabilita veřejného webu, návrat po chybě a přínos obou běhů. Po obnovení funguje stejná možnost okamžité pauzy. |
| P0.4c | **ČEKÁ** | Z pilotu spočítat přínos podle zdroje a druhu práce a podle něj upravit pořadí. | Přehled zvlášť uvádí skutečně nové závody, unikátní změněné závody, doložená doplnění, kontroly bez změny, čas, požadavky a dostupné náklady AI. Změny priorit mají oporu v těchto datech. |

**Dosavadní čísla.** Dne 4. listopadu mezi 01:10 a 20:00 prošlo Supabase 16 035 požadavků bez zaznamenaného běhu hlavního sběrače. Jde o výchozí interval před úsporami. Od 28. října do 3. listopadu proběhlo 2 326 zaznamenaných čtení. Součet časů zdrojů je 11 h 36 min, doba s alespoň jedním aktivním čtením je 4 h 11 min. U 76 % čtení s podrobnými počítadly se nevykázal nový ani změněný záznam. Historie neurčuje počet správně doplněných závodů. [Spotřeba](../reports/pipeline-traffic-2026-11-04/RESULT.md) · [Přínos sběru](../reports/pipeline-yield-2026-11-04/RESULT.md)

## Otevřené úkoly P1 · správnost dat a pokrytí

| ID | Stav | Co se udělá | Hotovo, až |
| --- | --- | --- | --- |
| P1.4d | **DALŠÍ** | Rozšířit první zmrazenou kontrolní sadu pro širší pilot. Doplňovat hlavně menší závody a chybějící disciplíny. | Původní cíl pilotu je 20 nedotčených ročníků na zemi, celkem 140. Zdroje a očekávané výsledky jsou zmrazené před měřením. [První průřez](quality/reference-2026-11-04.md) |
| P1.1a | **OTEVŘENO** | Sjednotit podmínky shody hlavního importu, importu kandidátů a následné kontroly duplicit. | Stejné dvojice zkoušek procházejí všemi cestami. Rozpor disciplíny, kola, ročníku nebo samostatné soutěže nezpůsobí automatické spojení. |
| P1.1b | **OTEVŘENO** | U nejasných shod uložit podklady a výsledek rozhodnutí. Zohlednit dřívější rozhodnutí při dalším importu. | Opakovaný import nepřidá už sloučený závod a znovu neotevře rozhodnutou dvojici bez nového podkladu. |
| P1.1c | **OTEVŘENO** | Doložit bezpečný návrat sloučení celého závodu. | Zkouška vrátí obě identity, adresy, zdroje, kategorie, seriály a uživatelské plány. Pozdější změny se nepřepíšou naslepo. |
| P1.2a | **OTEVŘENO** | Dokončit provozní ověření pravidelného výběru chybějících ročníků. Týdenní český průchod již existuje; opraveny záměny podle názvu, společného místa/webu, uzávěrky a nejasných shod. Testy prošly, celý cyklus po těchto opravách v pauze neběžel. | Sdílený web se čte jednou. Výstup rozliší novou doloženou edici, existující záznam, rozpor, nedostupný zdroj a chybějící oznámení. Nový termín má výslovný podklad pro nový rok. |
| P1.2b | **OTEVŘENO** | Vyzkoušet cílené hledání nových závodů podle mezer v zemích a disciplínách. | Výsledek odděluje nové zdroje, kandidáty, duplicity a skutečné nové závody s ověřitelným podkladem. U každé části je rozsah, přínos a spotřeba. |
| P1.3a | **OTEVŘENO** | Rozšířit čtení volného textu a složitějších podmínek startovného. | Kontrolní příklady pokrývají věkové a trasové varianty, cenová období a měny. Každá uložená cena má vlastní zdrojovou citaci a správnou podmínku. |
| P1.3e | **OTEVŘENO** | Upravit ochranu osmi přihlášek Dětského MTB Cupu tak, aby nevracela rok 2026, ale umožnila doloženou novou přihlášku 2027. Druhá AI zámkem opravila chybný odkaz, současně tím blokovala budoucí automatické doplnění. | Starý ročník zůstane odmítnutý a nový doložený odkaz se bezpečně uloží bez zásahu vlastníka. |
| P1.3b | **OTEVŘENO** | Ověřit přínos čtečky praktických údajů na širším vzorku skutečných propozic. | Porovnání ukáže správná doplnění i chyby u areálu, startu, pořadatele, cen a tras. Výsledky z archivních podkladů a skutečné změny katalogu se vykazují zvlášť. |
| P1.4b | **ČEKÁ** | Porovnat výsledek pipeline se zmrazenou kontrolní sadou a pilotem. | Jsou uvedené správnost termínu, místa a disciplíny, pokrytí, duplicity, chybná sloučení, náklady a počet a čas rozhodnutí vlastníka. |
| P1.5 | **BLOKOVÁNO** | Obnovit čtení Eventivu po vyřešení přístupu u poskytovatele. | Povolený přístup vrátí obsah závodů a test ověří, že výsledek zachovává dříve uložené závody. Aktuální doložený stav je HTTP 401. [Ověření](../reports/source-recovery-2026-11-02/RESULT.md) |

## Otevřené úkoly P2 · obsluha a veřejný web

| ID | Stav | Co se udělá | Hotovo, až |
| --- | --- | --- | --- |
| P2.1a | **OTEVŘENO** | Připojit konkrétní typ rozhodnutí ke schránce vlastníka. | Jeden skutečný případ vytvoří jedinou srozumitelnou otázku, odpověď se dohledatelně a bezpečně provede a bez odpovědi se úloha odloží. |
| P2.1b | **OTEVŘENO** | Prověřit rozdělení práce mezi serverem a Macem i mimo hlavní sběrač. V přehledu oddělit hledání zdrojů, hledání závodů ve známých zdrojích, doplňování a řešení rozporů. | Každá ze čtyř činností má srozumitelný výsledek a dohledatelné pokračování po pádu. Provozní chyby a otázky pro vlastníka jsou vidět odděleně. |
| P2.2 | **OTEVŘENO** | Doplnit srovnání kol seriálu a pravidla sezóny z doložených zdrojů. | Veřejný detail seriálu ukáže srovnatelné údaje a odkaz na platná pravidla, pokud pro danou sezónu existují. [Návrh detailů](race-series-next-content-2026-11-03.md) |
| P2.3 | **ČEKÁ** | Doplnit spolehlivé kraje a vybrat regionální kolekce s dostatkem dat. | Každá zveřejněná kolekce má smysluplný výběr závodů a funkční regionální přiřazení. |
| P2.4 | **ČEKÁ** | Nechat doběhnout úvodní doplnění historie počasí. | Čekající místa jsou doplněná nebo vysvětlená po jednotlivých příčinách. Spotřeba zůstává v nastaveném rozpočtu. |
| P2.5b | **OTEVŘENO** | Zachovat staré adresy seriálů Road Stage a L’Etape po jejich sjednocení druhou AI. | Staré veřejné adresy vedou trvalým přesměrováním na správný seriál ve všech jazycích, bez smyček a ztráty členství. |
| P2.5 | **OTEVŘENO** | Ověřit skutečné indexování a technické SEO reprezentativních detailů, seriálů a kolekcí. | Výsledek zvlášť uvádí správnost canonical, jazykových alternativ, sitemap a strukturovaných dat i stav indexování. [SEO podklady](seo-next-steps-2026-11-02.md) |

## Hotovo · konkrétní výsledky

| ID | Stav | Výsledek a důkaz |
| --- | --- | --- |
| P0.1 | **HOTOVO** | Hlavní sběrač má trvalé převzetí zdroje a společné potvrzení výsledku, stavu a termínu. Databázové zkoušky pokryly expiraci, druhé převzetí, pozdní výsledek a ruční pauzu. Živý souběh je P0.5a. |
| P0.2a | **HOTOVO** | Pravidelné zapisovače místa, termínu, registrace, disciplíny a kategorií respektují revize a ruční zámky. Souřadnice a bod pro mapu se ukládají spolu. V produkci se ze stávajících souřadnic doplnilo 204 bodů. Databázové zkoušky a vratná zkouška prošly. [Zápisy a návrat](../reports/atomic-catalog-writes-2026-11-03/RESULT.md) |
| P0.2b | **HOTOVO** | Nové i existující závody se ukládají se zdroji, kategoriemi, místem a vazbami. Schválení kandidáta má dohledatelný výsledek a přerušený zápis pokračuje. Jednotlivá doložená změna a celá sada kategorií mají chráněnou obnovu. [Zápis](../reports/watcher-evidence-bundle-2026-11-03/RESULT.md) · [Kandidáti](../reports/candidate-publication-2026-11-03/RESULT.md) · [Vazby](../reports/atomic-series-membership-2026-11-03/RESULT.md) |
| P0.3b | **HOTOVO** | Požadavek na obnovu a kontrola výsledku jsou oddělené. Detail závodu i seriálu se kontroluje v češtině, angličtině, němčině, polštině a slovenštině. První živá kontrola seznamu, mapy a kalendáře porovnala 1 006 závodů. Ověřovací limit je 60 denně, obnova nejvýše čtyři dávky po 200 za 24 hodin. Doběh je P0.3a. [Společný seznam](../reports/aggregate-publication-2026-11-02/RESULT.md) |
| P0.4d | **HOTOVO** | Kolize zápisu opakuje jen dotčené řádky a další pokus má odklad. Nezměněný kalendář lze potvrdit jedním databázovým požadavkem. Odstranění závodu kontroluje rozsah čtení, jiné zdroje a ruční zámky. Čtení ročníků a kol je jednodušší. [Opravy spotřeby](../reports/limits-2026-11-04/RESULT.md) |
| P0.4e | **HOTOVO** | Měření času, ID vytvořených a změněných závodů a počtu databázových požadavků je nasazené. Produkční logy potvrdily rozlišení webu a monitoru. Opakovaná chyba zdroje má denní odklad, Mac v pauze hlásí stav méně často a pořadatelské dotazy sdílejí výsledek. Úspora se měří v P0.4a. [Výchozí měření](../reports/pipeline-traffic-2026-11-04/RESULT.md) |
| P0.4g | **HOTOVO** | Automatické pozastavení zdrojů rozlišuje neproduktivní úspěšné čtení od chyby, odkladu, čekání na sezónu a otevřeného kandidáta. Databázová migrace aplikovaná, lokální databázové zkoušky prošly. Žádný další zdroj se při kontrole nevypnul. [Ověření převzetí](../reports/takeover-review-2026-11-05/RESULT.md) |
| P0.4h | **HOTOVO** | Přeskočené nezměněné řádky obnovují datum pozorování pouze u skutečně načtených ID. Nepřečtené a kolizní položky se tím nepotvrzují. Migrace, zkouška skutečné databázové funkce a test hlavního sběrače prošly. |
| P1.1f | **HOTOVO** | Slučování podle názvů bez zdrojové citace navíc vyžaduje shodu dne a délky akce, konkrétního místa, země a rodiny disciplíny; respektuje konflikty kol a seriálů. Ověřeny pozitivní i negativní případy. Nejde o dokončení celého P1.1a ani o živě změřenou správnost sloučení. |
| P1.2f | **HOTOVO** | Kontrola ročníků nepovažuje první podobný název ani jiný závod ve stejné obci/na webu za existující ročník. Nejasné shody čekají, uzávěrka nepřebije den závodu a sdílený web se kontroluje už u dvou závodů. Regresní příklady prošly; provozní ověření je P1.2a. |
| P1.1d | **HOTOVO** | Čtečka a AI zachovají různé závody ze stejného kalendáře a zohlední disciplínu i kolo. Sběrač při opakovaném použití ID zdroje kontroluje uloženou disciplínu. Regresní testy, `main` a nasazení `8ee4adf2`. |
| P1.1e | **HOTOVO** | Duplicita Die Mauer von Kendenich byla opravena se zachováním vazeb. Chotěbuz se opakovaně zpracovala bez vytvoření dalšího závodu. [Chotěbuz](../reports/source-recovery-2026-11-02/RESULT.md) |
| P1.2c | **HOTOVO** | Audit z archivu zachovává vícedenní termín a odděluje chyby čtení od vodítek. Ověřeno na snímku 4 685 závodů a na zkoušce ročníku 2028. Změna je v `main`. [Použití](annual-editions.md) |
| P1.2d | **HOTOVO** | Dávka českých závodů zpracována. JBC 4X zveřejněn, místo Road Stage Orlické hory opraveno v existujícím záznamu. Z UCI dávky přidán Szczyrk a doplněny Graz a Black Forest. Lost Ride je skrytý provizorní záznam, Oremon rekreační jízda. [Česká dávka](../reports/cz-2027-import-2026-10-31/REPORT.md) · [UCI dávka](../reports/uci-import-2026-11-03/RESULT.md) |
| P1.2e | **HOTOVO** | Srovnání Crawl4AI a Scrapling na 11 adresách je v `main`. Na tomto vzorku nepřineslo další kandidáty vůči stávajícím čtečkám. [Výsledky zkoušky](../reports/crawler-comparison-2026-11-04/RESULT.md) |
| P1.3c | **HOTOVO** | Strukturované praktické údaje mají zdroj, ruční zámky a transakční zápis. Tabulky i výslovně označené řádky textu procházejí kontrolou závodu a termínu. Nasazeno `8a88fb05`, 1 514 testů prošlo. Na veřejné Rohálovské ověřen pořadatel a start ve 12:30. [Praktické údaje a příklady](../reports/practical-reader-v3-2026-11-03/RESULT.md) |
| P1.3d | **HOTOVO** | U čtených cen se ověřuje částka společně s měnou a zachovávají se desetinná místa. Datum začátku platnosti se nevydává za uzávěrku. Ověřeno regresními testy ve vydání `8a88fb05`. Dodatečně se čte Euro, Kc, zl, Fr. a SFr. |
| P1.4a | **HOTOVO** | Zmrazený první průřez obsahuje 14 ročníků ze sedmi zemí, dvě kontroly neslučování a pět kontrol hranic podkladů. Zdroje a očekávané výsledky jsou uložené před porovnáním s katalogem. Formát a otisk ověřeny lokálně. [Kontrolní sada](quality/reference-2026-11-04.md) |
| P1.4c | **HOTOVO** | První oddělený výchozí vzorek má tři doložené případy ze dvou zemí. Fullgaz a Ötztaler po cílených opravách patří mezi regresní příklady. [Výchozí vzorek](../reports/independent-baseline-2026-11-03/RESULT.md) · [Provedené opravy](../reports/coverage-recovery-2026-11-03/RESULT.md) |
| P2.1c | **HOTOVO** | Jednoduchý admin a panel jsou nasazené. Technické nástroje jsou v `/admin/tools`, stav veřejného seznamu má vlastní údaj a schránka chrání před zastaralou odpovědí. Ověřeno po přihlášení. [Ověření](../reports/owner-admin-2026-11-02/RESULT.md) |
| P2.2a | **HOTOVO** | Detail má odkazy na předchozí i další ročníky, trvalou hlavičku, praktické údaje a odkazy na areál. Okolní závody jsou za zdroji. Vedlejší kola jsou dohledatelná. Michaelis-Schanze přestal zobrazovat trasu 0 km. [Oprava délky](../reports/zero-distance-2026-11-03/RESULT.md) |
| P2.3a | **HOTOVO** | Tři kolekce pro Česko, MTB a děti pokrývají celý rok 2027. Měsíce vedou na odpovídající část seznamu, nadbytečné souhrny jsou odstraněné. Veřejné stránky ověřeny. |
| P2.4a | **HOTOVO** | Historie počasí má trvalé úložiště, serverové doplňování a společné limity. Předpověď má krátkou platnost. Doběh úvodního plnění je P2.4. |
| P2.5a | **HOTOVO** | Doložený areál, adresa a pořadatel jsou ve viditelném detailu i ve strukturovaných datech. Nasazení a veřejná kontrola proběhly. Skutečné indexování je samostatně P2.5. |

Finanční limity platí dál. Trialové závody, nový koncept ověřovacích statusů a veřejné editační formuláře jsou mimo aktuální rozsah. [Provozní návod](keep-fresh.md) · [Historický plán sedmi etap](operations-autonomy-plan-2026-11-01.md)
