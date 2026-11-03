# Oprava vlastních odkladů při aktualizaci existujícího závodu

3. listopadu 2026. Při kontrole posledního běhu Macu byly mezi odloženými zápisy vidět opakované `concurrent_event_update`. Část má reálný souběh; další chyba byla v pořadí kroků zapisovače: existující závod se načetl, potom se přímo doplnily souřadnice nebo přiřadil vedlejší seriál. Tyto kroky správně změnily veřejnou verzi závodu. Následná kontrola však stále očekávala původní verzi a odmítla vlastní změnu.

## Provedená oprava

- Místa a geokódování se pro existující závod nejprve jen připravují. Totéž platí pro vedlejší vazby seriálů včetně `alsoSeries`.
- `pipeline_update_watcher_event` kontroluje převzetí zdroje, aktuální veřejnou verzi a ruční zámky **před** těmito změnami. Plánované místo/geokódování a vazby se provedou uvnitř stejné transakce jako hlavní údaje a historie.
- Neuskutečněná změna místa, například kvůli ručnímu zámku, nevytvoří osiřelé místo. Chyba historie nebo pozdní vazby vrátí všechny kroky této operace.
- Skutečná cizí změna zůstává chráněná odmítnutím starého návrhu. Kontrola se neobchází novým načtením verze bez opětovného výpočtu údajů.
- Souřadnice se zamykají před závodem stejně jako u ostatních změn míst. Změněné místo či propadlé převzetí se nepřepíše.

## Ověření

Rozšířená databázová zkouška `scripts/test-atomic-watcher-create.mjs` ověřuje doplnění vlastních souřadnic bez falešného souběhu, samostatnou vedlejší vazbu při prázdné změně hlavních polí, návrat nového místa při selhání historie, skutečně starou verzi, zámek místa a propadlé převzetí. Celá sada: **1 484 testů / 228 souborů prošlo**; sestavení a cílená kontrola kódu také.

Na skutečné databázi byl scénář chybějících souřadnic připraven uvnitř záměrně vrácené transakce. Doplnění uspělo po kontrole veřejné verze bez vlastního konfliktu; po ukončení zkoušky zůstaly skutečný závod i místo přesně v původním stavu. **Žádná zkušební veřejná změna se nezachovala.**

Logy: `tmp/atomic-create-sql.log`, `tmp/atomic-dependencies-tests.log`, `tmp/atomic-dependencies-build.log`, `tmp/atomic-dependencies-lint.log`.

Nasazeno `3c58e77d`, Vercel `dpl_EsvbBrC6v3UnRK1FN2WAQMaMavaP` READY s produkční doménou. Mac má totožné soubory a běží. Skutečný opakovaný běh Chotěbuze s novým předáním převzetí do databáze: [0 nových / 0 změněných / 0 chyb](existing-dependency-replay.json).

## Hranice

Změny zdrojových vazeb, celého snímku podkladu, kategorií a oznámení u existujícího závodu mají dosud další kroky. Příprava metadat seriálu může dál předcházet zápisu a vyvolat oprávněné nové vyhodnocení. Nejde o odstranění všech případů souběhu ani dokončení celé pipeline. Nejasné identity z RideAndRest/Odjazdu a odmítnutý přístup Eventivu nejsou touto změnou prohlášené za vyřešené.
