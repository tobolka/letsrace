# Kontrola všech vstupů do pipeline — 26. 10. 2026

## Výsledek

Existují tři metody čtení (HTTP/API/PDF, místní Chrome a AI), ale provoz měl více spouštěčů a staré návody jim připisovaly různé intervaly i rozpočty. Aktuální hlavní přehled je nyní `docs/keep-fresh.md`, aktuální místní stav ukazuje `npm run pipeline:status`.

- Jedna běžící místní smyčka, interval dvě hodiny, sedm požadovaných zemí.
- HTML/API/PDF a strukturované kalendáře běží bez modelu. Bezplatné hledání nových URL běží jednou denně a předává návrhy ke kontrole.
- Chrome zůstal zachovaný, automatický fallback a pondělní ČSC čtení uvnitř místní smyčky. Samostatný LaunchAgent byl vyřazen a zachován jako `.plist.disabled`; původní plist je v tomto reportu. Dříve ukazoval do `/Users/radektobolka/letsrace`, pak při pokusu o spuštění z Documents neotevřel skript. Běžící místní smyčka má potřebný přístup a prokázala skutečné vykreslení.
- Ruční dokumentový sběr a experimentální discovery jsou výslovně označené jako pomocné nástroje, nikoli další trvalé procesy.
- AI zůstává v úterý a pátek, společný strop 0,50 USD denně a 5 USD měsíčně; staré výchozí hodnoty 2,50/25 USD byly opraveny i v pomocných skriptech. Ledger nebyl resetován.

## Co bylo skutečně spuštěno

| Cesta | Důkaz | Výsledek a omezení |
| --- | --- | --- |
| ČSC přes Chrome | `tmp/csc-local-verification-2026-10-26.log`, `tmp/csc-data-check-2026-10-26.log` | 419 načtených závodů, 249 zapsaných/aktualizovaných zdrojových záznamů. Jeden chybný starý záznam odmítnut. Nejde o 249 nových závodů. |
| Bezplatné hledání | `tmp/free-explore-path-check-2026-10-26.log` | 10 nových URL uloženo, 4 načteny, 6 zachováno ve frontě; 0 modelových či placených vyhledávacích volání, 0 zápisů závodů. |
| Dokumentový sběr s povoleným Chrome | `tmp/dossier-path-check-2026-10-26.log` | 1 podklad Gracie 2027, 0 chyb. Konkrétní stránka nevyžadovala vykreslení. |
| Celý běžný bezplatný průchod | `tmp/refresh-2026-10-26-1047-check.log` | Dokončen; 0 chybných, 0 odložených kroků. Samostatný výsledek ČSC s chybným řádkem zůstává viditelný ve stavu Chrome. |
| Testy | `tmp/pipeline-path-all-tests.log` | 173 souborů, 1 182 testů prošlo. |
| PostgreSQL ochrany | `scripts/test-pipeline-review.mjs` | Ověřeno odmítnutí starého stavu, zámky, rollback auditu, idempotence a soukromý přístup. |
| Typy, lint a sestavení | `tmp/pipeline-path-typecheck*.log`, `tmp/pipeline-path-lint*.log`, `tmp/pipeline-path-build.log` | Prošlo. Nové sledování týdenního stavu znovu prošlo cíleným testem a kontrolou typů. |

## Nevyřešený údaj ze zdroje

ČSC `csc-1695`, SEVEROČESKÝ PUMPTRACKOVÝ POHÁR: zdroj uvádí začátek 26. 4. 2026, konec 26. 4. 2025. Potvrzeno druhým vykreslením kalendáře. Nesprávný rozsah nebyl zapsán jako správný závod; tvrzení je uložené v soukromé frontě `pipeline_candidates` s důvodem ke kontrole. Správné datum konce se nesmí domyslet. `pipeline:status` proto ukazuje Chrome `needs_review`, i když následující běžný průchod již skončil bez chyby. Snímky HTML zůstávají lokálně.

## Produkce

Ověřena přítomnost soukromé tabulky kandidátů s RLS a potřebné funkce pro bezpečné přebírání údajů z minulého ročníku. Nastaveno `PIPELINE_REVIEW_QUEUE=1` a `CATALOG_OVERVIEW_ONLY=1`; produkční `LLM_CALENDARS`, modelové rozpočty a placené vyhledávání zůstaly 0.

Nasazen aktuální kód pipeline z pracovního adresáře na projekt LetsRace `prj_1CW887MfWBHVzXRVfmzM1bA20vjo`, tým `team_03brDpYLcroOcWuobjn1cR19`. Deployment `dpl_AxoCpmaqMvFhMU7GhT3WrjXBkfGV`, stav READY; doména letsrace.cz potvrzená na tomto deploymentu. Základ je commit `f8d9371264581a929b77ccbbe9deaff6863adef7` plus lokální změny pipeline. Nevznikl nový Git commit ani push. Upload výslovně vylučuje `tmp/`, reporty, lokální klíče a další pracovní soubory.

Po nasazení ověřeno HTTP 200 na `/cs`, `/api/events` a `/cs/zavod/gracia-orlova-2027`. To ověřuje veřejné čtení nové verze, nikoli ruční proběhnutí všech serverových cronů. Ty mají své plány v `vercel.json`; Chrome je nadále pouze místní.

## Provozní omezení

Funkční cesta neznamená záruku, že každý cizí web odpoví nebo zveřejnil ročník 2027. Nedostupné a rozporné zdroje zůstávají přiznané k opakování/kontrole. AI část má ověřený kód a plán; skutečný nový placený běh se nyní záměrně neprovádí, protože říjnový ledger již eviduje více než nově schválených 5 USD. Místní automatika potřebuje zapnutý Mac a přihlášenou relaci, server pokračuje nezávisle.
