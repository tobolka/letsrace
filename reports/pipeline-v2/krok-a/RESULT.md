# Krok A: pravdivý stav verze 1

11. 11. 2026. Zadání: [docs/pipeline-v2.md](../../../docs/pipeline-v2.md), krok A.

## Co se změnilo

- `scripts/local-cycle.cjs`: `stepOutcome` rozlišuje, jak krok skončil: `done`, `partial` (zastavil se na vlastním limitu), `timeout` (uťal ho limit zvenčí), `blocked` (druhá strana nás nepustí), `waiting` (došel rozpočet AI), `failed`. Krok to může říct sám řádkem `step_outcome {"outcome":…,"reason":…}`. Výsledek je v `result.json` pod `steps`.
- Průchod, ve kterém krok selhal nebo mu vypršel čas, končí stavem `attention`, ne `finished`.
- Krok, který je zavřený zvenčí, se nepočítá jako selhání a čeká svůj obvyklý interval. Dřív se zkoušel při každém průchodu.
- `scripts/harvest-radnet.ts`, `scripts/radnet-new-races.ts`: při kontrole návštěvníka hlásí `blocked / robot_check`.
- `src/lib/pipeline2/status.ts`: souhrn složený z uložených výsledků průchodů, s barvou. Starší výsledky čte z původních textů.
- `scripts/pipeline-status.ts`: tiskne souhrn, ukládá `status.json` do složky dat; `--summary` vypíše jen souhrn, `--no-write` neukládá.

## Před a po

| | Před | Po |
| --- | --- | --- |
| rad-net za 24 hodin | `radNet` 19 selhání, `radNetNew` 25 selhání, důvod neznámý (`exit 1`) | 1 pokus, `blocked (robot_check)`, další za 24 hodin |
| Průchod se selhaným krokem | `finished`, „Hotovo“ | `attention`, kroky vyjmenované |
| Vypršený čas kroku | `deferred`, stejně jako rozpracovaná práce | `timeout`, počítá se mezi nedokončené |
| Stav jedním řádkem | nebyl | `ŽLUTÁ: Čeká na okolnosti mimo nás: radNet, radNetNew, checkDetails, regulations` |

Ověřeno průchodem `2026-11-11T14-39-37-763Z` z nainstalované cesty s mezerou.

## Co ověřené není

- `timeout` u `regulations` v ostrém průchodu: dnes je rozpočet AI vyčerpaný, takže krok neběžel. Rozlišení kryje jen test (`scripts/test-local-cycle.cjs`).
- Ve starších výsledcích nejde `deferred` rozdělit na `partial` a `timeout`; souhrn je vede jako `partial` s důvodem `own_budget_or_timeout`.
- „Od kdy“ u kroku se počítá od první změny výsledku, takže rad-net ukazuje dnešek, i když je zavřený od 8. 11.
- Panel v liště nový souhrn zatím nečte.

## Čísla, která první znění návrhu četlo špatně

**Blokované úlohy čtení (1 943):** 1 927 patří pozastaveným zdrojům, 16 zdrojům označeným za mrtvé (například HTTP 404). Žádná není blokovaná bez příčiny; chybí jen zapsaný důvod u úlohy.

**Čekající kontroly veřejných stránek (742):** 724 má zapsanou žádost o obnovu stránky, z toho 705 pro aktuální revizi. 18 žádost nemá. 24 patří sloučeným závodům. Za posledních 24 hodin proběhlo 52 kontrol z povolených 60.

## Testy

`npm test`: 254 souborů, 1 849 testů, vše prošlo. `node scripts/test-local-cycle.cjs` a `scripts/test-local-runner.cjs` prošly.
