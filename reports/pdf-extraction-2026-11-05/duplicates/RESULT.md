# Duplicity a rozpory v datech · 6. 11. 2026

## Duplicity
Ze serveru jsem načetl 104 podezřelých dvojic budoucích veřejných závodů (název, den, místo nebo stejný web) a přečetl je. Většina jsou různé věci: kola seriálu, XCC a XCO, gravel a silnice, délky jedné akce. **Sloučeno 13 skutečných duplicit** přes auditovanou `app_merge_events` (seznam a důvody v `pairs.json`, výsledek v `merged-server.json`). Staré adresy přesměrovávají na zachovaný závod, ověřeno na jednom případu (308 a 200).

Vědomě nesloučeno:
- Beskyd Tour RR a Beskyd Tour: seriál RoadCup má víc položek na tentýž víkend, nejde rozhodnout z toho, co je veřejně.
- Mistrzostwa Polski Masters a Otwarte Mistrzostwa dla Amatorów v Grójci: odjazd.pl k tomu nemá dost údajů.
- TBC a Janev Cup v Prachaticích: různé seriály.

Hledání dvojic zachytí jen ty do jednoho dne a s podobným názvem, místem nebo webem. Není to důkaz, že jiné duplicity nezbývají.

## Data opravená podle pořadatele
Záznam dostal fakt se zdrojem a zámek, aby kalendář nevrátil staré datum (`fix-dates.cjs`, předchozí stav v `date-fixes-*.json`):

| Závod | Bylo | Je | Zdroj |
| --- | --- | --- | --- |
| PGR Poland Gravel Race | 31. 7.–3. 8. 2027 | 7.–10. 8. 2027 | web pořadatele |
| Gravelowa Korona – Grudziądz | 26.–27. 6. 2027 | 5.–6. 6. 2027 | řád cyklu 2027 |
| Gravel Trans Jura | 3.–8. 6. 2027 | 2.–8. 6. 2027 | web pořadatele |

Nerozhodnuto: Saint Gravel@Bodensee (pořadatel píše „Sonntag, 11. September“, 11. 9. 2027 je sobota, katalog má 12. 9.) a MSR v cyklokrose v Selcích (propozice 6. 12., kalendář svazu 5. 12. a na 6. 12. jiný závod). Propozice Thurgau a web se liší v délce trasy (85 km a 75 km).
