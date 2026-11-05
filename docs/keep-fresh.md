# LetsRace: kde co běží a co ovládat

Aktuální provoz: **2. 11. 2026**. AI zůstává na Macu; její přesun na server byl na žádost zastaven.

| Co | Kde | Kdy se spustí samo | Kde to vidíš |
| --- | --- | --- | --- |
| Server zdarma | Vercel | Denně podle `vercel.json`, i při vypnutém Macu | Panel „Server zdarma“, poslední skutečný běh |
| Běžný sběr zdarma | Tento Mac | Po přihlášení; další kontrola 2 hodiny po dokončení | Ikona kola → „Mac zdarma“ |
| Sken federace ČSC | Tento Mac, Chrome | Pondělí při prvním cyklu od 09:00; také tlačítkem | „Federace ČSC“ → **Spustit sken federace** |
| AI kontrola | Tento Mac | Úterý a pátek, nejvýše jeden automatický pokus za den | „AI kontrola · na Macu“ |

Běžný sběr čte splatné zdroje přes HTML/API/PDF a podporované dynamické weby přes Chrome. Podporované země jsou **CZ, SK, DE, AT, CH, IT, PL**. Sken ČSC je konkrétní česká federace; neznamená sken federací všech sedmi zemí.

## Co dělat

**Běžně nic.** Po přihlášení se sběrač i panel spouštějí automaticky. V liště je jen ikona kola. Po otevření uvidíš jeden stav, výsledek poslední dokončené kontroly a informaci o čekajících podkladech. Výsledky serveru a Macu se nesčítají; zobrazuje se nejnovější dokončený běh. Nové položky a uložené změny nejsou označené za nezávisle ověřená data.

- **Zobrazit podrobnosti** otevře jednotlivé sběrače, rozpočet, příčiny omezení a ruční nástroje. **Zpět na přehled** vrátí jednoduchý pohled.
- **Pozastavit sběr na Macu** pozastaví jen místní automatiku; běžící kontrola se dokončí. Server tím není pozastavený. Tlačítko se změní na **Obnovit sběr na Macu**.
- **Otevřít LetsRace** otevře web.
- Zavření panelu sběr nezastaví. Panel znovu otevřeš z `~/Applications/LetsRace Monitor.app`.

Čekající podklady nejsou vydávané za připravené otázky pro vlastníka. Dokud neexistuje samostatný ověřovatel fronty, panel to výslovně říká. Nedostupný server neznamená prázdnou frontu. Čerstvé hlášení Macu samo neznamená bezchybný celý systém. Panel neukazuje odhad zbývajícího času.

Zelená znamená běh nebo úspěšné čekání. Oranžová znamená skutečnou chybu čtení nebo zápisu, podklady k ověření nebo neověřený stav serveru. Nepodporované čtení je uvedené zvlášť jako potřeba jiné čtečky a samo o sobě neznamená selhání sběru. Není to automaticky zaseknutý program. Červená znamená, že opravdu chybí čerstvé hlášení místního sběrače. Hlášení se obnovuje každých 10 sekund.

Při vypnutém Macu pokračuje server zdarma. Mac po zapnutí a přihlášení naváže. Serverová AI nyní **není zapnutá**.

Mac posílá jednou za pět minut stručné provozní hlášení na stejný soukromý serverový přehled: stav, pauzu, další běh a číselný výsledek poslední kontroly. Neposílá místní cesty, seznam procesů ani obsah logů. Čas přijetí hlášení určuje server. Webový přehled tak může rozlišit čerstvě hlásící se Mac od vypnutého nebo nedostupného počítače.

Pravidelné, přímé i prohlížečové čtení nyní před čtením přebírá stejnou trvalou práci `source_read`. Jedno převzetí platí nejvýše dvacet minut; jiný pracovník ho nepřevezme a po pádu vyprší. Server nepřebírá práci označenou jako prohlížečová. Dosavadní termín `next_poll_at` zůstává plánem a převádí se do stejné fronty, takže nevzniká druhý nezávislý plánovač. Pozastavený zdroj se sám neaktivuje.

Změna závodu a žádost o zveřejnění se ukládají v jedné databázové transakci. Navazující pracovník obnoví konkrétní detail a kontroluje skutečné české a anglické HTML: totožnost, revizi, termín, stav a uložený odkaz na přihlášku. Při neshodě práce zůstává otevřená a opakuje se s odstupem. Stejné změny se slučují do jednoho čekajícího úkolu; starý pracovník nemůže prohlásit novější změnu za hotovou. Výslovné načítání má společný strop šedesáti pokusů za den, včetně přerušených pokusů. Ostatní jazyky se obnovují při návštěvě. Toto zatím neřeší čerstvost všech přehledů katalogu.

## Výsledky a peníze

„Nové“ znamená nově založené závody. „Změněné“ znamená změněné uložené údaje, nikoli pouhé znovunačtení nebo posunutí času kontroly. Počet načtených řádků kalendáře ani počet zápisů do databáze není počet nových závodů.

Panel zachovává souhrn místních běhů a problémů za posledních 24 hodin. Prázdný úspěšný běh proto nesmaže předchozí chyby ani přínos. Historické neúspěšné kontroly nejsou počet právě rozbitých zdrojů: jejich aktuální počet a počet podkladů k ověření jsou z databáze uvedeny zvlášť. Po selhání ČSC zůstává vidět poslední skutečné načtení. Běžný sken, který ČSC načte, aktualizuje stejný stav jako ruční sken.

Zápis chrání přesnější disciplíny (například XCO před obecným MTB), neprázdné formáty a zařazení před prázdnou či obecnou hodnotou. Název země se nepočítá jako město a jeho souřadnice se nepoužívají jako poloha závodu. Země výslovně uvedená u místa má přednost před sídlem federace; polská Sobótka a česká Sobotka jsou odlišná místa. Kontroluje se i výsledná kombinace starých a nových údajů, včetně nemožného označení budoucího závodu jako dokončeného.

Jednotlivé databázové požadavky mají omezené čekání a zápisy sdílejí časový rozpočet zdroje. Odložené zápisy kvůli limitu se vykazují odděleně. ČSC opakuje připojení i změnu velikosti stránky po připojení Blazoru a odmítá neúplnou stránku místo vydávání deseti řádků za celý kalendář. Stejná kandidátní data s novým otiskem dokumentu automaticky nahradí starší čekající snímek; starý důkaz zůstane dohledatelný a nic se tím nepublikuje.

Záznam provedených oprav a živých ověření: `reports/tracker-audit-2026-10-29/REPORT.md`. Opravy údajů mají historii v `event_facts`; ověřené sloučení uchovává úplný snímek v `pipeline_merge_history`. Nejasné termíny se nehádají.

AI má společný limit **0,50 USD za den a 5 USD za měsíc**, placené hledání je vypnuté. Ledger se při restartu nemaže. Říjnová zaznamenaná útrata 7,68 USD vznikla před novým limitem; říjnová AI je proto blokovaná. Bezplatný sběr pokračuje.

Splatnost se respektuje: 1 564 aktivních zdrojů neznamená 1 564 nových závodů při každém cyklu. Pokud se zdroj nezměnil nebo ještě nezveřejnil rok 2027, další kontrola nemusí nic přidat. Nepodporovaná stránka se nezkouší stále dokola po dvou hodinách; čeká na další kontrolu za několik dní. Návrhy neznámých zdrojů a sporné závody zůstávají k ověření.

Reálné skeny ČSC během úpravy přečetly 419 záznamů a provedly 248 zápisů; nešlo o 248 nových závodů. Tehdy dva záznamy zůstaly k ověření. Chybný konec před začátkem byl následně opraven 1. listopadu; aktuální stav ukazuje poslední skutečný sken. Chybné datum ani sloučení se nehádají.

## Týdenní kontrola nových ročníků

Místní cyklus jednou týdně spustí `scripts/check-next-editions.ts --country=CZ --apply`. Přečte weby závodů z minulé sezóny a u každého určí stav: nalezeno, zveřejněno, čeká s důvodem, zatím neoznámeno, jen zmíněný rok, nečitelné, nebo bez webu. AI jen navrhuje. Závod se založí, když citace s celým datem doslova stojí na webu téhož závodu, nejde o uzávěrku ani předběžný termín a stejný den není v katalogu podobný závod ze stejného místa nebo webu. Sporné případy zůstávají nezveřejněné a zkusí se další týden, vlastník je nerozhoduje.

Výsledek je v `edition-status.json` v denním adresáři `reports/next-edition-websites-*` a souhrn v `pipeline_jobs` pod klíčem `next-editions-cz`. Kontrola běží v prvním AI cyklu týdne a platí pro ni společné limity AI: 0,50 USD denně a 5 USD měsíčně. `EDITION_AI_BUDGET_USD` může limit na běh jen snížit. Do konce září se hledají ročníky aktuálního roku, od října ročníky příštího roku; jiný rok lze zadat přes `--season`. Pozastavení sběru na Macu zastaví i tuto kontrolu.

Náhled bez zápisu:

```bash
node scripts/with-node.cjs tsx scripts/check-next-editions.ts --country=CZ
```

## Duplicity

Každý místní cyklus sloučí jisté duplicity podle pravidel, bez AI a hned po zveřejňování. V AI dnech (úterý a pátek) AI projde všechny budoucí závody jako první ze svých úloh, nejvýše za 0,20 USD; co nestihne, zůstává na další AI den. Sloučit lze jen dvojici, kterou AI označí jako stejný závod a potvrdí ji stránka nebo shoda názvů. Přepínač `CATALOG_REVIEW_MERGES=1` vrací režim bez zápisu. Chybné sloučení se vrací příkazem `scripts/restore-event-merge.ts --history=<id> --apply`.

## Jediné místní spuštění

Aktivní LaunchAgenty:

- `cz.letsrace.runner`: jediný správce místního sběru, automaticky se obnoví po pádu.
- `cz.letsrace.monitor`: panel v liště. Jeho zavření nezastaví správce sběru.

Původní `cz.letsrace.ingest-csc` je vypnutý a uložený jako `.plist.disabled`. Starou ruční smyčku nahradil správce. `keep-fresh.sh` při běžícím správci druhou smyčku odmítne spustit. Pomocné `fill-*`, discovery a archivní skripty jsou nástroje, nikoli další stále běžící sběrače.

Soukromý běhový adresář je `~/Library/Application Support/LetsRace/runtime`, stav a logy jsou v `~/Library/Application Support/LetsRace/data`. Přihlašovací údaje se v panelu nezobrazují. Zdrojový projekt zůstává v `Documents/GitHub/letsrace`; přemístění pracovního adresáře tak nezastaví naplánované úlohy.

Pro technickou kontrolu: `npm run pipeline:status` nebo `npm run pipeline:status -- --json`. Aktualizaci soukromé kopie po změně kódu provádí `scripts/install-local-runner.cjs`; při aktualizaci zachová data i rozpočet. Běžné používání žádný příkaz nevyžaduje.

## Co je ve frontách administrace

Aktuální stav přestavby a podmínky obnovení scanů jsou ve [společném seznamu priorit](operations-progress.md).

„Discovery queue“ ukazuje zvlášť návrhy nových webů a podklady ke konkrétním závodům, které čekají na ověření termínu či identity. Počet práce zahrnuje obě skupiny. Navržený termín ve frontě není potvrzený den závodu. Přehled zdrojů neoznačuje čerstvé nepodporované čtení za poruchu; skutečné chyby spojení a zápisu zůstávají viditelné.

Eventiv nyní u veřejného kalendářového rozhraní vrací HTTP 401. Čtečka tuto skutečnost hlásí místo úspěšného prázdného výsledku. Uložené závody kvůli tomu nemaže; přístupové omezení neobchází. AI kontrola se řídí rozpočtem a není zárukou přečtení každé čekající stránky.

### Opakovaná kontrola čekajících podkladů

V panelu na Macu tlačítko **Co systém dělá** vysvětluje čtyři samostatné činnosti: hledání nových webů, závody ze známých webů, doplňování existujících závodů a ověřování sporných nálezů. Uvádí jejich nastavený režim a nedokončenou automatiku. Nezaměňuje tento popis za živé měření jednotlivých činností. Odtud jsou dostupné i podrobné nástroje.

Místní běžný cyklus nyní zahrnuje `recheck-discovery-candidates.ts --max=20 --apply`. Zkontroluje pouze splatné podklady ve stavu pending/waiting/conflict. Datum dalšího pokusu a výsledek jsou společně uložené v `pipeline_candidates.decision.followUp`; původní rozhodnutí, důkaz, stav a vazba na závod zůstávají zachované. Pracovní převzetí na pět minut brání souběžným pokusům a po pádu samo vyprší. Změna rozhodnutí během čtení zabrání přepsání novějšího výsledku.

Čte se původní zdroj, výslovný detail/web z podkladu a případně výslovně doplněné `decision.recheckUrls` (nejvýše čtyři). Adresy se nehádají. Sdílené adresy se v jedné dávce načtou jednou. Pozastavené nebo odmítnuté zdroje se neaktivují ani nečtou; kontroluje se i normalizovaná adresa bez sledovacích parametrů. Běh má limit tři minuty a nepoužívá model ani placené hledání. Snímky přečtených dokumentů jsou v soukromém místním `tmp/candidate-follow-ups/`.

U konkrétního detailu Bikepoint kontrola následuje nejvýše dva skutečné odkazy označené „organizátor“, do celkového limitu šesti adres na podklad. Neprochází kvůli tomu celý kalendář, reklamy, jiné závody ani sociální profily. Ukládá `linkedFrom`, snímek a další kontrolu odkazovaného webu. Je to dohledání dalšího podkladu, nikoliv potvrzení autority nebo pravdivosti údaje. Stejná pravidla pozastavení platí i pro nově nalezený odkaz. Servisní `--id=<candidate UUID>` zkusí jeden konkrétní podklad dříve; nepřevezme živou práci jiného procesu.

Nezměněný podklad se vrátí za sedm dní. Selhání se zkusí za hodinu, šest hodin, den, tři dny a potom nejvýše jednou týdně. Změna textu se označí pro navazující ověření a znovu zkontroluje za den; samotná změna celého kalendáře nepotvrzuje změnu konkrétního závodu. První snímek bez starého srovnatelného otisku je pouze výchozí stav. Neúplné čtení není úspěšná kontrola a úspěšný snímek zůstane zachovaný i přes další výpadek.

Tento krok **nepublikuje, neslučuje ani neověřuje pravdivost závodu**. Odstraňuje čekání bez dalšího pokusu; samostatné vyhodnocení nových podkladů ještě není dokončené. Běží na Macu, při jeho vypnutí čeká a po zapnutí pokračuje podle společně uložených termínů. Ručně lze použít stejný příkaz bez `--apply` pro čtení a náhled bez změn databáze. Vypnutím tohoto kroku se zachovají všechny dosavadní snímky i rozhodnutí.

Při explicitním rozhodnutí zveřejnit kandidáta se před zápisem používá společná kontrola `validateReviewSource`, také přímo uvnitř zapisovače. Ověřuje aktuální dokument proti posouzenému snímku, doslovné citace a výslovný rok; konec vícedenního závodu také potřebuje doklad. Samotný název země nenahrazuje místo. Zapisovač zachovává kontrolu odmítnutých/pozastavených zdrojů a ochrany identity a ručních zámků. Jde zatím o cestu posouzených kandidátů, ne o záruku sjednocení všech automatických zápisů nebo ověření veřejné stránky.

Další ročníky se hledají přes skutečné odkazy a oznámení pořadatelů. Sběrač již automaticky nezakládá ani neoživuje sledované adresy pouhou změnou roku v URL; tato cesta vytvářela neověřené články a archivní adresy. Dříve načtené užitečné zdroje zůstávají sledované.

## Nový automatický režim Macu · 5. listopadu 2026

`local-runner.cjs` spouští `local-cycle.sh`, nikoli starý průchod zapisující při čtení na server. Výchozí interval je **12 hodin**. Přihlášení uživatele spustí plánovač; po uspání nebo vypnutí naváže, bez souběhu dvou vlastních průchodů. Pauza a okamžité zastavení jsou odlišné: pauza nechá rozdělaný průchod dokončit, zastavení ukončí další kroky včetně odesílání.

Jeden průchod stáhne čerstvý srovnávací katalog, čte splatné zdroje do trvalé místní databáze, oddělí nejasné nálezy a bezpečně odešle nejvýše 20 prověřených nových závodů. **Pracovní databázi neobnovuje ze serveru před každým během.** Zachová tedy otisky stránek, další termíny čtení a rozdělané výsledky. Přerušené čtení není důvod přečíst celý katalog znovu.

První zapnutý rozsah jsou **nové závody ze známých zdrojů**. Změny existujících závodů zůstávají místně k posouzení. Placená AI ani hledání zcela nových webů v tomto režimu neběží. Starý serverový sběr `watch`/`explore` zůstává blokovaný. Server dál zajišťuje veřejný web, počasí, samostatné geokódování a potvrzení zveřejnění ve společných limitech. Odeslání do databáze není potvrzení veřejného zobrazení; to zaznamenává existující fronta kontrol, nikoli další neomezený kontrolor.

Stav průchodu: `~/Library/Application Support/LetsRace/data/local-cycle-latest.json`. Jednotlivé výsledky, přesný odeslaný návrh, potvrzení zápisu a důvody držení zůstávají v `data/local-cycles/<čas>/`. Panel ukazuje skutečně uložené nové závody, dobu běhu a odloženou práci. Nezaměňuje místní změny za zveřejněné výsledky.

Instalace: zkompilovat monitor podle `macos/LetsRaceMonitor/README.md`, potom `node scripts/with-node.cjs scripts/install-local-runner.cjs`. Instalace zachová pauzu. Zapnutí: v panelu „Obnovit sběr na Macu“. Ověřit první řízený průchod, jeho výsledek a další naplánovaný čas v `monitor.json`; samotná přítomnost procesu není důkazem úspěšného sběru.
