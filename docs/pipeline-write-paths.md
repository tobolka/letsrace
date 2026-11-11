# Kdo zapisuje do katalogu

Stav k 11. 11. 2026. První výstup kroku C z [návrhu verze 2](pipeline-v2.md). Vyjmenovává všechny cesty, kterými se dnes mění závody, místa, kategorie a série, a říká, co s každou udělá brána. Zdroj: prohledání `src/` a `scripts/` na zápisy do tabulek a volání databázových funkcí.

Sloupce: **Zámek** = ověří cesta ruční zámek? **Transakce** = je změna a její záznam v `event_facts` jedna transakce? **Historie** = vzniká záznam v `event_facts`?

## 1. Sběr ze zdrojů

| Cesta | Kde | Zámek | Transakce | Historie | Ve verzi 2 |
| --- | --- | --- | --- | --- | --- |
| Zápis závodu ze zdroje | `watcher/write-event.ts` → `pipeline_write_watcher_with_series` | ano | ano | ano | Zůstává vedle brány. Má vlastní kontroly totožnosti a pořadí zdrojů; převod je až poslední. |
| Pomocné zápisy při sběru (místo, série, kategorie, skrytí) | `src/lib/events.ts`, přímé zápisy | v kódu | ne | zčásti | Zůstává se sběrem. |
| Přijetí nalezeného závodu | `watcher/explore.ts` → `pipeline_accept_discovered_race` | — | ano | ano | Zůstává (kandidáti). |
| Dokončení čtení zdroje | `pipeline_commit_source_read` | — | ano | — | Zůstává. |

## 2. Doplňování přes databázové funkce

Tyhle cesty už jsou tím, čím má být brána: ověří stav závodu a zámek v transakci a zapíšou historii.

| Funkce | Volá | Co mění |
| --- | --- | --- |
| `pipeline_fill_registration_link` | `catalog/registration-links.ts` | odkaz na přihlášku, jen do prázdného pole |
| `pipeline_save_practical_details` | `catalog/practical-enrichment.ts` | praktické údaje po částech |
| `pipeline_apply_catalogue_age_read` | `ages.ts`, `regulation-ages.ts`, `fci-ages.ts`, `series-ages.ts`, `raceresult-ages.ts` | věkové kategorie |
| `pipeline_apply_periodic_read` | `llm-enrich.ts`, `registration-ages.ts`, `sportsoft-links.ts`, `csc-ages.ts`, `fill-dossier-classes.ts`, `enrich-series-documents.ts`, `classify-event-kind.ts` | různá pole z pravidelného čtení |
| `pipeline_apply_catalogue_detail` | `fci-website.ts`, `cyclingaustria-details.ts`, `rideandrest-links.ts` | web a podrobnosti |
| `pipeline_complete_past_events` | `complete-past.ts` | stav proběhlých závodů |
| `pipeline_apply_geocoding` | `geocode.ts` | souřadnice místa |
| `pipeline_apply_series_links`, `pipeline_attach_event_series`, `pipeline_fill_series_disciplines` | `series-linker.ts`, `event-series.ts`, `series-disciplines.ts` | vazby na série |
| `pipeline_merge_duplicate_location`, `pipeline_unpin_country_location` | `merge-locations.ts` | místa |
| `app_carry_previous_edition` | `previous-edition.ts` | převzetí z loňska s `age_confidence = previous` |

**Ve verzi 2:** zůstávají, jak jsou. Brána je pro ně nový vstup, ne náhrada: návrh se po rozhodnutí zapisuje touto funkcí. První nová je `pipeline_apply_proposal` pro odkaz na propozice, podle vzoru `pipeline_fill_registration_link`.

## 3. Doplňování přímým zápisem

Tady je díra. Zámek se čte předem v kódu, mezi čtením a zápisem může kdokoli pole změnit, a změna závodu a záznam historie jsou dva oddělené příkazy.

| Cesta | Kde | Zámek | Historie |
| --- | --- | --- | --- |
| Propozice z webu závodu | `scripts/harvest-site-documents.ts` | v kódu, předem | ano, druhým příkazem |
| Propozice z řádku kalendáře | `scripts/harvest-calendar-documents.ts` | v kódu | ano, druhým příkazem |
| Propozice z rad-net | `scripts/harvest-radnet.ts` | ne | ne |
| Propozice z polského svazu | `scripts/harvest-pzkol.ts` | ne | ne |
| Propozice z italského svazu | `scripts/harvest-federciclismo.ts` | ne | ne |
| Web nalezený hledáním | `catalog/practical-enrichment.ts` (řádek 97) | — | ano, druhým příkazem |
| Web z průzkumu | `catalog/web-research.ts`, `catalog/web-finder.ts` | v kódu | zčásti |
| Kategorie od modelu | `catalog/llm-ages.ts`, `catalog/ages.ts`, `catalog/series-ages.ts` | v kódu | zčásti |
| Kontrola odkazů na přihlášku | `scripts/validate-entry-links.ts` | — | ne |

V cyklu na Macu tyhle skripty běží proti kopii katalogu, ne proti produkci. Na server se jejich výsledek dostane až cestou 4, která zámek i aktuální hodnotu ověřuje znovu. Riziko je tedy hlavně při ručním spuštění proti produkci a v tom, že tři čtečky svazů nezanechají žádnou historii.

**Ve verzi 2:** tohle je první práce brány. Všech pět cest k odkazu na propozice přestane zapisovat a začne odevzdávat návrh.

## 4. Převoz z Macu na server

| Cesta | Kde | Zámek | Transakce | Historie |
| --- | --- | --- | --- | --- |
| Nové závody a doplněná pole | `local-fills.cjs`, `local-review-new.ts` → `local-sync.cjs send` | ano, při příjezdu | ano, po dávkách | ano, a deník v `pipeline_sync_batches` |

**Ve verzi 2:** nahrazuje se bránou, pole po poli. Do té doby běží souběžně a pro pole, které převezme brána, se v `EVENT_FIELDS` vypne.

## 5. Ruční a pořadatelské zásahy

| Cesta | Kde | Poznámka |
| --- | --- | --- |
| Úprava závodu v administraci | `src/lib/race-edit.ts` | Zapisuje přímo a nastavuje zámek v `event_overrides`. |
| Úprava pořadatelem | `organizer_apply_edit` | Transakční funkce. |
| Posouzené opravy | `scripts/apply-reviewed-fixes.ts` | Přímý zápis data a skrytí se zámkem; sloučení přes funkci. |
| Sloučení a obnova | `app_merge_events`, `app_restore_event_merge` | Úplný snímek v `pipeline_merge_history`. |
| Vrácení údaje | `pipeline_rollback_fact` | Umí vyjmenovaná pole včetně `regulations_url`; kategorie jen nově vložené. |

**Ve verzi 2:** zůstávají mimo bránu. Mají přednost: brána jejich zámek ctí a nikdy ho nenastavuje ani neruší.

## 6. Jednorázové skripty

`seed-*`, `repair-*`, `hide-*`, `hold-*`, `reclassify-catalog.ts`, `recompute-fingerprints.ts`, `regroup-u13.ts`, `fix-places-links.ts`, `fill-uci-class.ts`, `rederive-dossier-classes.ts`, `republish-linked-events.ts`, `catalog/repair-series.ts`. Píšou přímo, většinou bez historie.

**Ve verzi 2:** do archivu. Nová jednorázová oprava se píše jako sada návrhů pro bránu, ne jako skript se zápisem.

## Co z mapy plyne pro krok C

1. Odkaz na propozice má dnes šest zapisujících cest: pět přímých čteček (oddíl 3), převoz z Macu (oddíl 4) a k tomu sběr a ruční úpravy. Brána nahradí prvních šest.
2. Vzor už v databázi je: `pipeline_fill_registration_link` dělá pro odkaz na přihlášku přesně to, co má brána dělat pro odkaz na propozice. Nová funkce se od něj liší jen tím, že čte návrh z tabulky a zapisuje do ní rozhodnutí.
3. Žádost o obnovu webu není potřeba řešit: trigger `pipeline_queue_public_revision` ji založí při každé změně závodu ve stejné transakci.
4. Vrácení přijatého odkazu umí stávající `pipeline_rollback_fact`.
5. Tři čtečky svazů (rad-net, pzkol, federciclismo) dnes historii nezapisují. Přechodem na návrhy ji získají.
