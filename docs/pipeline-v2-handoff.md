# Pipeline verze 2: stav a co zbývá

Stav k 11. 11. 2026 večer. Co běží, co má Codex nastavit a co má dokončit. Podrobný návrh je v [pipeline-v2.md](pipeline-v2.md), tabulka „Co už je a co ne“ tamtéž.

## Co běží

- **Cyklus na Macu** (launchd, `scripts/local-cycle.cjs`): kroky hlásí, jak skončily; po selhání čekají 1 h až 7 dní a po pátém se zastaví; zavřený web se nezkouší pořád dokola.
- **Brána na produkci** (`pipeline_proposals`, `pipeline_apply_proposal`): odkaz na propozice jde do katalogu jen jako návrh s citací. Posílají ho tři cesty: fronta úloh na weby závodů (`pipeline2-find-documents.ts`), čtečky na Macu (`pipeline2-local-regulations.ts`) a agent (`agent-apply.ts`).
- **Agent přes přepážku** (`scripts/agent-desk.cjs`): cyklus každých 6 hodin připraví případy, ověří citace v odpovědích (`agent-verify.ts`) a ověřené předá dál.
- **Souhrn stavu**: `npm run pipeline:status` a soubor `status.json` ve složce dat. Okno na ploše vlastník odmítl; nepřidávat ho znovu.

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

## Co se z původního seznamu stalo (11. 11. večer, druhé kolo)

| Bod | Stav |
| --- | --- |
| Vzorek přijatých odkazů na propozice | **Hotovo, všech 8.** 5 správně, 1 je řád série místo propozic závodu (ponecháno), 2 špatně a vráceno: loňské propozice na nezměněné adrese (Žernovský bajk) a klubový zpravodaj (Stahlrad Laatzen). Oba přišly z předání čteček na Macu, které dokument nekontrolovalo. Teď kontroluje závod i ročník, a zpravodaje se mezi propozicemi nehledají. |
| Termíny od agenta ze stránek, které nečteme | **Hotovo.** `check-next-editions.ts` si takovou stránku přečte na místě a rozhodne stejnými kontrolami. Ostře ověří až první odpověď. |
| Kandidáti z kalendářů | **Hotovo pro kalendáře národních svazů.** Jdou stávající cestou posouzených kandidátů (`review-discovery-candidates.ts`): stránka se čte znovu, citace musí uvádět datum s rokem, musí být místo, země a disciplína, a v katalogu nesmí být podobný závod ve stejné dny. Ostatní kalendáře zůstávají jen podnětem. Ostře ověří až první odpověď. |
| Cloudový pracovník | **Hotovo jinak, než bylo v plánu.** Každé 3 hodiny běží v GitHub Actions hledání propozic přes frontu, ale jen když se Mac 30 minut neozval. Pět úloh z `vercel.json` zůstává na Vercelu: běží i bez Macu a skoro nepočítají (čekají na síť), takže jejich přesun by CPU neušetřil. |
| Lint na `main` | **Nebyl problém.** CI je zelené; padal jen místně na necommitnutých souborech v `reports/`. |
| Zkouška Cloudflare | **Web se sestaví** (větev `cloudflare-trial`). Nasazení na zkušební adresu čeká na `wrangler login` a placený tarif. Viz `reports/pipeline-v2/cloudflare/RESULT.md`. |

## Co zůstává a proč

Tohle jsem neudělal záměrně, ne z nedostatku času. U každého bodu je, co by ho odůvodnilo.

1. **Další pole přes bránu** (`registration_url`, `website_url`, praktické údaje). Brána je přísnější než starý převoz: vyžaduje, aby dokument jmenoval závod a den. U webu a přihlášky to stránky pro rok 2027 často ještě nesplní, takže by přísnější cesta dnes spíš ubrala pokrytí. Vrátit se k tomu, až bude vzorek chyb u těchto polí.
2. **Další kroky cyklu jako úlohy ve frontě.** Odklady a zastavení už mají kroky i bez fronty. Fronta přinese užitek, až bude druhý pracovník potřebovat víc než hledání propozic.
3. **Závody bez použitelného místa (15) a bez budoucího data (61).** Málo případů; první skupina by potřebovala zápis místa do kopie katalogu, druhá jsou starší závody nalezené pozdě.
4. **Kontrola veřejných stránek podle druhu změny a souhrn v administraci.** Obojí mění web a vyžaduje nasazení. Čekající kontroly nic neblokují: žádost o obnovu stránky jde zvlášť a hned.
5. **`test-local-sync.cjs` padá** na duplicitním klíči ve zdrojích závodů. Je to zkouška celého převozu nad živými daty; ostrý cyklus posílá jen posouzené nové závody a ty procházejí. Neřešil jsem.
6. **Týden měřit, pak pokračovat.** Denní čísla: `npm run pipeline:status -- --history`. Další stavba (nové závody přes bránu a konec dvojího katalogu) má začít až s týdnem dat.
7. **Ověřit zítřejší běhy**: sdílené čekání rad-netu (12. 11. kolem 15:40) a počet selhání kroků za den (`npm run pipeline:status`).

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
| Vrátit přijatý odkaz | `pipeline_rollback_fact(<id z pipeline_proposals.fact_id>)` |
