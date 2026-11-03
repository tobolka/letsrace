# LetsRace — stav úkolů k SEO, datům a provozu

Aktualizováno 3. listopadu 2026 podle doložených nasazení. **Hotovo znamená dokončený uvedený úkol, nikoli dokončení celé pipeline.** Částečně znamená, že ve sloupci „Zbývá“ je skutečná nedokončená práce. Bez časových odhadů a procent dokončení.

## Co je hotové a co ještě není

| Úloha | Stav | Hotovo | Zbývá / omezení |
|---|---|---|---|
| **Nový admin a panel** | **Rozhraní hotové** | Nasazené a ověřené, servisní nástroje v `/admin/tools`. Poslední kontrola společného seznamu se zobrazuje samostatně. | Automatické vytváření a vykonávání rozhodnutí je samostatný nedokončený úkol níže. |
| **Automatická rozhodnutí** | **Částečně** | Soukromá schránka a ochrana zastaralých odpovědí. | Vytváření konkrétních otázek a skutečné provedení odpovědí. Prázdná schránka neprokazuje samostatný provoz. |
| **Aktualizace veřejného webu** | **Částečně** | Trvalé požadavky, oddělená kontrola detailů, společného seznamu/mapy/kalendáře a návaznost seriálů. | Dokončit nahromaděné kontroly a ostatní zapisovací cesty. Vyžádání aktualizace není ověřený výsledek ani indexace Googlu. |
| **Společné ukládání změn** | **Částečně** | Existující závod s historií, vazby seriálů, praktické údaje, doplnění disciplíny a návrat jednotlivé změny mají chráněné společné zápisy. | Celý nový závod a všechny jeho vedlejší kroky, dokončení kandidátů a ostatní přímí zapisovači. |
| **Maximum praktických údajů** | **Částečně** | Schéma, zdroje po jednotlivých údajích, zámky a prompt. Uloženy konkrétní údaje JBC, Podkrkonošského maratonu a Rohálovské. Čtečka umí další tabulky, zachovává položky z více dokumentů a přiznává částečné čtení. | Další zdroje, běžný text a složité cenové podmínky; plošné doplnění katalogu a nezávislé měření. |
| **Areál, adresa a pořadatel pro vyhledávače** | **Hotovo v zadaném rozsahu** | Stejné doložené údaje v JSON-LD i viditelném detailu. Ověřeno na JBC; pořadatel ověřen také na Rohálovské. | Chybějící data se dále získávají v předchozím úkolu. Čas hlavního startu se zatím neposílá jako čas začátku celého SportsEvent; nevyvozovat ho z první kategorie. Indexace ani rozšířené zobrazení nejsou zaručené. |
| **Tři celoroční kolekce 2027** | **Hotovo** | Česko, české MTB a dětské závody v existujícím prostoru kolekcí, celý leden–prosinec, odkazy z měsíců na příslušný seznam i přes stránkování. Nepotřebné souhrny vzdáleností a kategorií odstraněné podle připomínky. | Regionální kolekce jsou samostatné rozšíření níže. |
| **Regionální kolekce** | **Čeká na data** | Existuje prostor kolekcí. | Spolehlivě doplnit kraje a připravit vlastní užitečný regionální výběr; nevytvářet prázdné kopie filtrů. |
| **Detail závodu a seriálu** | **Částečně** | Předchozí/další ročníky, okolní závody až pod zdroji, praktické údaje, trvalá hlavička a odkaz z areálu na mapu. Seriál zahrnuje i vedlejší vazby závodů. | Další obsah podle [návrhu detailů](race-series-next-content-2026-11-03.md), zejména srovnání kol a doložená pravidla sezóny. Samotný návrh není provedená funkce. |
| **Dodaná dávka českých závodů 2027** | **Zpracováno** | Import `d398a611` a následné opravy; inventura potvrdila požadované hlavní záznamy, stav opravený i ve starším trackeru. | Lost Ride je stále skrytý provizorní záznam, Oremon rekreační jízda mimo závodní kalendář. Nezveřejněné podrobnosti neodhadovat a hotovou dávku neimportovat znovu. |
| **UCI příloha z 3. listopadu** | **Hotovo v cyklistickém rozsahu** | Přidán Szczyrk, doplněn existující Graz a opraven Black Forest při zachování ID a platných vazeb. | Trialové závody byly na přání vlastníka vynechány; nejsou čekající dovoz. Nezveřejněné registrace zůstávají nepotvrzené. |
| **Chotěbuz** | **Hotovo — oprava čtení** | Skutečný běh bez AI, zachované ID a známé údaje; opakování bez nové duplicity. | Běžné budoucí aktualizace zdroje pokračují automaticky. |
| **Eventiv** | **Omezení přístupu** | Odmítnutí 401 se nebere jako prázdný kalendář; dosavadní závody zůstávají. | Poslední doložená kontrola vyžaduje přístup poskytovatele. Obnova čtení tím není dokončená. |
| **Konkrétní duplicita Die Mauer von Kendenich** | **Hotovo** | Jeden zachovaný veřejný záznam, druhý sloučený/skrytý; zachované odkazy a vazby. V přehledu vedlejšího seriálu ověřen právě jeden odkaz. | Tento případ znovu neslučovat. Obecné řešení duplicit je jiný úkol. |
| **Obecné řešení rozporů a duplicit** | **Částečně** | Ochrany identity, ručních zámků a konkrétní opravy. | Jednotné podmínky bezpečného automatického řešení, nejasné případy, obnovitelnost a měření chybných sloučení. |
| **Historie počasí** | **Částečně — úvodní plnění pokračuje** | Sdílené uložiště, serverový běh, skutečné limity, zachování posledních dobrých dat. Aktuální předpověď má krátkou platnost. | Dokončit první naplnění historie katalogu v zachovaných limitech. Dřívější počet odložených míst není aktuální živý údaj. |
| **Nesmyslná trasa 0 km** | **Hotovo** | Opravený import, skládání kategorií i veřejný detail; konkrétní Michaelis-Schanze opravená se zachováním historie. | Skutečná délka tohoto závodu zatím není známá a neodhaduje se. |
| **Nezávislé měření kvality a pokrytí** | **Nezahájeno** | Existují průběžné testy kódu a jednotlivé veřejné kontroly. | Oddělená kontrolní sada, výchozí i následné měření pravdivosti, pokrytí, chybných sloučení, ceny a práce vlastníka. |

## Důkazy dokončených částí

- [Nový admin](../reports/owner-admin-2026-11-02/RESULT.md), [kontrola společného seznamu](../reports/aggregate-publication-2026-11-02/RESULT.md).
- [Změna existujícího závodu](../reports/atomic-watcher-update-2026-11-03/RESULT.md), [vazby seriálů](../reports/atomic-series-membership-2026-11-03/RESULT.md), [doplnění disciplíny a bezpečný návrat změny](../reports/atomic-catalog-writes-2026-11-03/RESULT.md).
- [Praktické údaje a Rohálovská](../reports/practical-reader-v3-2026-11-03/RESULT.md), [oprava 0 km](../reports/zero-distance-2026-11-03/RESULT.md).
- [Česká dávka závodů](../reports/cz-2027-import-2026-10-31/REPORT.md), [UCI import bez trialových závodů](../reports/uci-import-2026-11-03/RESULT.md), [Chotěbuz a Eventiv](../reports/source-recovery-2026-11-02/RESULT.md).

## Kde pokračovat

Otevřené prováděcí úkoly jsou zaškrtnutelné v [operations-progress.md](operations-progress.md); nejsou ukryté až pod zastaralou tabulkou. Tento přehled je stav práce, nikoli důkaz, že se nyní všechny otevřené úkoly samostatně vykonávají.

Odložený nový koncept ověřovacích statusů ani stažené veřejné editační formuláře se neobnovují. Limity se nezvyšují. Trialové závody se nepřidávají. Původní požadavky: [tracker 2. listopadu](work-tracker-2026-11-02.md), pravidla dalších ročníků: [annual-editions.md](annual-editions.md).
