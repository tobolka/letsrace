# LetsRace: kde co běží a co ovládat

Aktuální provoz: **29. 10. 2026**. AI zůstává na Macu; její přesun na server byl na žádost zastaven.

| Co | Kde | Kdy se spustí samo | Kde to vidíš |
| --- | --- | --- | --- |
| Server zdarma | Vercel | Denně podle `vercel.json`, i při vypnutém Macu | Panel „Server zdarma“, poslední skutečný běh |
| Běžný sběr zdarma | Tento Mac | Po přihlášení; další kontrola 2 hodiny po dokončení | Ikona kola → „Mac zdarma“ |
| Sken federace ČSC | Tento Mac, Chrome | Pondělí při prvním cyklu od 09:00; také tlačítkem | „Federace ČSC“ → **Spustit sken federace** |
| AI kontrola | Tento Mac | Úterý a pátek, nejvýše jeden automatický pokus za den | „AI kontrola · na Macu“ |

Běžný sběr čte splatné zdroje přes HTML/API/PDF a podporované dynamické weby přes Chrome. Podporované země jsou **CZ, SK, DE, AT, CH, IT, PL**. Sken ČSC je konkrétní česká federace; neznamená sken federací všech sedmi zemí.

## Co dělat

**Běžně nic.** Po přihlášení se sběrač i panel spouštějí automaticky. V liště je jen ikona kola. Kliknutím uvidíš aktuální činnost, poslední sken federace a skutečný přínos posledního dokončeného běhu.

- Chceš znovu načíst federaci: **Spustit sken federace**. Pokud běží jiná práce, sken počká; druhý souběžný běh nevznikne.
- Chceš spustit běžný sběr: **Podrobnosti → Spustit sběr teď**.
- Chceš vidět průběh: **Podrobnosti → Otevřít živý log**.
- Chceš pauzu: **Pozastavit**. Běžící práce se dokončí. Tlačítko se změní na **Obnovit**.
- Zavření panelu sběr nezastaví. Panel znovu otevřeš z `~/Applications/LetsRace Monitor.app`.

Zelená znamená běh nebo úspěšné čekání. Oranžová znamená neúspěšné zdroje, podklady k ověření nebo neověřený stav serveru. Není to automaticky zaseknutý program. Červená znamená, že opravdu chybí čerstvé hlášení místního sběrače. Hlášení se obnovuje každých 10 sekund.

Při vypnutém Macu pokračuje server zdarma. Mac po zapnutí a přihlášení naváže. Serverová AI nyní **není zapnutá**.

## Výsledky a peníze

„Nové“ znamená nově založené závody. „Změněné“ znamená změněné uložené údaje, nikoli pouhé znovunačtení nebo posunutí času kontroly. Počet načtených řádků kalendáře ani počet zápisů do databáze není počet nových závodů.

Panel zachovává souhrn místních běhů a problémů za posledních 24 hodin. Prázdný úspěšný běh proto nesmaže předchozí chyby ani přínos. Historické neúspěšné kontroly nejsou počet právě rozbitých zdrojů: jejich aktuální počet a počet podkladů k ověření jsou z databáze uvedeny zvlášť. Po selhání ČSC zůstává vidět poslední skutečné načtení. Běžný sken, který ČSC načte, aktualizuje stejný stav jako ruční sken.

Zápis chrání přesnější disciplíny (například XCO před obecným MTB), neprázdné formáty a zařazení před prázdnou či obecnou hodnotou. Název země se nepočítá jako město a jeho souřadnice se nepoužívají jako poloha závodu. Země výslovně uvedená u místa má přednost před sídlem federace; polská Sobótka a česká Sobotka jsou odlišná místa. Kontroluje se i výsledná kombinace starých a nových údajů, včetně nemožného označení budoucího závodu jako dokončeného.

Jednotlivé databázové požadavky mají omezené čekání a zápisy sdílejí časový rozpočet zdroje. Odložené zápisy kvůli limitu se vykazují odděleně. ČSC opakuje připojení i změnu velikosti stránky po připojení Blazoru a odmítá neúplnou stránku místo vydávání deseti řádků za celý kalendář. Stejná kandidátní data s novým otiskem dokumentu automaticky nahradí starší čekající snímek; starý důkaz zůstane dohledatelný a nic se tím nepublikuje.

Záznam provedených oprav a živých ověření: `reports/tracker-audit-2026-10-29/REPORT.md`. Opravy údajů mají historii v `event_facts`; ověřené sloučení uchovává úplný snímek v `pipeline_merge_history`. Nejasné termíny se nehádají.

AI má společný limit **0,50 USD za den a 5 USD za měsíc**, placené hledání je vypnuté. Ledger se při restartu nemaže. Říjnová zaznamenaná útrata 7,68 USD vznikla před novým limitem; říjnová AI je proto blokovaná. Bezplatný sběr pokračuje.

Splatnost se respektuje: 1 564 aktivních zdrojů neznamená 1 564 nových závodů při každém cyklu. Pokud se zdroj nezměnil nebo ještě nezveřejnil rok 2027, další kontrola nemusí nic přidat. Nepodporovaná stránka se nezkouší stále dokola po dvou hodinách; čeká na další kontrolu za několik dní. Návrhy neznámých zdrojů a sporné závody zůstávají k ověření.

Reálné skeny ČSC během úpravy přečetly 419 záznamů a provedly 248 zápisů; nešlo o 248 nových závodů. Dva záznamy zůstaly k ověření: chybný konec před začátkem a rozpor identity. Chybné datum ani sloučení se nehádají.

## Jediné místní spuštění

Aktivní LaunchAgenty:

- `cz.letsrace.runner`: jediný správce místního sběru, automaticky se obnoví po pádu.
- `cz.letsrace.monitor`: panel v liště. Jeho zavření nezastaví správce sběru.

Původní `cz.letsrace.ingest-csc` je vypnutý a uložený jako `.plist.disabled`. Starou ruční smyčku nahradil správce. `keep-fresh.sh` při běžícím správci druhou smyčku odmítne spustit. Pomocné `fill-*`, discovery a archivní skripty jsou nástroje, nikoli další stále běžící sběrače.

Soukromý běhový adresář je `~/Library/Application Support/LetsRace/runtime`, stav a logy jsou v `~/Library/Application Support/LetsRace/data`. Přihlašovací údaje se v panelu nezobrazují. Zdrojový projekt zůstává v `Documents/GitHub/letsrace`; přemístění pracovního adresáře tak nezastaví naplánované úlohy.

Pro technickou kontrolu: `npm run pipeline:status` nebo `npm run pipeline:status -- --json`. Aktualizaci soukromé kopie po změně kódu provádí `scripts/install-local-runner.cjs`; při aktualizaci zachová data i rozpočet. Běžné používání žádný příkaz nevyžaduje.
