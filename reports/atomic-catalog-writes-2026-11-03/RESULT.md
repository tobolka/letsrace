# Další opravy etap 2/3 — 3. listopadu 2026

## Provedeno

- `fillDisciplinesFromSeries` již nečte starý stav a potom slepě nepřepisuje disciplínu. Soukromá `pipeline_fill_series_disciplines` zamyká způsobilé závody, respektuje zámky, nevstupuje do sloučených/skrytých/minulých závodů a do skrytých seriálů. Ukládá původ jako převzatý ze seriálu, ne jako nové nezávislé ověření ročníku. Údaj, historie a existující publikační požadavek jsou jedna transakce. Selhání je chyba, ne úspěšné doplnění.
- `rollbackFacts` volá `pipeline_rollback_fact`. Jednotlivý návrat údaje, původních vložených kategorií a označení historie se provede celý, nebo vůbec. Kontroluje aktuální hodnotu, ruční zámky a sloučení. Dokumentové/composite podklady nejsou považovány za sloupce. Kategorie přidané později zůstávají. Předchozí neprázdná sada kategorií je chráněná a zatím se automaticky nevrací.
- `withSourceWork` kontroluje boolean potvrzení převzetí, dokončení i uložení dalšího pokusu. Výsledek odmítnutý kvůli změně zdroje či ztrátě převzetí není úspěšný běh. Již skutečně provedené zápisy se ve výsledku nezamlčují. Samotná tato kontrola ještě nezabrání dřívějším zápisům po ztrátě převzetí.

Databázové změny byly aplikovány na produkci. Funkce jsou `SECURITY INVOKER`, dostupné jen `service_role`; ověřeno, že `anon` ani `authenticated` nemohou volat. Bez změny finančních a publikačních limitů, bez importu trialových závodů. Jde o vnitřní opravy, proto se nepřidává veřejná novinka bez viditelné uživatelské změny.

## Ověření

- `scripts/test-series-discipline-fill.mjs`: podmínky výběru, existující údaje, ruční zámky, opakování, limit, skutečná historie a publikace; při úmyslném selhání historie vrácen celý zápis.
- `scripts/test-atomic-fact-rollback.mjs`: ochrana novější změny a zámku, správný typ hodnoty, náhled bez zápisu, nemožnost částečného smazání kategorií a vrácení změn při chybě potvrzení historie, soukromý přístup.
- Produkční běh doplnění: `filled: 0`; žádné závody se tímto během nezměnily. Produkční náhled návratu pěti skutečných podkladů zachoval tři zamčené disciplíny a označil dva zápisy registračních odkazů jako možné vrácení; náhled nic nezměnil.
- Kontrola Supabase nehlásí novou závadu těchto funkcí; dosavadní nálezy PostGIS a nastavení hesel zůstávají mimo tuto změnu.
- Celá sada: **1 468 testů / 224 souborů prošlo**. Sestavení a cílená kontrola kódu prošly (`tmp/operations-writers-tests.log`, `tmp/operations-writers-build.log`, `tmp/operations-writers-lint.log`).
- Nasazení a shoda nainstalovaného Macu budou ověřeny po vydání.

## Co není dokončeno

Celý hlavní import a kandidáti nadále ukládají více částí odděleně. Schránka ještě nemá vykonavatele všech rozhodnutí, plošná bezpečná deduplikace ani nezávislé měření pravdivosti a pokrytí nejsou hotové. Úspěšné testy nejsou důkazem těchto výsledků. Tato změna nevrací žádné závody ani hromadně nemaže skutečné kategorie.
