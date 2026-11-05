# Nová automatika na Macu · 5. listopadu 2026

## Skutečný výsledek

- Nainstalovaná a zapnutá nová místní cesta. Plánovač spouští `local-cycle.sh`, nikoli starý produkční sběrač.
- První plánovačem spuštěný průchod: **15:28:38–15:29:03 CET, 24 sekund**, bez nového čtení a bez zápisů. Další termín **6. listopadu 03:29 CET**. [Potvrzení plánovače](automatic-proof.json).
- Výchozí interval **12 hodin**, jeden vlastní průchod současně. Po vypnutí nebo uspání pokračuje po zapnutí a přihlášení. Při vypnutém Macu tento sběr neběží.
- Staré serverové `watch`/`explore` zůstávají blokované. Počasí, samostatné geokódování, veřejný web a následné potvrzování zveřejnění zůstávají na serveru.
- První automatický rozsah: **nové závody ze známých zdrojů**. Změny existujících závodů se drží místně. Nové weby a placená AI se v tomto režimu nehledají/nepoužívají.

## Co přinesly zkoušky

| Průchod | Doba | Přečtené zdroje | Nově odeslané závody | Změny existujících závodů odeslané na server |
| --- | --- | --- | --- | --- |
| První celý | 10 min 27 s | 377 | 18 vložení, po opravě jedné duplicity **17 nových závodů** | 0 |
| Opakování | 29 s | 0 | 0 | 0 |
| První spuštěný plánovačem | 24 s | 0 | 0 | 0 |

Před těmito průchody byly zvlášť odeslané tři závody: Baby Memorial Trulli de Paolis, Trofeo Nazionale Ciclocross Città di Sassari a GP Osterhas. Celkem tedy **20 nových záznamů po odečtení opravené duplicity**, nikoli počet přečtených řádků. Všech 21 nově založených adres bylo jednou přímo načteno a obsahovalo očekávané ID; jedna z nich se následně sloučila. To samo nebyl důkaz správnosti všech údajů ani všech jazyků, mapy nebo indexace Googlu.

Opakování porovnalo obsah všech **9 658 místních záznamů** bez polí posledního čtení, času změny a revize: **žádná změna**. Nejde o dvě vynucená přečtení všech zdrojů; dokazuje to, že běžný opakovaný průchod čerstvě dokončenou práci neopakuje. Přetahování údajů při dvou úplných čteních stále není doložené.

První průchod měl **241 úspěšných zdrojů, 30 technických chyb, 102 nepodporovaných čtení a 4 odložení**, bez nedokončeného záznamu běhu. [Samostatné výsledky zdrojů](first-sources-final.json). **13 nálezů zůstalo zadržených.** Místní počítadlo vykázalo 4 639 databázových požadavků; nejsou to požadavky na Supabase ani měření celé spotřeby Vercelu. Modelová AI v těchto průchodech nebyla zapnutá, cena AI je 0 USD; celkovou cenu infrastruktury tím netvrdíme nulovou.

## Chyby zachycené až po první dávce

1. **Wels:** široký název z Bikeboardu s nesprávně obecnými disciplínami prošel vedle stávajícího CX závodu. Nový `3e8e6af5-1dfc-45ed-b9f8-2e4ce842cb9d` byl přes obnovitelné `app_merge_events` připojen k původnímu `09e14a6c-8fac-442b-a4db-4d1c57608922`; zdroje a vztahy se zachovaly. Kontrola nyní zahrnuje i skryté a dříve sloučené názvy. Dlouhý název na stejném oficiálním webu a ve stejný den neobejde držení jen kvůli chybným disciplínám. Jde o držení k posouzení, ne automatické sloučení rozdílných disciplín.
2. **Trofeo Iaccobike:** zdroj výslovně uvádí `PARCO DEI POPOLI, CASTELLARANO (RE) - INGR. COPPI`. Obec byla chybně odvozena z poslední části jako `INGR. COPPI`. Opravená obec a hledaný bod jsou **Castellarano**; souřadnice zůstávají prázdné. Obec uvedená s italským kódem provincie má přednost před dodatkem o vstupu. Celý původní text místa zůstává zachovaný. Databáze po opravě ověřená; následné potvrzení veřejné revize čeká v běžné frontě, nepřeskakuje limity.

## Ochrany a důkazy

- Místní čtečky nedostávají produkční databázové ani mailové přístupy. Odesílání je samostatný krok s prověřeným otiskem návrhu a transakčním potvrzením dávky.
- Pracovní databáze se mezi průchody nemaže ani neobnovuje. Čerstvý serverový katalog vzniká v oddělené dočasné srovnávací databázi; jen ta se uklízí.
- Serverem pozastavené zdroje se nečtou. Nové výsledky s neexistujícím/pozastaveným zdrojem se drží místo opakovaného pádu celé dávky.
- Zastavení nesmí přejít do odesílání ani když čtečka ukončení označí jako odloženou práci. Ověřeno skutečnými podprocesy.
- Opravená ztráta vlastního chování `promisify(execFile)` způsobovala šest chyb `indexOf`; bezplatné čtení konkrétní dříve postižené stránky nyní vrací HTTP 200 a text.
- Následné veřejné kontroly používají existující společnou frontu a její limit 60 pokusů denně; nový automatický průchod nepřidává další neomezený kontrolor.
- **1 622 testů prošlo, kontrola typů, produkční sestavení, cílený lint a testy transakčního zápisu prošly.** Testy plánovače ověřily pauzu, spuštění, restart, výsledky bez dvojího započtení; Swift model ověřil i nový místní režim.

## Co to nedokončuje

Rozdělení starších chybně spojených záznamů, posuzování změn existujících závodů, opravy všech čteček, zapojení všech webů pořadatelů, širší nezávislé měření a celková spotřeba veřejného webu zůstávají otevřené v hlavním seznamu. Automatické spuštění místního průchodu není důkazem dokončení celého původního projektu.
