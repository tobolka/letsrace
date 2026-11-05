# Předání Claudovi · 5. listopadu 2026, odpoledne

## Co chce vlastník TEĎ

**Přesunout maximum sběru a zpracování závodů na Mac, aby se tento měsíc ulevilo Supabase a Vercelu. Mac má průběžně dokončovat práci, ne čekat 12 hodin kvůli limitům serverů.** Cíl pořád platí: co nejvíce skutečných závodů, správné a bohaté údaje na veřejném webu, minimum duplicit a ruční správy. Nepřidávat triatlony. Nečekej na další „pokračuj“ po každé malé opravě.

Vlastník požádal o toto předání, protože mu v tomto chatu docházejí kredity. Tvůj starší `reports/claude-review-2026-11-05/PREDANI-CODEX.md` zůstává zdrojem původních otevřených bodů; níže jsou změny od jeho předání. Převezmi práci, nerevertuj změny jiné AI. Čti aktuální AGENTS.md a docs/annual-editions.md.

## Nejprve pravdivý stav

| Část | Ověřený stav při předání |
| --- | --- |
| Hlavní větev a web | `origin/main` obsahuje `e744fe0f` a předchozí tři commity. Vercel produkce `dpl_EKSxmGvUTtHSaR53W4zZvm6Rzrbc` je READY, alias letsrace.cz. Závěrečný commit tohoto předání bude navíc. |
| Nový Mac plánovač | **Zapnutý**, `paused:false`, `pipelineMode:local-new-races`. Nová cesta `scripts/local-cycle.sh`, nikoli starý refresh-data.sh. Při předání žádný běžící řízený sběr. |
| Interval | **STÁLE 12 HODIN.** Změnu na průběžné dokončování jsem slíbil, ale NEIMPLEMENTOVAL. Další čas byl 6. 11. 03:29 CET. Tohle oprav jako první spolu s dokončováním fronty. |
| Které změny odesílá | Pouze prověřené nové závody ze známých zdrojů. **Aktualizace existujících závodů se automaticky NEODESÍLAJÍ.** Jsou místně, nejsou ztracené. |
| Weby pořadatelů | Poslední ruční průchod skutečně četl weby ročníků 2026 pro hledání 2027. **NENÍ zapojený do pravidelného `local-cycle.cjs`.** Zatím jde o uložené podklady, ne hotový import či doplňování údajů. |
| Server watch/explore | Nadále blokované firewallem, naposledy 403 ověřeno po produkčním nasazení. Neobnovovat paralelní starý sběr. |
| Další serverové úlohy | `catalog`, `source-health`, `geocode`, `weather-history`, `publication`, `alerts`, `digest` zůstávají naplánované. **Nejsou přesunuté na Mac.** |
| Placená AI v novém místním režimu | Není zapnutá. Dosavadní společné limity zůstávají 0,50 USD/den, 5 USD/měsíc. |

**Samotné zapnutí Macu neznamená hotovou pipeline.** Vlastník je oprávněně nespokojený, protože weby pořadatelů, odesílání aktualizací a další serverová práce ještě nejsou dotažené.

## Co jsem skutečně dokončil

### 1. Bezpečná místní cesta a její automatické spuštění

- Jeden řízený průchod najednou. Trvalá pracovní DB `letsrace` se při dalším cyklu neobnovuje ze serveru; zachovává otisky, další termíny čtení a rozdělané výsledky.
- Čerstvý cílový katalog je v samostatné dočasné `letsrace_auto_*` DB. Jen ta se po průchodu uklízí. **Nedělat restore pracovní DB před každým během.**
- Čtečky mají izolovaný místní přístup, odesílání je oddělené, ověřuje otisk návrhu, běží po transakčních balících a ukládá potvrzení na cíli. Na server byla aplikována migrace `pipeline_sync_batches`; RLS a nepřístupnost anon/authenticated jsou zachované.
- Opravena ztráta `promisify.custom` v local-guard.cjs. Ta způsobovala šest chyb `indexOf`; skutečná dříve postižená stránka pak vrátila HTTP 200 a text.
- Zastavení průchodu nesmí pokračovat do odesílání ani když se čtečka ukončí kódem 2. Ověřeno podprocesovým testem.
- Přehnané zadržování jen podle stejného dne opraveno. Známá obec nemusí čekat na souřadnice. Vyjížďky z Radsportu zůstávají oddělené.
- Panel popisuje první nový rozsah, nenabízí starý serverový sběr, samostatné staré ČSC/AI spouštění ani neslibuje běh placené AI. Staré počty místních změn se nemíchají s novými skutečně odeslanými výsledky.
- Kontroly veřejných revizí používají existující společnou frontu s limitem 60 pokusů/den. Nepřidávat další neomezené načítání všech jazykových stránek.

### 2. Skutečné odeslání nových závodů

- Nejdřív 3: Baby Memorial Trulli de Paolis (Ardea), Trofeo Nazionale Ciclocross Città di Sassari, GP Osterhas 2027 (Affoltern am Albis, bez chybného členství v Swiss Bike Cupu).
- Další cyklus vložil 18; jedna nová duplicita Welsu byla následně obnovitelně sloučena s existujícím záznamem. **Čistý přírůstek této dávky 17, celkem 20.** Neříkat 21 unikátních nových závodů.
- Trofeo Iaccobike: chybná obec `INGR. COPPI` opravena na **Castellarano**, souřadnice zůstávají prázdné. Opravený společný výběr italské obce s kódem provincie. Na českém veřejném detailu ověřeno Castellarano.
- Wels: nový `3e8e6af5-1dfc-45ed-b9f8-2e4ce842cb9d` je skrytý/sloučený do původního `09e14a6c-8fac-442b-a4db-4d1c57608922` přes app_merge_events. Původní CX disciplína zachovaná, zdroje a vazby přesunuté. **Stará veřejná stránka ještě při poslední kontrole vracela původní detail**; potvrdit obnovu/přesměrování. Kontrola nových závodů nově zahrnuje skryté i sloučené názvy a nenechá nesprávné disciplíny obejít zadržení dlouhého aliasu na stejném webu.
- Ronde/Rebound/Gigante a další jasné vyjížďky nejsou zveřejněné jako závody.

Podrobnosti: `reports/local-release-2026-11-05/RESULT.md`, `automatic-proof.json`, `production-proof.json`, `first-sources-final.json`. Transakční potvrzení jsou v serverové tabulce, návrhy a další důkazy v soukromých local-cycles adresářích.

### 3. Změřený běh (ne celá kvalita katalogu)

| Běh | Skutečná doba | Výsledek |
| --- | --- | --- |
| První celý | 10 min 27 s | 377 zdrojů; po opravě duplicity 17 nových závodů |
| Běžné opakování | 29 s | 0 opakovaných čtení, 0 zápisů; 9 658 místních eventů beze změny mimo časová/revizní pole |
| První spuštěný plánovačem | 24 s | Dokončen, 0 splatných čtení a 0 zápisů, další termín uložený |

První běh: 241 úspěšných zdrojů, 30 technických chyb, 102 nepodporovaných čtení a 4 odložení. **13 nových nálezů zůstalo oddělených.** Přetahování hodnot při dvou VYNUCENÝCH plných čteních tím ověřené není. 4 639 počítaných databázových požadavků bylo na místní DB, ne Supabase. Modelová AI 0 USD, ne celkové náklady infrastruktury 0 USD.

## Poslední rozpracovaná práce: weby pořadatelů

### Kde jsou uložené výsledky

Soukromá trvalá složka:
`~/Library/Application Support/LetsRace/data/organiser-check-2027/`

- `races.json`: výchozí katalogový seznam.
- `pages.jsonl`: trvalý záznam skutečně zpracovaných/odložených adres. **Nezahazovat, nezačínat znovu.**
- `pages/*.txt`: uložený text stránek.
- `replay/race-review.json`: přehled po závodech, vygenerovaný BEZ SÍTĚ po ukončení živého průchodu; `textFile` v něm je relativní k podsložce `replay`.
- `replay/coverage.json`, `replay/jobs.json`, `replay/candidates.json`, `replay/unresolved.json`.
- Kořenové `race-review.json` nevzniklo, protože se živý průchod nedokončil. Použít replay výstup správně, nekopírovat slepě relativní cesty.

Souhrn ke commitu: `reports/codex-handoff-2026-11-05/organiser-read-result.json`.

### Přesný stav

Rozsah: 3 758 veřejných nesloučených závodů 2026 v CZ/SK/DE/AT/PL/CH/IT bez vyjížděk; hledá se jejich 2027, nejde o ověření všech aktuálních detailů 2027.

- 2 778 má web, 980 jej nemá.
- 2 385 původních různých normalizovaných webových adres; pokus o načtení **1 999 (83,8 %)**.
- Včetně kořenů a odkazů na nový rok: 2 851 plánovaných adres v posledním offline přepočtu; 2 849 záznamů, z toho 2 464 s pokusem o požadavek a 385 výslovně odložených kvůli HTTP 429.
- Těch 385 je na **my.raceresult.com**. To je limit cizího webu, nikoliv Supabase/Vercelu. Neobcházet jej masivním opakováním.
- 2 125 použitelných stránek; 314 stránek se zmínkami dat/strukturovaných událostí pro 2027. **Nejsou to 314 nových závodů.**
- Přehled po závodech: 1 704 bez zachyceného signálu nového termínu, 980 bez webu, 629 nečitelné, 316 s termínovým podkladem vyžadujícím identitu, 128 jen zmínka roku, 1 nezkontrolovaný. „Bez signálu“ není důkaz, že termín nebyl oznámen.
- Z tohoto posledního čtení nebylo nic zapsáno do produkčního katalogu, placená AI neběžela.

### Proč byl průchod ukončen

Běžel od 16:47 CET. U konce několik minut visel na posledním požadavku/úloze, i přes SIGTERM a deklarovaný timeout jednotlivého fetchPage. Kvůli předání jsem ukončil **jen jeho vlastní procesový strom** (35995/36036/36037 a potomka 36038), trvalé soubory zůstaly. Poté proběhl offline replay a vznikl přehled po závodech.

Chybějící adresy z posledního přepočtu:
- https://tourdekosova.cz/
- https://www.polishbiketour.pl/wydarzenia/baltyk-600-gdansk-szczecin-31-07-2027

**Prověřit timeout přes čtení těla odpovědi / všechny čekací kroky.** Přesná příčina visení není dokázaná. Nové `--seconds` nyní zastaví vybírání dalších úloh, ale samo nezaručuje přerušení již běžícího fetch. Pro další živý průchod použít také existující vnější hlídač `bounded-pipeline-step.cjs`, neslibovat dokončenou ochranu jen podle nové CLI volby.

### Poslední dvě změny kódu

1. `scripts/audit-next-edition-websites.ts`: `--out=` trvalý adresář, `--countries=`, `--seconds=`, `--limit=`, pokračování s obnovou úspěšných stránek po 14 dnech a chyb po 6 hodinách; vyloučení vyjížděk; nedokončený/pozastavený průchod vrací 2. Ověřeno skutečným čtením a offline replay. **Není napojený na plánovač.**
2. `scripts/reload-calendars.ts`: `.env.local` už neobnoví úmyslně vyprázdněné produkční/AI přístupy uvnitř izolovaného místního čtení (`??=` místo falsy kontroly). Obranný síťový guard zůstává.

Kontrola typů, cílený lint a cílené regresní testy posledních změn proběhly. Předchozí kompletní verze: 1 622 testů, build i kontrola typů prošly; po těchto dvou CLI změnách se celý build znovu nepouštěl.

## Doporučené pořadí pokračování — dělej výsledek, ne další obecný audit

### P0. Maximum práce na Mac, průběžné dokončování

1. **Nahradit 12hodinové čekání:** dokud je neprošlá práce, navazovat další místní dávkou. Když není co dělat, čekat do příští splatné práce. Nepřepisovat všem zdrojům next_poll_at na „teď“. Nechat ochranu stejného cizího webu a sdílený AI rozpočet.
2. **Odstranit zbytečné stahování celého serverového snapshotu při prázdném běhu.** Současný local-cycle.cjs jej dělá vždy na začátku (dump cca 10 MB). Při častějších bězích by vznikla nová zbytečná spotřeba. Čtení/výpočty dělat místně; čerstvý cílový stav potřebujeme před zápisem a pro změny operátorových zákazů/ručních zámků. Nevyměnit celý katalogový dump za tisíce REST dotazů.
3. **Připojit weby pořadatelů** ke stejnému řízenému průchodu: pokračovat z uložených výsledků, posoudit termín a identitu, převést bezpečné nálezy do společné místní DB, pak existujícím kontrolovaným odesíláním na server. Uložená stránka ani zmínka roku není ověřený nový ročník.
4. **Přesunout zbylou těžkou serverovou práci.** `src/app/api/cron/catalog/route.ts` skutečně spouští runCatalogHygiene včetně FCI, RaceResult, propozic, Rakouska, registrací, slučování. Není to jen drobný úklid. `source-health` znovu čte až 60/80 zdrojů. Připrav místní náhradu a zabraň dvojím běhům na Vercelu. Geokódování a historii počasí také posuď/přesuň na Mac, zachovej jejich společné limity poskytovatelů; budgetové tabulky počasí nekopírovat tak, aby dva pracovníci utráceli stejnou rezervaci dvakrát.
5. Na Vercelu ponechat veřejný web a nutné krátké aktualizace jeho stránek. Odesílání, aktualizace stránek, e-maily a databáze pořád něco stojí; neslibovat 0 % cloudové spotřeby. Aktuální předpověď musí být čerstvá, nepotřebuje dlouhou Mac cache.

### P0. Dovést výsledky až k uživatelům

6. **Automatické bezpečné aktualizace existujících závodů.** Současné --only-new-races zahodí všechny jejich změny z odesílaného plánu; zůstávají ale v místní DB/artefaktech. Postupně propustit doložená doplnění, respektovat zámky a CAS, nerozšířit rovnou automatické termíny/slučování na nejasné případy.
7. Veřejné změny doručovat stávající oddělenou cestou; zkontrolovat Wels, Perun, starý Lakeland URL a GR8 Lakes po běžné obnově. Nezaměnit úspěšné vyžádání obnovy za ověřený výsledek ve všech jazykových verzích, mapě a kalendáři.

### Konkrétní vazby, které je potřeba vyřešit při zapojení ročníků

- `check-next-editions.ts` už má evidenční a identitní brány i chráněného zapisovače. Podporuje jednotlivou zemi a vlastní datovaný archive adresář, **zatím neumí nový společný --archive / ALL**. Nezapínat naslepo sedm plných duplicitních crawlů.
- `local-pass.ts` je starší SQLite prototyp, který umí race_website číst a vyhodnocovat, ale není napojený na novou PostgreSQL cestu. Nevytvářet třetí nezávislou pipeline; využít uložené podklady a společný zapisovač.
- `ingestReviewedCandidate` může lokálně založit paused evidence-only watched_url (`added_by:pipeline_review`). `local-sync.cjs` záměrně NEPOSÍLÁ čtecí stav watched_urls na server. `local-review-new.ts` zadrží event_source, jehož watched_url_id na cíli neexistuje. **Tohle by po zapojení nových webů zadrželo nové ročníky.** Zvol bezpečný přenos evidence-only konfigurace bez polldat/hashů nebo odpovídajícího přenositelného zdroje; nezrušit kontrolu FK ani všechny případy prostě povolit. Před tímto předáním jsem tuto změnu NEIMPLEMENTOVAL.
- Možný další krok byl bezplatně posoudit jednoznačné doslovné termíny přes stávající quoteStatesDate/decideEdition, složité případy dát AI v zachovaném rozpočtu. **Nový deterministický posuzovač nebyl napsaný ani otestovaný.** To je návrh, ne hotová funkce.

### Zbytek původního zadání, který nesmí zmizet

- 43 dříve chybně spojených budoucích záznamů s různými daty zdrojů, z toho 28 Radsport; 26 zadržených aktualizací /136 řádků z tvého předání. Přeměřit aktuální stav, nereparovat naslepo staré snapshoty.
- Opakované write_failed/FK/unikátní source konflikty. Při posledním místním náhledu chyby na turbo-sport.eu/events, alpen-tour.at a cyklokros.cz; 12 dlouho splatných pomocných URL jsou výsledky/kontakty/galavečery, takže se nevybírají a nemají způsobovat nekonečné „zbývá práce“.
- Dvě plná čtení konečných pravidel a měření přetahování údajů; neprezentovat rychlý prázdný druhý běh jako tento důkaz.
- Bohatší strukturované údaje a jejich průběžné doplňování. V commitu 429b9b7e jsou moje dřívější rozpracované opravy výběru propozic/PDF a evidence po řádcích; testy prošly, plošný přínos není doložený a tento krok v novém local-cycle zatím neběží.
- Spolehlivost po pádu, ukládání všech vazeb, reverzibilní duplicity a předchozí rozhodnutí.
- 980 závodů ve zdejším sezónním seznamu bez webu: hledat doplňkové zdroje, ne čekat na neexistující položku ve frontě webů.
- Nezávislé pokrytí a kontrola správnosti; počet přečtených stránek a testů správnost katalogu nedokazuje.
- Otevřené SEO/detail/seriály/regiony, historie počasí, staré odkazy a Eventiv podle `docs/operations-progress.md` a starších trackerů. Neznovu importovat hotové přílohy a neobnovit vyřešené duplicity.

## Spotřeba: co víme a co je odhad

Vlastník chtěl výslovně hrubý odhad. Řekl jsem **před přesunem na Mac**: Supabase provoz/logy 65–75 % sběr, 20–30 % veřejný web, 5–10 % ostatní; Vercel CPU 20–40 % sběr/zpracování, 50–75 % veřejný web, 5–10 % ostatní. **NENÍ TO NAMĚŘENÉ ROZDĚLENÍ.** U Supabase vychází orientace z dřívějších ~71k požadavků/den vs ~20k mimo dávky. U Vercelu je odhad slabý; nezaměnit jej za důkaz úspory.

Staré skutečné měření celku: 9 h28 ze 4 hodin = 237 % Vercel limitu; logy 0,31/1 GB =31 % měsíčního limitu v tehdejší den. To není dnešní živá spotřeba.

Zkusil jsem read-only metriky: MCP observability schema je stará cesta a vrací 404. Nové `vercel metrics schema` funguje, CPU metrika je `vercel.function_invocation.function_cpu_time_ms`, ale samotný dotaz s route grouping vrací **payment_required / Observability Plus**. Nic jsem nekupoval. Artefakty v `reports/local-release-2026-11-05/metrics-schema.json`, `cpu-by-route.json`. Nepokračovat opakovanými totožnými dotazy, nespouštět upgrade bez souhlasu.

## Prostředí a bezpečný start

- Checkout: `/Users/radektobolka/Documents/GitHub/letsrace`, pracovní větev `codex/scan-admin-seo-review`; `origin/main` má uvedené commity. Claude a Codex změny byly commitnuté odděleně, nic z tvé práce jsem nevrátil.
- Soukromý runtime: `~/Library/Application Support/LetsRace/runtime`.
- Trvalá data: `~/Library/Application Support/LetsRace/data`.
- Postgres17 port **54329**, pracovní `letsrace`, baseline `letsrace_baseline`. **Nesahej na Postgres15 / `races` /5432, to je databáze vlastníka.**
- Běžný plánovač drží vlastní local-cycle.lock. Před dalším manuálním čtením ověř monitor.json a procesy, nespustit dva zápisy do pracovní kopie současně.
- Stav: `data/monitor.json`, `data/local-cycle-latest.json`, `data/control.json`, `data/runner-state.json`, výsledky v `data/local-cycles/<čas>/`.
- Tajné přístupy jsou jen v .env.local a soukromém runtime. Nevypisovat ani necommitovat dumpy, uživatelské tabulky, pipeline_merge_history nebo .env soubory.
- Opravy / commity do main a nasazení byly vlastníkem už dříve autorizované; přesun sběru na Mac je nová výslovná priorita. Finanční zvýšení a upgrade žádný souhlas nemají.

### Pokračování posledního read-only čtení bez restartu od nuly

Předem ověř žádný jiný sběr a použij vnější časový hlídač podle jeho --help / zdroje:

```bash
bash scripts/local-run.sh node scripts/with-node.cjs tsx scripts/audit-next-edition-websites.ts 2026 \
  --countries=CZ,SK,DE,AT,PL,CH,IT \
  --out="$HOME/Library/Application Support/LetsRace/data/organiser-check-2027" \
  --seconds=480 --limit=250
```

Nepřidávej hned --retry-errors: přepsalo by to ochranu již odmítaného my.raceresult.com do nového velkého opakování. Opakované vyhodnocení bez síťových požadavků:

```bash
node scripts/with-node.cjs tsx scripts/audit-next-edition-websites.ts 2026 \
  --replay="$HOME/Library/Application Support/LetsRace/data/organiser-check-2027"
```

**První užitečný výsledek po převzetí:** odstranit dvanáctihodinové čekání bez zbytečných serverových dumpů, zapojit pokračující weby pořadatelů a vyřešit cestu jejich ověřených nálezů do společného ukládání. Současně vyřadit náročné serverové úlohy až s jasnou místní náhradou. Stav zapisovat do hlavního seznamu jednoduše a průběžně; žádné nové obecné audity místo práce.
