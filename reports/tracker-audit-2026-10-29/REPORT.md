# LetsRace — oprava trackeru, skenování a kvality dat

Dokončeno a ověřeno 29. 10. 2026 v 16:02 (Europe/Prague).

## Navazující dokončení fronty

Po následném pokynu byla zpracována i původní fronta 112 podkladů: 99 uzavřeno, 13 čeká na konkrétní důkaz; devět nových ověřených závodů a jedna obnovená akce. Aktuální výsledek a nasazení jsou v [revizi fronty](REVIEW.md).

## Výsledek

Opravy jsou na produkčním webu i v nainstalovaném sběrači a panelu na Macu. Poslední ověřený produkční deployment: `dpl_7D1R2vEvEdwjJ3qSmeynDDtHL6bq`, alias https://letsrace.cz, stav READY. Instalace Macu byla aktualizována v 10:47; správce běží, heartbeat při závěrečné kontrole byl starý 7 sekund. Starý samostatný ČSC agent zůstává vypnutý.

Bylo explicitně opraveno **27 záznamů**, s **30 záznamy historie změn** v `event_facts`. Jedna ověřená duplicita CX-MAS Cross Vol.4 byla sloučena přes existující transakční funkci s úplnou historií v `pipeline_merge_history`.

## Živé ověření čteček

| Zdroj | Výsledek po opravě | Co tento počet znamená |
| --- | --- | --- |
| Odjazd | 195 přečtených, 195 dokončených zápisů, 0 chyb, 107 sekund | Nula nových závodů v tomto ověřovacím průchodu; 181 změněných záznamů. Předchozí problémový průchod trval 1 073 sekund a dokončil jen 36 zápisů ze 195. |
| PZKol | 198 přečtených, 197 uložených, 0 chyb, 24 sekund | Nula nových, 4 změněné; jeden řádek byl záměrně vyřazen pravidly importu. |
| ČSC | Poslední automatický průchod: 424 přečtených, 249 uložených, jeden chybný zdrojový řádek | Poslední běh 14:09–14:10 skončil potřebou kontroly kvůli csc-1695. Kalendář se načetl; konec před začátkem se nepublikuje. V dřívějším živém průchodu vzniklo 5 nových dráhových závodů pro listopad/prosinec 2026. |

Přečtené řádky ani provedené databázové zápisy nejsou počet nově objevených závodů. Změněný údaj není automaticky důkaz zlepšení; proto jsou explicitní opravy uvedeny zvlášť.

## Opravená data

- Osm budoucích akcí mělo stav dokončeno. Stav byl opraven při zachování uloženého termínu; nejde o nové potvrzení termínu pořadatelem.
- Čtyři záznamy s neslučitelnými daty či ročníkem byly skryty a ponechány k ověření. Data nebyla odhadnuta ani smazána. Všechny čtyři mají dohledatelný podklad ve frontě.
- Šest míst bylo opraveno: UCI Cyprus Gran Fondo ze Švýcarska na Kypr; Söll podle oficiálního Start/Ziel; u dalších míst byl název země nahrazen přiznaným chybějícím městem bez falešného bodu na mapě.
- Tři ztracené údaje XCO/formátu byly obnoveny z historie před jejich přepsáním obecným MTB.
- Šest dalších polských záznamů bylo přemístěno z české Sobotky do polské Sobótky. České závody v Sobotce zůstaly na svém místě.
- Šest archivních zdrojů s parametrem roku 2002 a bez budoucích závodů bylo pozastaveno.
- U ověřené duplicity CX-MAS souhlasily název, termín, země a obec; zachován byl záznam s oficiálními zdroji. Jiné nejasné dvojice nebyly násilně sloučeny.

## Ochrany proti návratu chyb

- Obecné MTB/road, prázdné formáty a obecné zařazení nemažou přesnější uložené údaje. Agregátory respektují i oficiální seriálové zdroje.
- Kontroluje se výsledná kombinace původních a nových údajů. Starý chybný ročník v dlouhém názvu nepřeváží aktuální čistý název stejného zdrojového záznamu.
- Výslovná země místa má přednost před sídlem federace; příklad Waldkirchen (DE) v českém kalendáři. JSON-LD nově přebírá zemi z adresy a přesných názvů zemí.
- Gazetteer rozlišuje Sobótku/Sobotku a respektuje uvedenou zemi. Název země není město ani podklad pro přesný bod závodu.
- Ověřený značkový název GRAND PRIX OF POLAND – 2036 CUP není považován za ročník 2036. Ostatní rozpory let zůstávají kontrolované. Oficiální zdroj: https://pzkol.pl/kalendarz/2792,grand-prix-of-poland-2036-cup.html.
- Databázové požadavky mají čekání nejvýše 20 sekund; v jednotlivém zápisu se respektuje i zbývající rozpočet zdroje. Zápisy v tomto rozpočtu nemají skryté automatické opakování. Odložení kvůli limitu se odlišuje od skutečné chyby.
- Odjazd neprochází dvanáct nefunkčních týdenních URL, pokud už má funkční seznam závodů.
- ČSC opakuje i selhání připojení. Nečeká zbytečně na již proběhlou událost načtení dokumentu, potvrzuje změnu počtu řádků po změně velikosti stránky a opakuje změnu po připojení Blazoru. Stránkování rozpoznává Další/Next a sleduje původní řádek před kliknutím. Neúplný desetipoložkový výsledek je odmítnut.
- LaunchAgent sběrače byl změněn z Background na Standard. Místní dokumentace launchd potvrzuje omezení CPU/I/O pro Background; závěrečné běhy jsou ověřené jako normální daemon. Nelze z jediného běhu vyčíslit samostatný podíl této změny na zrychlení.
- Panel zachovává 24hodinovou historii a poslední skutečné načtení ČSC i po chybě. Prázdný úspěšný běh neskrývá dřívější problémy. Ukazuje zvlášť aktuálně problematické zdroje a čekající podklady.
- Nový databázový trigger ponechává jen jeden čekající snímek téže kandidátní identity a stejného obsahu. Staré důkazy zůstávají dohledatelné jako nahrazené. Rozdílná tvrzení a rozpracované publikování zůstávají oddělené.

## Závěrečné kontroly

- 1 193 testů ve 175 souborech prošlo; TypeScript a cílený lint prošly.
- Sestavení Swift panelu a integrační test správce prošly; ověřeny pauza, běh, čítače a uchování stavu po restartu.
- Databázový test nového triggeru prošel v transakci s rollbackem všech testovacích podkladů. Bezpečnostní advisories před/po změně nepřinesly nové kategorie nálezů; soukromé tabulky ani nová funkce nebyly zpřístupněny veřejnosti.
- Produkční build a nasazení READY. Veřejné stránky nových závodů vracejí 200, provozní endpoint bez přihlášení 401 a s provozním přístupem 200. Ověřená skrytá konfliktní stránka vrací 404.
- V celé veřejné databázi: **0 konců před začátkem**, **0 budoucích závodů označených dokončeno**. Poslední katalogový audit má **0 rozporů**, které kontrola názvu/ročníku/stavu/dat detekuje. To neprokazuje úplnou věcnou správnost každého závodu.
- Fronta: **112 čekajících podkladů**, **0 duplicitních čekajících snímků stejného tvrzení**.
- AI ledger zůstal na 7,6839674 USD za říjen. Limity 0,50 USD/den a 5 USD/měsíc zachovány; placená AI nebyla při opravách spuštěna.

## Co zůstává poctivě viditelné

ČSC csc-1695 nadále uvádí začátek 26. 4. 2026 a konec 26. 4. 2025. Záznam je v karanténě; bez dalšího zdroje se konec neopravuje odhadem. Oranžový stav u tohoto zdroje je správný.

Některé jiné zdroje vracejí HTTP chyby, příliš velké dokumenty nebo nepodporovaný obsah. Globální historie posledních 24 hodin při závěrečné kontrole obsahovala 78 úspěšných a 128 neúspěšných/neúplných kontrol z 206; zahrnuje i starší chyby před opravami a správně odmítnuté údaje. Nelze ji vydávat za úspěšnost opravených tří pilotních čteček ani tvrdit, že všechny zdroje už fungují. Čekající podklady vyžadují věcné ověření, nejsou publikované závody.

Během práce přibývala i další katalogová data; jejich přínos není připsán této opravě. Změny jsou nasazené a nainstalované; v již rozpracovaném checkoutu nebyl vytvářen společný Git commit s cizími staršími změnami.

## Důkazy

- `before-data.json`, `repair-plan.json`, `repair.sql`: snímek a explicitní první opravy; další opravy mají historii v event_facts.
- `final-verification.json`: závěrečné živé databázové ověření.
- `pzkol-verified.log`, `odjazd-verified.log`: skutečné dokončené piloty.
- `final-monitor.json`, `final-catalogue-overview-latest.json`: stav nainstalovaného trackeru.
- `deployment-release.log`: poslední nasazení.
- `public-verification.json`: veřejné HTTP kontroly.
- `review-trigger-test.sql`: transakční regresní test fronty.

