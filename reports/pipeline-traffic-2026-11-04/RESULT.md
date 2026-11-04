# Provoz LetsRace při pozastavených scanech

Měřené okno 4. listopadu 2026, 01:10–20:00 českého času (00:10–19:00 UTC). Tabulka `ingest_runs` v něm neeviduje žádné zahájené ani dokončené čtení. Poslední předchozí záznam doběhl ve 00:04:52 českého času. Ostatní naplánované úlohy pracovaly.

| Databázové cesty v `edge_logs` | Požadavky |
| --- | ---: |
| Čtení závodů (`GET events`) | 11 249 |
| Sdílené cesty používané panelem Macu | 1 170 |
| Dotazy na ročníky a kola seriálů | 821 |
| Počasí | 672 |
| Ostatní | 2 123 |
| **Celkem** | **16 035** |

Denní hranice 16 000 požadavků byla překročena už v tomto neúplném dni. Počet vychází ze záznamů na hraně Supabase. Fakturovaný objem logů ani podíl vyhledávačů z něj určit nelze.

Z 11 249 čtení závodů bylo 5 122 dotazů na konkrétní adresu závodu, 2 343 dotazů podle webu pořadatele a 1 637 dotazů s geografickými mezemi. Ostatních 2 147 dotazů spadá do dalších tvarů. Rozpad vychází z parametrů databázového dotazu. Stejný tvar může používat návštěvník i automatická kontrola.

Fronta ve stejném okně dokončila 44 úloh detailu závodu, sedm seriálů a jednu úlohu společného katalogu. Devět pokusů o kontrolu seriálu a dvě dávky vyžádání obnovy skončily opakováním. To jsou výsledky úloh, nikoliv počty HTTP požadavků.

## Změny a jejich měření

- Dotazy na související závody sdílejí výsledek pro stejnou doménu pořadatele a stejný den. Uložený výsledek se obnovuje po 15 minutách. Filtr aktuálního závodu a seriálu se uplatní až při zobrazení.
- Mac v pauze hlásí stav serveru jednou za deset minut. Aktivní provoz používá pět minut a změna stavu pauzy vyvolá okamžitou aktualizaci. Stav panelu i adminu má hranici čerstvosti 15 minut.
- První chyba čtení má rychlý pokus za dvě hodiny. Další stejný stav chyby odloží zdroj o jeden den. Nezveřejněný ročník, nepodporované dokumenty a čekající zápis konkrétního řádku mají vlastní pravidla.
- V `edge_logs` lze podle `request.headers.x_client_info` oddělit označené čtení veřejného katalogu, zveřejnění, sběr, objevování, monitor, historii počasí a údržbu. Veřejné stránky načtené kontrolou zveřejnění jsou samostatné HTTP požadavky, jejich případné čtení databáze spadá pod veřejný web. Neoznačené cesty se vykazují samostatně.
- U hlavního sběrače počítá `ingest_runs.metrics.database` pokusy a chyby od převzetí zdroje po přípravu potvrzení. Samotné uložení potvrzení, externí HTTP a AI se počítají odděleně. Změněný závod lze deduplikovat pomocí uložených ID. Za doložené zlepšení se počítá až správný údaj s podkladem.

Historické týdenní měření eviduje 2 326 čtení, 11 h 36 min součtu časů zdrojů a 4 h 11 min po odstranění souběhů. V 13 čteních se dochoval údaj o použití AI s vykázaným součtem 0 USD. Místní rozpočtový záznam za stejný týden obsahuje 0,3994 USD, vše 3. listopadu. Evidence má různý rozsah, celkovou fakturu ani cenu za správně doplněný údaj z ní určit nelze. V tomto období chyběly seznamy ID vytvořených a změněných závodů. [Denní rozpad a omezení](../pipeline-yield-2026-11-04/RESULT.md).

Pro porovnání po změně použít celý den s pozastavenými scany a stejnou metodiku. Přínos jednotlivých zdrojů, skutečnou úsporu a bezpečnost obnovení sběru potvrdí až výsledky omezeného pilotu a nezávislá kontrola změněných údajů.
