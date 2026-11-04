# Skutečný přínos sběru, 28. října až 3. listopadu 2026

Rozsah je sedm celých dnů v Europe/Prague. Zahrnuje evidované čtení zdrojů v `ingest_runs`, včetně ručních běhů. Čas se počítá od zahájení do skutečně zaznamenaného konce. U 11 přerušených čtení skutečný konec chybí. Čas jejich pozdějšího úklidu byl z měření vyloučen.

| Den | Čtení | Minuty zdrojů | Nové záznamy | Aktualizace |
| --- | ---: | ---: | ---: | ---: |
| 28. 10. | 148 | 25,4 | 89 | 1 402 |
| 29. 10. | 150 | 151,9 | 11 | 734 |
| 30. 10. | 136 | 173,3 | 5 | 429 |
| 31. 10. | 222 | 38,1 | 76 | 584 |
| 1. 11. | 1 205 | 90,2 | 38 | 1 871 |
| 2. 11. | 353 | 197,4 | 21 | 806 |
| 3. 11. | 112 | 19,6 | 72 | 728 |
| **Celkem** | **2 326** | **696** | **312** | **6 554** |

- **11 h 36 min zdrojového času**, součet časů jednotlivých čtení. Po sloučení překrývajících se intervalů bylo alespoň jedno zaznamenané čtení aktivní **4 h 11 min**. Úplný čas všech úloh Macu a serveru z tohoto zdroje nelze rekonstruovat.
- **1 151 z 1 519 čtení s dostupnými počítadly (76 %) mělo nulový vykázaný přírůstek i aktualizaci.** U 807 čtení tento rozpad chyběl. Čtení bez změny může potvrdit čerstvost známých dat, ale jeho četnost musí odpovídat přínosu.
- **17 603 přijatých zápisových operací** zahrnuje i opakované zpracování. 6 554 je počet evidovaných aktualizací, který může tentýž závod započítat opakovaně. Ani 312 nových záznamů nedokládá 312 ověřených unikátních závodů.
- Cykloman přes oba názvy hostitele spotřeboval přibližně **106 minut čtení**, bez vykázaného nového závodu a s 15 evidovanými aktualizacemi. Edieteam, Biker i Mazury MTB dohromady spotřebovaly **181 minut** bez vykázaného nového či aktualizovaného záznamu. Odjazd ve **33 minutách** vykázal 49 nových záznamů. To odůvodňuje rozlišit široké kalendáře a dlouhé fronty jednotlivých stránek.
- Nové záznamy běhů ukládají změřenou délku a ID vytvořených a změněných závodů. Úklid přerušeného běhu označuje délku jako neznámou. Na historii před touto změnou lze spočítat operace, kvalitu údajů je nutné měřit nezávisle.

## Pořadí dokončení

1. **P0 – ochrana dat.** Dokončit ochranu potvrzení a plánování zdroje proti starému běhu, audit pravidelných přímých zapisovačů, bezpečné opakování po pádu a kontrolu změn až po veřejný výsledek. Testy mají zahrnout pád, dvě současná převzetí, uzamčené pole, chybnou identitu a neúplný kalendář.
2. **P0 – spotřeba a měřitelný přínos.** Rozlišovat nové záznamy, unikátní změněné závody, doložená doplnění a pouhá čtení. První změny v kódu omezují jednu doménu na dva zdroje v dávce, oddělují opakované plošné geokódování od scanu a ukládají ID pro další měření. Zbývá řízení rozpočtu podle skutečných požadavků, výnosu zdroje a opakovaných selhání.
3. **P1 – kvalita katalogu.** Dokončit řešení rozporů, prevenci a obnovitelnost duplicit, systematické hledání chybějících ročníků a doplnění praktických údajů. Ověřit oddělenou kontrolní sadou. Změnu pole započítat jako zlepšení jen při doloženém a správném výsledku.
4. **P2 – rozhraní a širší pokrytí.** Schránku a panel doplnit až o konkrétní provozní stavy a rozhodnutí vycházející z hotové pipeline. Otevřené položky ve stávajících přehledech zůstávají evidované.

Plošné scany i živý pilot zůstávají pozastavené. Výsledky výše pocházejí ze čtení historických záznamů. Po dokončení oprav a souhlasu s pilotem se účinnost změří na omezeném vzorku.
