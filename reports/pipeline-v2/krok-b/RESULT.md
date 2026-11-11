# Krok B: odklady ve verzi 1

11. 11. 2026. Zadání: [docs/pipeline-v2.md](../../../docs/pipeline-v2.md), krok B. Navazuje na [krok A](../krok-a/RESULT.md).

## Co se změnilo

- `scripts/local-cycle.cjs`, `holdAfter`: po selhání krok čeká 1 h, 6 h, 1 den, 3 dny, 7 dní. Po pátém selhání v řadě je zastavený a zkouší se jednou týdně. Dokončená práce (i částečná) všechno vynuluje.
- Počítá se jen skutečné selhání: krok selhal, nebo mu vypršel čas, když byl Mac vzhůru. Nepočítá se vyčerpaný rozpočet AI, web zavřený zvenčí, ani čas vypršený během spánku Macu.
- Kroky čtoucí stejný web sdílejí jedno čekání (`radNet` a `radNetNew` pod `rad-net.de`). Když je web zavřený, zeptá se jen jeden z nich a oba čekají do dalšího dne.
- Čekající krok se nespouští a nezapisuje se jako pokus; průchod jen uvede počet (`heldSteps`).
- Výsledek pokusu v `result.json` nese počet selhání v řadě, čas dalšího pokusu a příznak zastavení. Souhrn je ukazuje a zastavené kroky jmenuje v titulku.
- `npm run pipeline:status -- --retry=<krok nebo web>` čekání zruší; krok se zkusí při příštím průchodu. Když průchod právě běží, příkaz odmítne.

## Proč spánek Macu

V noci na 11. 11. mezi 2:24 a 6:16 vypršel čas čtyřem různým krokům ve stejných průchodech (`regulations`, `websiteSearch`, `siteDetails`, `checkDetails`) a průchody trvaly až 74 minut při limitu kroku 14 minut. To je spící notebook, ne čtyři rozbité kroky. Kdyby se to počítalo, čtení propozic by se po jedné takové noci odložilo na dny. Pozná se to tak, že skutečně uplynulý čas přesáhl limit kroku o víc než dvě minuty.

## Co je ověřené

- Testy: `scripts/test-local-cycle.cjs` (řada čekání, zastavení po pátém, vynulování, rozpočet AI, spánek, sdílené čekání), `pipeline2-status.test.ts`. `npm test`: 254 souborů, 1 850 testů, vše prošlo.
- Nainstalováno; průchod `2026-11-11T14-43-40-265Z` z nainstalované cesty doběhl bez chyby.

## Co ověřené není

- **V provozu ještě žádné selhání nenastalo**, takže odklad, zastavení ani sdílené čekání nejsou vidět na skutečném průchodu. rad-net dnes ve 14:39 UTC dostal svůj interval ještě kódem kroku A; sdílené čekání se poprvé projeví při dalším pokusu 12. 11. kolem 14:40 UTC. Tehdy má `radNetNew` skončit `blocked` a `radNet` se nemá spustit vůbec (`heldSteps: 1`).
- Zapojení do `upkeep` kryjí jen testy jednotlivých funkcí, ne test celého průchodu.
- Hranice dvou minut pro spánek je odhad z jedné noci.
- Cíl „žádný krok nemá za 24 hodin víc než 3 selhání“ jde změřit nejdřív 12. 11. večer: `npm run pipeline:status`.
