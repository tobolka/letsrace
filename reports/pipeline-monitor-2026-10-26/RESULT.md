# LetsRace Monitor — provozní výsledek 26. 10. 2026

Nainstalovaný nativní panel: `~/Applications/LetsRace Monitor.app`. V liště je pouze systémová ikona kola. Bílý přehled má čtyři bloky s vlastními akcemi: server zdarma, běžný sběr na Macu, ČSC přes Chrome na Macu a AI na Macu. Přesun AI na server byl na žádost zastaven; serverová AI není nově zapnutá.

Každý blok ukazuje poslední a další spuštění, dostupný výsledek a vysvětlení problémů. AI má viditelný důvod zablokování. Čas dokončení je pouze odhad z historie; při chybějících nebo překročených datech se neuvádí falešný zbývající čas. Procenta znamenají vyplněnost základních údajů v uloženém katalogu, nikoli podíl všech existujících závodů.

## Živé důkazy

- Správce sběru automaticky obnoven po řízeném ukončení: PID 86978 → 87081; čerstvé hlášení, zachovaný příští termín a výsledky, žádný duplicitní běh.
- Jedna instance panelu; spuštění je nyní přes macOS Launch Services, ochrana proti duplicitám navíc používá zámek.
- Starý samostatný ČSC LaunchAgent je vypnutý. `keep-fresh.sh` odmítne druhou smyčku, pokud již běží správce.
- Reálný sken ČSC 16:13–16:14: 419 přečtených, 248 zápisů, 0 nových a 139 změněných závodů. Změna není samostatný důkaz správnosti celého závodu.
- Následující sken 16:24–16:26: 419 přečtených, 248 zápisů, 0 nových a 7 změněných závodů. Dva sporné záznamy se neuložily: csc-1695 má konec před začátkem; csc-1619 rozpor identity. Záznamy zůstaly k ověření, nesloučily se násilně.
- Skutečná serverová kontrola doběhla: 0 splatných zdrojů, 0 nových, 0 změněných. Neoznačeno jako přírůstek katalogu.
- Poslední běžný místní běh měl 15 neúspěšných zdrojů: 6 spojení, 4 nepodporované/bez použitelného seznamu, 3 příliš velké dokumenty, 2 HTTP 500. Panel nabízí srozumitelné vysvětlení a příslušné domény. Tyto chyby nejsou prohlášeny za opravené.
- Výchozí přehled: 2027 má 803/870 uložených závodů se základními údaji (92 %), 2026 314/322 (98 %); přehled zobrazuje i čas svého pořízení.
- Souhrn čteček za 24 hodin: 698/1028 dokončeno bez výhrad, 330 neúspěšných či neúplných; jde o všechny cesty dohromady. Splatných 0 ze 1564 aktivních zdrojů. Nejde o procento pokrytí všech závodů.
- Říjnový lokální ledger zůstává 7,6839674 USD; nový limit 5 USD další placenou práci blokuje. Při této kontrole nebylo potřeba nové placené AI volání.

Serverové sledování a chráněný stav jsou nasazeny na `letsrace.cz`; poslední ověřený deployment je `letsrace-nctuhiydb-tobolkas-projects.vercel.app`. Chráněná cesta odmítá anonymní požadavek HTTP 401; soukromé provozní tabulky a RPC nejsou přístupné veřejnosti. Zdrojový checkout zůstává rozpracovaný, bez nového commitu/pushe.

## Ověření

1182 testů / 173 souborů, TypeScript, cílený lint a produkční build prošly. Swift 6 sestavení prošlo. Izolovaný test správce ověřil pauzu, skutečný start testovací úlohy, správné čítače, čerstvé hlášení a obnovení výsledků bez opakované práce. Rozložení čtyř bloků bylo zkontrolováno přímým vykreslením skutečného AppKit pohledu do obrazu. Není to zachycení živé plochy.

Návod: `docs/keep-fresh.md`. Aktuální provozní výřez: `live-status.json`.
