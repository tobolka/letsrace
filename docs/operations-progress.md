# Zjednodušení provozu LetsRace — stav realizace

Aktualizováno 4. listopadu 2026. **Hotové dílčí úkoly jsou zaškrtnuté; otevřené úkoly zůstávají nezaškrtnuté.** Číslování etap odpovídá původnímu zadání. Původní časové odhady se nepoužívají.

## Přehled sedmi etap

| Etapa | Stav | Co je hotové | Co ještě není hotové |
|---|---|---|---|
| **0. Společná pravidla a výchozí měření** | **Částečně** | Server a Mac rozlišují skutečnou chybu, nepodporované čtení a odloženou práci. | Rozšířit první tři nezávislé kontrolní případy na měření pravdivosti a pokrytí; dokončení kontroly všech pravidelných zapisovačů. |
| **1. Jednoduchý přehled a panel** | **Rozhraní hotové, automatika částečně** | Jednoduchý panel na Macu, nový `/admin`, servisní nástroje zvlášť, schránka a ochrana zastaralých odpovědí. Admin již ukazuje poslední kontrolu společného seznamu. | Automatické vytváření konkrétních otázek a provedení odpovědí. Samotná schránka to neřeší. |
| **2. Trvalé řízení práce** | **Částečně** | Sdílené převzetí čtení zdrojů, expirace, opakování a kontrola přijetí výsledku. Hlavní i vedlejší vazby seriálů se ukládají společně. | Společné řízení všech druhů práce a ochrana každého zápisu po ztrátě převzetí. |
| **3. Společné ověření a zveřejnění** | **Částečně** | Posouzený kandidát má časově omezené převzetí, společný zápis závodu se závislostmi a konečným stavem a pravidelné obnovení přerušené práce. Společný zápis nového závodu v hlavním sběrači včetně místa, zdrojů, podkladů, kategorií a vazeb; také úprav pořadatele, existujícího závodu se zdroji/snímky/kategoriemi a historií, vazeb seriálů a praktických údajů. Upozornění na změny mají trvale uložené pokračování. Trvalé požadavky na zveřejnění, oddělené kontroly detailů a společného seznamu/mapy/kalendáře. | Dokončit ostatní zapisovací cesty mimo hlavní sběrač a nahromaděné kontroly. Příprava metadat seriálu zůstává samostatná. |
| **4. Automatické řešení podkladů a duplicit** | **Částečně** | Konkrétní duplicity opravené, ochrany identity a ručních zámků, opakované čtení podkladů. | Jednotná pravidla samostatného řešení rozporů a bezpečných shod, včetně obnovy chybných sloučení. Opakované čtení není vyřešený případ. |
| **5. Lepší pokrytí a doplňování** | **Částečně** | Čtení odkazovaných pořadatelů, doplnění praktických údajů u JBC, Podkrkonošského maratonu a Rohálovské; více zdrojů a střídání nepřečtených odkazů. Dodané dávky závodů zpracované v uvedeném rozsahu. | Plošné doplnění katalogu, pravidelné hledání chybějících ročníků a mezer podle země/disciplíny, širší podpora textů a cenových podmínek, měřený čistý přínos. |
| **6. Nezávislé ověření zlepšení** | **Zahájeno, bez důkazu zlepšení** | Regresní a provozní testy; tři zdrojově vybrané a přímo ověřené případy s uloženou referencí a výchozím porovnáním. | Rozšířit nezávislou sadu, negativní případy, cenu a čas vlastníka; provést následné měření. První cílený vzorek není důkaz zlepšení celého katalogu. |

**Žádná celá etapa zatím není dokončená v původním rozsahu.** To ale neznamená, že níže označené dokončené opravy čekají na provedení znovu.

## Hotovo — nezadávat znovu jako nedokončenou práci

- [x] **Opakování kalendáře po kolizi:** úspěšné nezměněné položky se nepřepisují, odložená práce zůstává u konkrétního řádku. Výpisy seriálu a ročníků mají nové databázové dotazy. [Měření a další ověření](../reports/limits-2026-11-04/RESULT.md).
- [x] **Fullgaz a Ötztaler:** nový doložený ročník a opravená klasifikace existujícího závodu. [Výsledek](../reports/coverage-recovery-2026-11-03/RESULT.md).
- [x] **Ochrana při obnově kalendáře:** potvrzení nezměněného zdroje je jeden databázový požadavek. Skrytí závodu vyžaduje platné převzetí práce, dostatečný překryv, chybějící položku ve skutečně přečteném rozsahu, žádný další zdroj a žádný ruční zámek. Změna a její historie vznikají společně.
- [ ] **Podmínky pro obnovení scanů:** nejdřív změřit celý den veřejného provozu po nasazení. Se souhlasem vlastníka potom ověřit malou pevně omezenou dávku na Macu, stejný vzorek zopakovat na serveru a prověřit souběh na jednom zdroji. Zaznamenat pokusy o zápis, změny, odklady, počty požadavků a objem logů. Dva běžné cykly musí potvrdit funkční opakování a denní spotřeba se musí vejít pod 16 000 požadavků i do skutečného rozpočtu logů. Scany do té doby zůstávají vypnuté.

- [x] **Nový přehled a panel:** běžné ovládání je oddělené od technických nástrojů; poslední kontrola společného seznamu má samostatný údaj. [Výsledek adminu](../reports/owner-admin-2026-11-02/RESULT.md).
- [x] **Kontrola podkladu kandidáta i v zapisovači:** nový zápis nespoléhá jen na dřívější náhled; citované části musí odpovídat zdroji. Tvorba celého záznamu kandidáta ještě není jeden společný zápis.
- [x] **Nový závod v hlavním sběrači:** závod, plánované místo/geokódování, zdrojová vazba, snímek a kontrolní otisk čtení, kategorie, hlavní/vedlejší vazby seriálů i požadavky na zveřejnění se ukládají společně. Pravidelné čtení před zápisem ověřuje aktuální převzetí zdroje. [Zkoušky pádu a databáze](../reports/atomic-watcher-create-2026-11-03/RESULT.md).
- [x] **Změna existujícího závodu a její historie dohromady:** aktuální ruční zámky, odmítnutí starého návrhu po souběžné změně, ochrana klíče jiného závodu. Plánované místo a vedlejší vazby se provedou až po této kontrole ve stejné transakci, aby nevyvolávaly vlastní falešný souběh. [Původní krok](../reports/atomic-watcher-update-2026-11-03/RESULT.md), [navazující oprava](../reports/atomic-watcher-create-2026-11-03/EXISTING-DEPENDENCIES.md).
- [x] **Hlavní i vedlejší seriály:** společné uložení vazeb a původu; vedlejší kola se zobrazují i v přehledu seriálu. [Výsledek](../reports/atomic-series-membership-2026-11-03/RESULT.md).
- [x] **Zveřejnění seriálů a změn jejich kol:** trvalé požadavky včetně staré adresy při přejmenování, bez nové práce při pouhém opakovaném čtení. [UCI a návaznost seriálů](../reports/uci-import-2026-11-03/RESULT.md).
- [x] **Oddělené vyžádání aktualizace a kontrola výsledku:** společný seznam/mapa/kalendář mají vlastní kontrolu proti databázi. První doložená dávka ověřila 1 006 záznamů; nejde o aktuální počet závodů ani o indexaci Googlu. [Výsledek](../reports/aggregate-publication-2026-11-02/RESULT.md).
- [x] **Doplnění disciplíny ze seriálu:** aktuální stav a ruční zámky, původ údaje, historie a zveřejnění jsou chráněné společným zápisem. [Výsledek](../reports/atomic-catalog-writes-2026-11-03/RESULT.md).
- [x] **Návrat jednotlivé zaznamenané změny:** zachování novější opravy a zámků, žádné částečné odstranění původně vložených kategorií. Návrat celé dříve nahrazené sady kategorií ještě podporovaný není. [Výsledek](../reports/atomic-catalog-writes-2026-11-03/RESULT.md).
- [x] **Kontrola přijetí dokončení čtení a dalšího pokusu:** odmítnuté potvrzení se nehlásí jako úspěšný běh. [Výsledek](../reports/atomic-catalog-writes-2026-11-03/RESULT.md).
- [x] **Další skutečné praktické údaje:** Rohálovská 2027 má uloženého pořadatele a hlavní start 12:30; nezávislé položky z více dokumentů se nezahazují, částečné čtení zůstává k opakování. [Výsledek](../reports/practical-reader-v3-2026-11-03/RESULT.md).
- [x] **Chotěbuz:** opravené čtení, zachované ID i známé údaje, skutečný opakovaný běh bez nové duplicity. [Obnova zdroje](../reports/source-recovery-2026-11-02/RESULT.md).
- [x] **Neznámá délka není 0 km:** opravený import, společné zpracování i detail; nesmyslná položka Michaelis-Schanze odstraněná se zachováním historie. [Výsledek](../reports/zero-distance-2026-11-03/RESULT.md).

- [x] **Dokončení posouzeného kandidáta:** převzetí s expirací a ochranou starého běhu, nový i existující závod se zdrojem/podklady/kategoriemi a konečným stavem v jedné transakci. Pravidelný běh obnovuje pouze již schválené přerušené zápisy; nové kandidáty neschvaluje. Starší přerušené zápisy bez tokenu vyžadují kontrolu. [Ověření](../reports/candidate-publication-2026-11-03/RESULT.md).

- [x] **Závislosti běžných aktualizací a pokračování upozornění:** hlavní sběrač společně ukládá zdroje, snímky a kategorie; změny termínu/zrušení/přihlášek/disciplin mají trvale uložené dokončení podle skutečně zapsaných hodnot. Stejný zápis používají kandidáti. [Ověření](../reports/watcher-evidence-bundle-2026-11-03/RESULT.md).

## Není hotovo — konkrétní zbývající práce

- [ ] **Převést ostatní přímé zapisovače:** zapisovací cesty mimo hlavní sběrač; kontrola stále platného převzetí uvnitř ostatních zápisů. Hlavní sběrač již společně ukládá i zdroje/snímky/kategorie a trvalou práci upozornění. Doplnit bezpečnou obnovu celé nahrazené sady kategorií.
- [ ] **Dokončit nahromaděné kontroly veřejných výsledků** při zachovaných limitech. Vyžádání aktualizace neoznačovat za ověřenou stránku.
- [ ] **Vytvářet a provádět konkrétní rozhodnutí:** technické chyby řešit automaticky, vlastníka se ptát jen na nezbytnou volbu; odpověď musí mít skutečný a dohledatelný účinek.
- [ ] **Sjednotit automatické řešení rozporů a duplicit:** jasná pravidla pro jednoznačné případy, odložení nejasných, zachování adres, vazeb a plánů, prevence návratu duplicity a obnovitelnost.
- [ ] **Zajistit systematické pokrytí a doplňování:** chybějící ročníky podle výslovně oznámených termínů, mezery zemí/disciplin, více podporovaných zdrojů a měření skutečně doplněných údajů. Jednorázový audit webů není hotová pravidelná automatika.
- [ ] **Rozšířit a dokončit nezávislé měření:** první tři přímo ověřené referenční případy a výchozí porovnání už existují. Doplnit reprezentativnější země/discipliny, negativní případy, chybná sloučení, náklady a čas vlastníka a následné porovnání. Případy použité k opravě dále nepočítat jako nedotčenou kontrolu. [První skutečné měření](../reports/independent-baseline-2026-11-03/RESULT.md).

## Pravidla, která stále platí

- Čekající podklad není automaticky otázka pro vlastníka. Souběžná změna se nejprve znovu vyhodnotí.
- Úspěšné čtení stránky není potvrzení všech jejích údajů; návrh modelu není samostatný zdroj pravdy.
- Zápis v databázi, veřejný výsledek a indexace Googlu jsou různé věci.
- Finanční limity zůstávají zachované. Kontroly detailů mají limit 60 pokusů denně; dávka vyžádání aktualizací nejvýše 200 položek a čtyři pokusy za 24 hodin. Požadavek na aktualizaci seriálu není kontrola jeho obsahu.
- Pravidla nových ročníků: [annual-editions.md](annual-editions.md). Nové datum se neodvozuje z minulého roku.
- Trialové závody z dodané přílohy se na přání vlastníka nepřidávají. Odložený návrh ověřovacích statusů ani veřejné editační formuláře se neobnovují.

Podrobnosti k SEO, počasí a jednotlivým dodaným závodům: [přehled úkolů](work-tracker-2026-11-03.md). Běžný provoz: [keep-fresh.md](keep-fresh.md). Původní návrh: [historický plán](operations-autonomy-plan-2026-11-01.md); současný stav určuje tento dokument.
