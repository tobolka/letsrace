# Pipeline verze 2: předání Codexu

Stav k 11. 11. 2026 večer. Co běží, co má Codex nastavit a co má dokončit. Podrobný návrh je v [pipeline-v2.md](pipeline-v2.md), tabulka „Co už je a co ne“ tamtéž.

## Co běží

- **Cyklus na Macu** (launchd, `scripts/local-cycle.cjs`): kroky hlásí, jak skončily; po selhání čekají 1 h až 7 dní a po pátém se zastaví; zavřený web se nezkouší pořád dokola.
- **Brána na produkci** (`pipeline_proposals`, `pipeline_apply_proposal`): odkaz na propozice jde do katalogu jen jako návrh s citací. Posílají ho tři cesty: fronta úloh na weby závodů (`pipeline2-find-documents.ts`), čtečky na Macu (`pipeline2-local-regulations.ts`) a agent (`agent-apply.ts`).
- **Agent přes přepážku** (`scripts/agent-desk.cjs`): cyklus každých 6 hodin připraví případy, ověří citace v odpovědích (`agent-verify.ts`) a ověřené předá dál.
- **Souhrn stavu**: `npm run pipeline:status`, soubor `status.json` ve složce dat, okno na ploše.

## Co má Codex nastavit

1. **Race Finder, denně 9:00.** Agent `race-finder` (`.codex/agents/race-finder.toml`). Zadání:

   ```text
   Použij agenta race-finder a postupuj podle jeho pokynů. Začni node scripts/agent-desk.cjs status,
   ber případy po pěti a odevzdávej přes agent-desk.cjs answer, dokud leftToday není 0 nebo open 0.
   U propozic cituj slova, která uvádějí datum tohoto závodu. Na konci napiš počty podle výsledku a co se opakovalo.
   ```

   Strop 20 odpovědí denně hlídá skript. Potřebuje číst a psát do `~/Library/Application Support/LetsRace/data`.

2. **Reader Repair, pondělí 11:00.** Agent `reader-repair` (`.codex/agents/reader-repair.toml`). Jeden zdroj na běh, vlastní větev `agent/reader-<web>`. **Revizi nedělá člověk:** agent na konci spustí `node scripts/reader-accept.cjs <větev>`. Ten větev sloučí a aktualizuje sběrač na Macu, jen když se změna týká čteček, jejich testů a uložených stránek, nemaže žádný test a typy i celá sada testů projdou. Jinak větev zůstane a skript řekne proč. Automatizace musí běžet nad čistou pracovní kopií na větvi `main`.

3. **Jednou týdně přečíst vzorek** (stačí v rámci Race Finderu v pondělí): 10 náhodných přijatých odpovědí z `data/agent/answers/applied.json` porovnat se stránkou. Druh případu, který má ve vzorku chybu, nahlásit vlastníkovi.

## Co má Codex dokončit

V tomto pořadí. Každý bod má test nebo měření, kterým se pozná hotovo. Platí pravidla z `AGENTS.md`; commity, které nemění web, končí `[no deploy]`.

1. **Ověřit první běhy.** 12. 11. kolem 15:40 má `radNetNew` skončit `blocked` a `radNet` se nemá spustit (`heldSteps: 1` ve výsledku průchodu). Večer `npm run pipeline:status`: žádný krok nemá mít víc než 3 selhání za 24 hodin.

2. **Přečíst vzorek 30 přijatých odkazů na propozice** (tabulka `pipeline_proposals`, stav `applied`): patří závodu a ročníku? Výsledek do `reports/pipeline-v2/krok-c/RESULT.md`. Chybný odkaz vrátit přes `pipeline_rollback_fact` a přidat pravidlo.

3. **Termíny od agenta se zatím uplatní jen ze stránek, které kontrola pořadatelů už čte** (`check-next-editions.ts` řádek 135: `settled.url !== page.url`). Doplnit: adresu z ověřené odpovědi přidat mezi stránky závodu v `organiser-check-<rok>`, aby ji další čtení uložilo a stávající kontrola posoudila.

4. **Kandidáti z kalendářů** (`reason = agent_found_in_calendar` v `pipeline_candidates`) se sami nezveřejní. Napojit na stávající posouzení (`validateReviewSource`, `ingestReviewedCandidate`) tak, aby je rozhodl kód, ne vlastník.

5. **Závody bez použitelného místa (15)**: nový druh případu `find_place`; ověřené místo zapsat do kopie katalogu na Macu a nechat projít běžné kontroly.

6. **Další pole přes bránu.** `pipeline_apply_proposal` umí jen `regulations_url`. Další v pořadí: `registration_url` (vzor `pipeline_fill_registration_link`), `website_url`, pak praktické údaje. Pro každé pole: větev ve funkci, test v `scripts/test-pipeline-proposals.mjs`, vyřazení z `EVENT_FIELDS` v `local-fills.cjs`.

7. **Další kroky cyklu jako úlohy ve frontě** podle vzoru `find_documents`: `find_website`, `geocode`, `read_regulations`.

8. **Cloudový pracovník.** `.github/workflows/pipeline.yml` má první úlohu (historie počasí) na ruční spuštění; tajné klíče jsou nastavené a první ruční běh 11. 11. prošel (0 selhání). Další krok: přidat plán, ve stejné změně odebrat `weather-history` z `vercel.json`. Pak po jedné `catalog`, `publication`, `alerts`, `digest`; u e-mailů doložit ochranu před dvojím odesláním.

9. **Kontrola veřejných stránek podle druhu změny** (mění web): běžné doplnění jen vzorkem, skrytí, sloučení a změna data vždy. Roztřídění 744 čekajících je v `pipeline-v2.md`.

10. **Souhrn v administraci** (mění web): stránka, která zobrazí totéž co `status.json`.

11. **`node scripts/with-node.cjs scripts/test-local-sync.cjs` padá** na duplicitním klíči `event_sources_watched_url_id_external_id_key` v živých datech. Zjistit, jestli jde o data, nebo o chybu převozu.

12. **Lint na `main` padá** na starých souborech v `reports/` (`*.mts`, `geocode.ts`). Vyřadit `reports/` z lintu nebo soubory opravit.

13. **Zkouška Cloudflare**: až po bodu 8 a změření CPU na Vercelu. Viz „Hosting a ceny“ v `pipeline-v2.md`.

## Co nedělat

- Nevolat Claude z cyklu ani plánovaně (rozhodnutí vlastníka, 11. 11.). `AGENT_IN_CYCLE=1` nechat vypnuté.
- Nečíst stránky s kontrolou robotů nebo přihlášením. rad-net zůstává zavřený.
- Nezvyšovat limity AI přes API (0,50 USD denně, 5 USD měsíčně) bez vlastníka.
- Neslučovat závody mimo `agent-apply.ts` a stávající pravidla; každé sloučení musí jít vrátit.

## Jak se vrátit zpět

| Co | Jak |
| --- | --- |
| Hledání propozic postaru | `LOCAL_SITE_DOCUMENTS=1` v prostředí sběrače |
| Odkaz na propozice zpět do převozu z Macu | `LOCAL_FILL_REGULATIONS=1` |
| Vypnout slučování od agenta | `AGENT_MERGES=0` |
| Vypnout agenta úplně | smazat složku `agent/cases` ve složce dat |
| Uvolnit zastavený krok | `npm run pipeline:status -- --retry=<krok>` |
| Vypnout okno na ploše | `defaults write cz.letsrace.monitor desktopSummary -bool false` |
| Vrátit přijatý odkaz | `pipeline_rollback_fact(<id z pipeline_proposals.fact_id>)` |
