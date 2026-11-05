# Navázání po Codexu · 5. 11. 2026

Vlastník: **pokračuj, ověř také Docling a vše zapiš před vyčerpáním kreditů**. Technické rozhodování má dělat agent. Původní rozpracovanou práci nemazat/nepřepisovat. Zápisy výsledků do produkční databáze a nasazení až po výslovném souhlasu. AI limity 0,50 USD/den, 5 USD/měsíc se nezvyšují.

## Co číst jako první

1. `reports/pdf-extraction-2026-11-05/docling-comparison/RESULT.md` — **skutečné srovnání Doclingu, všechny tři cesty už doběhly**, přesné příkazy pokračování, soubory, nastavení a předběžné výsledky.
2. `reports/pdf-extraction-2026-11-05/continuation/RESULT.md` — předchozí dokončené opravy ověřování praktických údajů a OCR, 1 708 prošlých testů, omezení a zjištěné rozpory.
3. `docs/operations-progress.md` — **přepsané aktuální priority**, místo starého pořadí přesunu na Mac.
4. Původní `HANDOFF.md` — Claudovo předání, zachované beze změny; jeho domněnky nejsou všechny správné (např. skutečný původ `no_quote`, ne každé odmítnutí má být přijato).

## Stav práce a ochrana souborů

Všechno je pořád místně necommitnuté na `codex/scan-admin-seo-review`. Commit `dfd837b6` je podle místního `origin/main` lokálně před ním. Nic v této kontrole nebylo instalováno do runtime, pushnuto nebo nasazeno. Neříkat, že nové opravy už běží na pozadí.

Původní neuložené změny jsou v `continuation/inherited-changes.patch`; aktuální průběžný diff v `docling-comparison/checkpoint-working-tree.patch`. Záloha starého plánu je `continuation/operations-progress-before.md`. Záplaty nezahrnují netrackované soubory — ty už leží v pracovním stromu a nesmějí se uklidit.

Původních sedm změněných souborů zůstalo; navíc se měnil hlavní plán a přibyly testy `document-ocr.test.ts`, `pdf-ocr-fallback.test.ts`. `scripts/.tmp-replay.ts` byl náš dočasný soubor a po použití se odstranil; jeho zachovaná kopie je `continuation/replay-review.ts.txt`. Cizí skripty/podklady se neodstraňovaly.

## Dokončené opravy před Doclingem

- Dlouhé doslovné citace se ověří a uloží jako omezený výřez; 11 z 15 původních `no_quote` byla délka, zbylé čtyři mají skutečně neplatné řádky.
- Částky jako text, prázdné volitelné URL, obecná přesnost místa, neplatné jednotlivé řádky, pojmenovaná data a krátké sezonní roky.
- Zároveň přísnější pořadatel/citace, ochrana cizích dokumentů řádků, vstupenek, záloh, cen a časových rozmezí. Nedoložená půlnoc se nepřijímá. Zachována opora povrchu trasy a rozlišení okruhu vs. celého závodu.
- OCR: neopakovat trvale prázdný výsledek jako hotový, opakovat neúspěšnou kompilaci, kratší čitelný text může nahradit delší rozbitý, respektovat rotaci PDF. Nová verze uložených výsledků odděluje staré OCR.
- Čtečka `practical-v6`. Offline stejných 36 závodů: **69 přijatých / 52 odmítnutých skupin** oproti původním 51/70; původní sada 12 závodů nyní 30/13. Nejde o procento správnosti, ne všechny původní přijaté hodnoty byly správné.
- Ruční výběr 18 skupin vedl mimo jiné k vyřazení nesprávně doložených pořadatelů. PGR datum v katalogu 31. 7. vs. dokument 7. 8.; Grudziądz 26.–27. 6. vs. dokument 5.–6. 6. 2027. Maštale jsou stabilní historický podklad 2026, ne potvrzení propozic 2027; před doručením dořešit označení minulého původu.
- `local-fills.cjs` posílá `practical_details` jen jako celé prázdné pole. **Neumí doplnit chybějící program závodu, který už má místo.** Před zapojením enrich řešit po jednotlivých částech, se zámky a ochranou proti přepsání změn na cíli.

Poslední kompletní kontrola před novým měřicím skriptem Doclingu: **1 708 testů, 244 souborů, typy, cílený lint a diff check prošly**. Čtyři samostatné zkoušky místního běhu/guardu/runneru/panelu také prošly. Build veřejné aplikace a nová produkční dávka se netestovaly. Nové měření je jen v `reports/`, bez další změny aplikačního kódu.

## Docling už byl skutečně porovnán

**Všechny tři cesty dokončily 13 dokumentů / stejných 40 vybraných stran. Žádný test už nedobíhá.** Výsledky se ukládaly po každém dokumentu a jsou zachované. Souhrn `docling-comparison/comparison-summary.json` už zahrnuje všechny výsledky.

Výsledky jsou smíšené: správná struktura BMX tabulky, ale výchozí Rapid ztratil spodní data Topoľčianek, vynechal hlavní obsah plakátu Slovenský raj a v polském Pucharu změnil dvě 09:00 na neplatné 00:60. U některých dlouhých skenů má více textu — správnost dodatečných údajů zbývá ověřit. **Zatím Docling nenasazovat jako plošnou náhradu.**

Přesné prostředí, logy, ruční očekávání, reprodukce a další krok jsou v navázaném `docling-comparison/RESULT.md`. Nezačínat znovu, nečistit scratchpad ani modely.


Doplnění po doběhnutí: Docling + Vision správně četl obě 09:00 Pucharu, které Rapid změnil na 00:60. Ale také vynechal spodní data Topoľčianek a prakticky celý obsah Slovenského raje. U BMX zachoval 22/22 časových hodnot; dvě zdrojové pomlčky reprezentuje jako prázdná pole (Rapid 24/24 doslovných buněk). Delší polské skeny mají výrazně více textu než současná cesta, což ještě potřebuje věcnou kontrolu. **Další užitečný krok je vizuálně ověřit tyto dodatečné pasáže a teprve pak rozhodnout o selektivním použití Doclingu pro tabulky/delší skeny.** Ponechat současnou čtečku plakátů. Režim `rapid-full` je v měřicím skriptu připravený, zatím netestovaný. Všechny podrobnosti a omezení jsou v závěru Docling RESULT.
