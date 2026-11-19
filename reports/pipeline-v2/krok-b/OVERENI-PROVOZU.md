# Bod 1 – první běhy na Macu

**Stav k 11. 11. 2026 v 17:22 SEČ** · Výchozí kontrola hotová. Provozní ověření čeká na běhy 12. 11. Zadání je v [předávacím dokumentu](../../../docs/pipeline-v2-handoff.md).

## Naměřený stav

- Sběrač i panel běžely. Nainstalovaný `local-cycle.cjs` je shodný se souborem v pracovní kopii. Průchod `2026-11-11T16-06-03-504Z` skončil v 17:06:19 SEČ jako `finished` s `failedSteps: 0`. Kroky `regulations` a `checkDetails` čekaly na rozpočet AI.
- Testy `node scripts/with-node.cjs scripts/test-local-cycle.cjs` prošly včetně sdíleného odkladu, postupného čekání a zastavení po pátém selhání.
- Poslední pokusy `radNetNew` a `radNet` proběhly 11. 11. v 15:39 SEČ, ještě před instalací sdíleného odkladu. Oba skončily `blocked (robot_check)`. V uloženém stavu zatím pro `rad-net.de` není společný odklad. Běžný 24hodinový interval dovolí další pokus nejdříve 12. 11. v 15:39:40 SEČ, přesný čas určí běh sběrače.
- Výchozí 24hodinový souhrn v 17:21:52 SEČ zahrnoval starší provoz. `summary.steps[].day.failed` uvádí 22 selhání u `radNetNew` a 19 u `radNet`. Textové „za 24 h 1×“ v obou řádcích je počet výsledků posledního typu `blocked`.

## Zbývá ověřit 12. 11.

1. V uloženém `local-cycles/*/result.json` z prvního dokončeného průchodu, který se dostal k rad-netu po uplynutí intervalu, ověřit `steps.radNetNew.outcome = blocked`, absenci `steps.radNet` a `heldSteps: 1`. Společný odklad lze doložit i z `local-cycle-state.json`. Čas a ID průchodu zapsat sem.
2. Večer po 17:06 SEČ spustit `npm run pipeline:status -- --json` a vyhodnotit všechny kroky za 24 hodin. Pro limit tří selhání přičíst k `failed` jen skutečné `timeout` bez příznaku `slept` v uložených výsledcích. Zapsat počet průchodů, maximum na krok a případné překročení.
