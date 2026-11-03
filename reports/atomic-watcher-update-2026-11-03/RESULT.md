# Hlavní sběrač: změna existujícího závodu — 3. listopadu 2026

## Co je opravené

`upsertParsedEvent` již neposílá změnu existujícího závodu a její historii ve dvou nezávislých požadavcích. `pipeline_update_watcher_event` pod zámkem závodu kontroluje připravenou veřejnou verzi, aktuální ruční zámky a sloučení. Ukládá změnu, historii jednotlivých skutečně změněných hodnot a stávající publikační úkol dohromady. Při chybě historie se celý krok vrátí.

Novější souběžná úprava znamená `concurrent_event_update` a automatické odložení pro nový výpočet. Server i Mac ji řadí mezi odloženou práci; nevytváří se kandidát k ručnímu schválení. Kontrola unikátního klíče nadále chrání oba záznamy: při kolizi se aktualizuje potvrzený závod s jeho dosavadním klíčem, nikoli vlastník kolidujícího klíče. Chyby jiných omezení se neskrývají. Navazující oznámení používají skutečně aplikované údaje po aktuálních zámcích.

## Ověření

- SQL zkouška `scripts/test-atomic-watcher-update.mjs`: skutečné migrace, kontrola staré verze, aktuálních zámků a odvozených polí, neexistující/sloučený závod, zachování cizího klíče, opakování beze změny, úmyslné selhání historie vracející i publikační úkol, zákaz neznámých sloupců a soukromý přístup.
- **1 469 testů / 224 souborů prošlo**; sestavení a cílená kontrola kódu prošly. Logy `tmp/atomic-watcher-tests.log`, `tmp/atomic-watcher-build.log`, `tmp/atomic-watcher-lint.log`.
- Migrace byla aplikována na produkci. Transakční zkouška na skutečném závodu `000ebbbe-0e3f-4b38-bcb8-885dcd907661` provedla změnu v záměrně vrácené vnořené transakci. Potvrdila skutečné provedení změny, úplné vrácení řádku a odmítnutí staré verze. Žádná zkušební změna závodu se nezachovala.
- `anon` ani `authenticated` nemají právo funkci volat. Používá `SECURITY INVOKER`; jediným povoleným volajícím je služba.
- Nasazeno `32e0bc03`; Vercel `dpl_BXBp6QVgodQtVw47hfJWtFubXqnJ` READY s produkční adresou `letsrace.cz`. Nainstalovaný Mac má stejné soubory `run.ts`, `write-event.ts`, `run-summary.ts` a `source-work.ts`; běží runner i panel, hlášení při kontrole staré 4 s. Dřívější chyba přístupu k Eventivu zůstává pravdivě přiznaná.
- Skutečný opakovaný běh Chotěbuzi se standardním `CATALOG_OVERVIEW_ONLY=1`, bez AI: **1 načtený / 0 nových / 0 změněných / 0 chyb**. [Strojový výsledek](replay.json). Zdroj je aktivní, poslední čtení `ok`, bez chyby; datum 8. května 2027 a silniční disciplína zachované.
- První kontrolní spuštění nemělo nastavený běžný přehledový režim a změnilo dvě obecné klasifikace (`class_label: null → Local`, `competition_type: other → community`). Tyto dva vlastní zápisy byly přes `pipeline_rollback_fact` skutečně a úspěšně vráceny; historie má `rolled_back`. Poté proběhl výše uvedený stabilní běh. [První výsledek](replay-first.json). Neskrývá se jako nulová změna.

## Hranice

Toto je transakce změny existujícího závodu a historie, nikoli celého importu. Nové záznamy, vytvoření či doplnění místa, zdrojové vazby/snímky, hlavní i další seriály, kategorie a oznámení mají další kroky. Některé mohou vzniknout před odmítnutím starého návrhu; nelze proto tvrdit úplnou atomickou publikaci. Převzetí zdroje zatím není kontrolováno uvnitř tohoto zápisu. Nezávislé měření kvality a pokrytí není nahrazeno testy. Limity a rozsah podporovaných sportů se nemění.
