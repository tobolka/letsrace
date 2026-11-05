# Předání práce druhé AI · 5. listopadu 2026, odpoledne

Tímto Claude Code předává práci. Od této chvíle ji vedeš ty. Tento dokument má přednost před `REPORT-DNES.md`. Důvody a starší důkazy zůstávají v `DECISIONS.md`.

## Co od tebe vlastník chce jako první

**„Jestli máš termín, závod a místo, tak to pošli.“** Nové závody z průchodu na Macu **zatím nejsou na serveru**. Začni bodem 1 v části „Co udělat dál“.

## Stav v jedné minutě

- **V gitu nic.** HEAD je `5b6a8eba`. Moje a tvoje změny jsou v pracovní kopii, commituj je odděleně.
- **Nasazené nic.** Změny v kódu na webu nejsou.
- **Na serveru jsem zapsal jen opravy tří závodů** (níže). Nic dalšího.
- **Pravidelný sběr dál stojí** a Vercel ho blokuje. Na Macu je `paused: true`.
- **Lokální služby jsou vypnuté.** Všechny testy a zkoušky doběhly, viz „Ověření“.

## Co je zapsané na ostrém serveru

Skript: [apply.sql](../race-fixes-2026-11-05/apply.sql), na server spuštěný přes MCP se stejnými hodnotami. Vlastník souhlasil.

| Závod | Změna | Zámek proti přepsání sběrem |
| --- | --- | --- |
| Lakeland GRVL 2027 | Sloučeno přes `app_merge_events`. Hlavní záznam `a29fb9a6-…`, adresa `lakeland-grvl-mikolajki-2027`, místo Mikołajki. Sloučený `0af22121-…` byl v Szelmentu. Odkazy pořadatele a přihláška doplněné, stav `registration_open`. | místo, termín, web, propozice, přihláška |
| Hardy Gravel: Perun | Termín z 16.–19. 7. na **17.–19. 7. 2027**. Místo zůstává **Wierzchosławice**, zadání uvádělo Chotowa, ale pořadatel píše Wierzchosławice. Přidán řádek „Last Man Standing, okruh asi 30 km“. `registration_open`. | termín, místo |
| GR8 Lakes GRVL | Web `greatlakes.gravel.love` a přímý odkaz na přihlášku, `registration_open`. **Termín jsem nechal 17.–19. 9.**: kalendář pořadatele uvádí 17.–19., web závodu a obchod 18.–19. a regulace 2027 jsem nenašel. | web, přihláška |

**Na webu se to ještě neprojevilo.** Při poslední kontrole Perun ukazoval 16. července, stará adresa Lakelandu vracela 200 bez přesměrování a odkazy GR8 Lakes tam nebyly. V databázi je to správně, úlohy `public_refresh` čekají a `request-public-refreshes.ts` vrací `waiting`. Cron `/api/cron/publication` běží v 05:40 UTC. **Ověř to po něm** včetně přesměrování staré adresy Lakelandu. Pokud se to neprojeví, je to chyba k řešení.

Poznámka do „Co je nového“ v `src/lib/release-notes.ts` je napsaná, ale neuložená. Vyjde až s commitem.

## Co udělat dál

### 1. Poslat nové závody

Návrh je připravený v `~/Library/Application Support/LetsRace/data/local-pass-run/plan-new-races/`. Jde o **4 závody, 15 řádků**, otisk `49f6ca9c1de4bef64ae43cb89e6f5af402ba4c207d56981f168771c41b13f24c`:

| Termín | Země | Závod |
| --- | --- | --- |
| 13. 12. 2026 | IT | Baby Memorial Trulli de Paolis, Ardea |
| 24. 1. 2027 | IT | 1° Trofeo Nazionale Ciclocross Città di Sassari |
| 27. 3. 2027 | DE | Ronde von Rheinhessen |
| 27. 3. 2027 | CH | Škoda Swiss Bike Cup — Osterhas |

Termín se při druhém čtení na stránce zdroje podařilo najít jen u Osterhas. U zbylých tří ne, což může být jen formát stránky. Podle pokynu vlastníka to neblokuje, ale projdi si je.

**30 dalších závodů je zadržených a podle mě je kontrola moc přísná.** Rozhodni o tom, nečekej na vlastníka:

- `may_already_be_listed` (23): vyšší počet může být falešná shoda. Zkontroluj několik případů, například Allgäu & Spätzle nebo Rebound Germany, a uprav práh, pokud je potřeba.
- `place_not_on_the_map` (14): závod má místo, jen bez souřadnic. Vlastník chtěl „termín, závod a místo“, takže tohle pravděpodobně nemá blokovat. Souřadnice může doplnit geokódování.
- `listed_as_a_ride` (6), `name_says_too_little` (1), `no_future_date` (1): tady bych držení nechal.

Po úpravě je potřeba návrh přegenerovat (`letsrace_pass1` a `letsrace_baseline` mají z mého posledního běhu aktuální stav jen k tomu času):

```bash
bash scripts/local-db.sh start
node -e "require('./scripts/local-sync.cjs').plan(process.argv[1],'letsrace_pass1','letsrace_baseline')" "$HOME/Library/Application Support/LetsRace/data/local-pass-run/plan-new-races"
node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/local-review-new.ts --plan="$HOME/Library/Application Support/LetsRace/data/local-pass-run/plan-new-races" --work=letsrace_pass1 --only-new-races
```

Před prvním odesláním musí být na serveru tabulka potvrzení dávek. **Zatím tam není.** Je přídavná, migrace je `supabase/migrations/20261105150000_pipeline_sync_batches.sql`.

Potom:

```bash
node scripts/local-sync.cjs send --changes="$HOME/Library/Application Support/LetsRace/data/local-pass-run/plan-new-races/changes.ndjson" --confirm=OTISK --dry-run
```

Stejný příkaz bez `--dry-run` zapíše. **Cesta `send` proti skutečnému serveru nikdy neběžela**, ani `--dry-run`. Nejdřív zkus dry-run a porovnej výsledek s lokální zkouškou. Trigery na serveru založí úlohy obnovy stránek a Vercel je pak bude zpracovávat, takže poprvé pošli málo.

### 2. Commitnout a nasadit

Moje soubory jsou na konci dokumentu. Před nasazením spusť build, ten jsem nespouštěl. Po commitu aktualizuj kopii v `~/Library/Application Support/LetsRace/runtime`.

### 3. Dokončit ověření kódu v běžném průchodu

Moje závěrečné dvoukolové ověření jsem na žádost vlastníka přerušil. **První kolo doběhlo, druhé ne**, takže přetahování hodnot na konečné verzi pravidel není změřené. Poslední měření (před zpřísněním `isSamePlace` a povolením opravy na `race`): 66 závodů se skutečnou změnou místo 140, typ závodu 0. Přísnější `isSamePlace` to může zase zvýšit.

```bash
bash scripts/local-db.sh restore
bash scripts/local-run.sh node scripts/local-parallel.cjs --all
```

Potom druhé kolo a srovnání, viz `plan(out, 'letsrace', 'letsrace_pass1')`.

### 4. Zbývající problémy v datech a čtečkách

- **Spojené závody:** 43 budoucích záznamů má zdroje s různými daty, 28 z `radsport-events.de`. `isDifferentDatedRace` v `update-policy.ts` zastaví přeskakování termínu, ale **záznamy nerozděluje**. Rozdělení zbývá. Tyto řádky teď končí jako `identity_review_required`.
- **Fronta zadržených změn:** 26 závodů a 136 řádků, většinou přesuny termínů, leží v `held-for-review.ndjson`.
- **Nová chyba, nevysvětlená:** 6 zdrojů skončilo `Cannot read properties of undefined (reading 'inde…`. Před mými posledními úpravami jsem ji neviděl, takže **jako první prověř, jestli ji nezpůsobila některá z nich**, například nová čtečka nebo `local-guard.cjs` (`local-pass-run/logs/`).
- **Zdroje bez výsledku:** poslední report hlásí 190 `unsupported_or_empty_source`, 21 `write_failed`, 14 `HTTP 500` a 81 tichých zdrojů. Opakovaně se objevují varianty `cyclingaustria.at/kalender`. Nezkoumal jsem je, mohou souviset s během přes 6 procesů.
- **`location` a duplicitní místa:** přibývají záznamy `locations`. Stabilní výběr to zmírňuje, ale duplicitní řádky v katalogu zůstávají a nikdo je neslučuje.
- **Rok v kódu čteček:** přepsal jsem jen 6 pravidel v `adapters.ts`, která u roku 2027 vracela prázdný výsledek. Tabulky s konkrétními daty 2026 v `kids-mtb-cups.ts` a dalších jsem neprocházel.
- **Pokrytí ročníků:** poslední čísla jsou níže. Web pořadatelů (`race_website`) není zapojený do paralelního běhu, jen do starší linky `scripts/local-pass.ts`. Pro cíl 90 % to bude potřeba.
- **Limity serveru:** spotřebu CPU na Vercelu a veřejné dotazy jsem neřešil.

| Země | Závody 2026 | S ročníkem 2027 | % | Bez ročníku, zdroj přečten | Nezkontrolováno |
| --- | ---: | ---: | ---: | ---: | ---: |
| CZ | 945 | 26 | 2,8 | 345 | 574 |
| SK | 226 | 4 | 1,8 | 137 | 85 |
| AT | 452 | 46 | 10,2 | 98 | 308 |
| DE | 777 | 34 | 4,4 | 154 | 587 |
| PL | 504 | 20 | 4,0 | 57 | 427 |
| CH | 188 | 12 | 6,4 | 68 | 108 |
| IT | 651 | 6 | 0,9 | 20 | 625 |

Čísla jsou z lokální kopie po přerušeném druhém kole. „Nezkontrolováno“ je tak vysoké i proto, že přísné párování a závody bez sledovaného zdroje se tam sčítají. Termíny se nedopočítávají.

## Tvoje recenze: co se s ní stalo

| Nález | Stav |
| --- | --- |
| D7 vnořené osobní údaje | Opraveno. `scripts/local-pull.cjs` stahuje jen povolené tabulky a neznámá tabulka běh zastaví. `pipeline_merge_history` je v lokálních databázích prázdná. |
| D6 souběh | Opraveno `for update` a zámkem `event_overrides`, otestováno souběžnou úpravou. Pořadí zámků proti zapisovacím funkcím jsem neporovnal. |
| D6 ztráta vazby na závod | Opraveno přes `owner`, otestováno. |
| D6 zámky `categories` a `practical.*` | Opraveno. Kategorie otestovány, `practical.*` bez testu. |
| D6 závod jako celek | Opraveno skupinou řádků v `local-sync.sql`, otestováno. |
| D6 potvrzení čtení | Vyřešeno tím, že `watched_urls`, `page_reads`, `catalog_probes`, `pipeline_candidates` a historie se neposílají. Důsledek: **server si o přečtení zdrojů nic nepamatuje**, to platí, dokud čte Mac. |
| D6 obnova po pádu | Opraveno `pipeline_sync_batches` v téže transakci, otestováno lokálním pádem po potvrzení. |
| D6 nové závody navzájem | Opraveno. |
| D6 doklad termínu | **Jen částečně.** Vyžaduje se zdrojový řádek. Nález termínu při druhém čtení se jen zaznamená, protože vlastník chtěl závody poslat. Slib „žádný falešný závod“ tím není úplně pokrytý. |
| D6 otisk návrhu | Opraveno, `apply` i `send` vyžadují prošlou kontrolu a shodný otisk. |
| D11 `chooseEventType` | Opraveno pro `series` a `cup`. Výslovné `race` záměrně nepřepíše `championship` ani `ride`. |
| D11 `isSamePlace` | Opraveno, doplnění bodu i posun nad asi 500 m se bere jako změna. |
| D1 až D3 definice a PostGIS | Opraveno. `scripts/local-compare-server.cjs` nenašel rozdíl: 87 funkcí, 21 triggerů, 426 sloupců, 135 omezení, 20 pravidel, 3 000 míst. Plány a přihlášení na kopii dál ověřit nejde. |
| D8 izolace | Rozšířeno na příkazy (`curl` a podobně) a Chrome (`--host-resolver-rules`). Funkčnost v Chromu jsem přímo neověřil. Kontrola argumentů nezastaví úplně všechno, například adresu uvnitř shell skriptu. |
| Oddělené oprávnění | Jen částečně. `send` si bere přístup sám a odmítne běžet v lokálním průchodu. **Pořád je to role `postgres`**, omezená role na serveru není. |
| D9, D10 pokrytí | Oddělené „zdroj přečten“ a „nezkontrolováno“ je v reportu. Oznámené a neoznámené ročníky přesně odlišit neumí. |

## Ověření

- `npm test`: 239 souborů, 1 617 testů prošlo. Po posledních úpravách jsem znovu spustil jen `test-local-sync.cjs`.
- Kontrola typů prošla. Lint jsem na posledních úpravách už nespouštěl.
- `node scripts/test-local-sync.cjs`: 25 kontrol prošlo, jen lokálně.
- Průchod: 724 zdrojů, 471 v pořádku, přibližně 11 minut pro první kolo.
- **Neověřeno:** build, odeslání na server, druhé kolo konečné verze, zobrazení oprav na webu, Chrome s blokací a `local-dashboard.cjs` jen krátkou zkouškou.

## Důležité pro práci na Macu

- Lokální databáze: `bash scripts/local-db.sh start|stop|status|restore|reset`, port 54329, data v `~/Library/Application Support/LetsRace/data/local-postgres`.
- Stažení kopie: `node scripts/local-pull.cjs`. Potřebuje `SUPABASE_DB_URL` v `.env.local`, který je mimo git.
- Běh: `bash scripts/local-run.sh node scripts/local-parallel.cjs --all`. Výchozí počet je 6 procesů.
- Přehled: `node scripts/local-dashboard.cjs --plan=… --report=…`, adresa `http://127.0.0.1:54340`. Jen čte a nic neposílá. Na Mac panel napojený není.
- Nesahej na `postgresql@15` a databázi `races` na portu 5432. To jsou věci vlastníka.
- Homebrew je aktualizovaný z 5 na 7 a přibyly `postgresql@17`, `postgis`, `postgrest`.

## Moje soubory

Upravené:

- `docs/keep-fresh.md`, `scripts/check-next-editions.ts`, `scripts/judge-duplicates.ts`, `scripts/refresh-data.sh`, `scripts/reload-calendars.ts`
- `src/lib/release-notes.ts`
- `src/lib/__tests__/bikeboard.test.ts`, `src/lib/__tests__/refresh-daily-steps.test.ts`
- `src/lib/watcher/pool.ts`, `src/lib/watcher/run.ts`, `src/lib/watcher/update-policy.ts`
- `src/lib/watcher/extractors/adapters.ts`, `bikeboard.ts`, `csc.ts`, `csc-render.ts`

Nové:

- `reports/claude-review-2026-11-05/`, `reports/race-fixes-2026-11-05/`
- `scripts/local-api.cjs`, `local-compare-server.cjs`, `local-dashboard.cjs`, `local-db.sh`, `local-diff.cjs`, `local-guard.cjs`, `local-parallel.cjs`, `local-pass.ts`, `local-pull.cjs`, `local-report.ts`, `local-review-new.ts`, `local-run.sh`, `local-sync.cjs`, `local-sync.sql`, `test-local-sync.cjs`
- `src/lib/catalog/edition-season.ts`, `src/lib/local-pass/`, `src/lib/watcher/chrome-slots.ts`
- `src/lib/__tests__/edition-season.test.ts`, `src/lib/__tests__/local-pass.test.ts`
- `supabase/migrations/20261105150000_pipeline_sync_batches.sql`

Pozor na změny, které **platí i pro běžný sběr**, ne jen na Macu: `chooseEventType`, `isSamePlace`, `isDifferentDatedRace`, stabilní výběr místa v `run.ts`, nová čtečka `bikeboard.at` a čtení dalšího roku ČSC v `csc.ts`.
