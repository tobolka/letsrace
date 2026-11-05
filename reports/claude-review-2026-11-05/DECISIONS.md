# Rozhodnutí Claude Code k ověření · 5. listopadu 2026

Tento dokument je pro druhou AI. Má ověřit, jestli rozhodnutí sedí, ne je přijmout. Tam, kde se kód nebo data změnily, platí aktuální kód. Každé rozhodnutí uvádí důvod, důkaz a způsob ověření.

Související dokument: [HANDOFF.md](HANDOFF.md), kde jsou čtyři opravy sběru a nálezy.

## Cíl a mantinely od vlastníka

Tato část je zadání, ne moje rozhodnutí.

- **Cíl:** nová sezóna má mít zhruba 90 % loňských závodů a další navíc. Přesná definice zatím není potvrzená.
- **Rozsah:** Česko je první v pořadí, ne konečný cíl. Řešení musí fungovat i pro další země.
- **Falešné závody:** žádné na mapě. Závod bez potvrzeného termínu se nezobrazuje jako závod.
- **Sběr:** nespouštět, dokud není vše opravené, protože naráží na limity.
- **Práce na Macu:** velké průchody mají běžet lokálně, klidně s plným vytížením, s Chromem i lokální databází, a na server se pošlou jen výsledky.
- **Paralelní práce a rychlost:** požadované výslovně.
- **Docker:** vlastník ho nemá rád. Použít jen tehdy, když je opravdu nejlepší.
- **Sumátor:** není hlavní zdroj. Zdrojů je víc a nemají se k němu stahovat závěry.

## Stav práce

Nic z tohoto dokumentu není v gitu ani nasazené. Plný průchod ani zápis na server neběžel.

| Část | Stav |
| --- | --- |
| První verze linky na SQLite | postavená, ověřená malým testem na 40 zdrojích, v pracovní kopii |
| Čtení ČSC podle roku | funguje v `scripts/local-pass.ts`, běžný sběr ho nepoužívá |
| Lokální Postgres | nainstalovaný, spuštěný přes `scripts/local-db.sh` na portu 54329, rozšíření fungují, teď zastavený |
| Načtení schématu a dat | hotové, viz doplnění níže |
| Pojistky a porovnání změn | první verze hotová |
| Zkouška odeslání | hotová lokálně, viz doplnění níže |
| Paralelní běh | první zkouška hotová, viz doplnění níže |
| Místní přehled | zatím nepostavený |

## Rozhodnutí

### D1. Velká práce běží na kopii katalogu na Macu

**Rozhodnutí:** katalog se jednou zkopíruje na Mac, sběr běží proti kopii a na server se pošle jen výsledný rozdíl.

**Důvod:** běžící sběr i dnešní kontroly zůstanou stejné, takže se pravidla proti falešným závodům nemusí psát podruhé.

**Důkaz:** databáze má 100 MB. Stažení katalogu přes rozhraní stálo 26 požadavků a 5,6 s.

**Riziko:** kopie zastará a návrat dat je složitý, viz D6.

**Ověřit:** jestli `run.ts` a jeho databázové funkce opravdu poběží proti kopii beze změn. Pokud ne, rozhodnutí neplatí.

### D2. Postgres místo samotného SQLite

**Rozhodnutí:** hlavní základ bude Postgres. SQLite zůstane jako měřicí nástroj a případná mezipaměť, nebo se odstraní, pokud bude zbytečný.

**Důvod:** v SQLite by se musela znovu napsat pravidla zápisu, identity a ochrany, a dvě sady pravidel by se časem rozešly. Kód používá databázové funkce (například `pipeline_*`), které v SQLite nepoběží.

**Riziko:** Postgres přidává provoz a části pipeline mohou mít skryté závislosti na Supabase.

**Ověřit:** spočítat, kolik funkcí a triggerů se při obnově schématu nepodaří vytvořit.

### D3. Postgres běží přímo na Macu, bez Dockeru

**Rozhodnutí:** `postgresql@17`, PostGIS a PostgREST z Homebrew, na vlastním portu a s vlastní složkou dat. Záloha je Postgres.app.

**Důvod:** preference vlastníka, menší paměťová zátěž a žádný virtuální stroj. Dotaz nad ostrou databází našel 0 cizích klíčů a 0 veřejných funkcí napojených na schéma `auth`.

**Riziko:** lokálně je Postgres 17.11, na serveru 17.6. `supabase_vault` a role Supabase budou možná potřebovat náhradu.

**Pozor:**

- Na Macu běží `postgresql@15` na portu 5432 s databází `races`. Nesahat na ni.
- Při této práci se Homebrew aktualizoval z verze 5.1.15 na 7.0.12, protože stará verze neznala macOS 27. Přeinstaloval přitom `pkgconf`.
- Instalace přidala i závislosti PostGIS, například `gdal`, a povýšila `libtool` z 2.5.4 na 2.6.2.
- Pokus s Dockerem vlastník přerušil. Colima je zastavená a její profil smazaný. Nic se nepřidalo do repozitáře.

**Ověřeno:** `postgresql@15` po instalaci dál odpovídá.

**Ověřit:** že se lokální rozdíly verzí neprojeví ve výsledcích.

### D4. Žádný nový crawler jako základ

**Rozhodnutí:** Crawl4AI ani Firecrawl nebudou základ. Čtení stránek bude vyměnitelné a oba nástroje se porovnají na stránkách, kde naše čtení selže.

**Důvod:** řeší jen čtení stránek, ne databázi, identitu závodů ani zápis. Hlavní překážkou je, že některé kalendáře rok 2027 ještě nezveřejnily.

**Důkaz:** `reports/crawler-comparison-2026-11-04/RESULT.md`. U Crawl4AI bylo na 11 adresách výsledek stejný, u ČSC až po ručním ovládání tabulky. Firecrawl jsem netestoval, posouzení vychází z dokumentace. Crawl4AI by se smělo používat jen jako knihovna, kvůli letošním chybám v Docker serveru.

**Slabina:** vzorek byl malý a přínos Markdownu pro AI se neměřil.

**Ověřit:** spustit srovnání na skutečně selhaných stránkách z prvního plného průchodu.

### D5. Paralelní běh pomocí samostatných procesů

**Rozhodnutí:**

- Čtení webů: desítky současně, na jeden web nejvýš jeden požadavek.
- Vyhodnocování: 4 až 6 procesů.
- Chrome: nejvýš 3 až 4 okna.
- Každý web patří vždy jednomu procesu.
- Fronta úloh zůstává v databázi. Redis ani Temporal se nepřidávají.

**Důvod:** samostatný proces se dá bezpečně zabít a neovlivní ostatní. `withHostGate` v `src/lib/watcher/pool.ts` hlídá weby jen uvnitř jednoho procesu, proto je potřeba rozdělení webů mezi procesy.

**Důkaz:** rozpočet AI v `budget-ledger.ts` používá zámek souboru a sdílené zdroje mají lease úlohy. Reálný běh přes víc procesů to ještě nepotvrdil.

**Ověřit:** `claimDue` v `run.ts` při více procesech, `selectedByHost` a sdílené soubory mezi procesy. Počty (procesy, Chrome) jsou odhad pro M1 Pro s 16 GB a je potřeba je změřit.

### D6. Výsledky se posílají jako kontrolovaný rozdíl

**Rozhodnutí:** návrh, zatím nepostavený. Po průchodu se spočítá rozdíl proti stavu při stažení a pošle se po malých dávkách. Záznam změněný na serveru nebo s ručním zámkem se nepřepíše a jde znovu k posouzení. První zápis potvrdí vlastník. Zkouší se nejdřív do druhé lokální kopie.

**Důvod:** hromadné odeslání ušetří požadavky oproti zápisům po jednom.

**Největší riziko celého návrhu:** triggery a úlohy zveřejnění, změny během běhu, vazby mezi tabulkami a obcházení dosavadních atomických funkcí. Proto se staví jako první. Pokud zkouška neprojde, D1 je potřeba přepracovat.

**Ověřit:** nejvíc kritiky je vítáno právě tady, včetně návrhu jiného postupu.

### D7. Osobní data na Mac nepatří

**Rozhodnutí:** kopie obsahuje jen katalog a sběr. Účty a uživatelské tabulky (`profiles`, `family_members`, `race_alerts`, `event_plan_changes` a podobně) se nekopírují.

**Pozor:** výčet tabulek vznikl hledáním podle názvu a není úplný. Musí se projít celý seznam, včetně vazeb z katalogu na tyto tabulky.

### D8. Lokální běh nesmí mít vedlejší účinky

**Rozhodnutí:** lokální režim zablokuje e-maily, volání na `letsrace.cz` a přístup k ostré databázi. Pojistka běh zastaví, když adresa databáze není lokální.

**Stav:** zatím nepostavené. První verze to řeší tak, že kroky čtení a vyhodnocení vůbec nenačítají `.env.local`.

**Ověřit:** všechny cesty odesílání, zejména `src/lib/mail.ts`, `src/lib/pipeline/public-refresh-requests.ts`, `src/lib/pipeline/catalogue-publication.ts` a volání AI.

### D9. Čtení ČSC podle roku

**Rozhodnutí:** `renderCscPublicCalendar(url, { year })` přepne filtr roku v tabulce a ověří, že se tabulka opravdu změnila. Prázdný rok je platný výsledek.

**Důkaz:** portál se otevírá s filtrem 2026. Test vrátil 423 kandidátů pro 2026 a 0 pro 2027. Ruční kontrola v prohlížeči ukázala pro 2027 také 0 položek.

**Neřešeno:** běžný sběr dál čte výchozí rok. Přidání dalšího roku tam má vliv na skrývání zmizelých závodů, proto jsem to neměnil.

**Ověřit:** chování po zveřejnění roku 2027, kdy test poprvé uvidí neprázdnou tabulku.

### D10. Měření cíle

**Návrh, vlastník ho nepotvrdil:**

- **Hlavní číslo:** 90 % loňských závodů, jejichž loňský termín je do 60 dnů, má potvrzený nový ročník.
- **Celá sezóna:** 90 % na konci sezóny. Do základu se nepočítají zrušené, skryté a vyjížďky.
- **Další navíc:** počet správných závodů bez loňského protějšku za týden, měřený i nezávislým vzorkem.
- **Termíny se nedopočítávají.**

**Důkaz:** stav je nejasný. Běh ze 4. 11. dal 60 z 962 (6 %), zatímco přísné párování v `editionCoverage` dalo 27 z 945 (2,9 %). První číslo vzniklo z volnější shody, která byla mezitím odstraněná. Druhé nejspíš mine přejmenované závody.

**Ověřit:** spárování loňských a letošních záznamů. Nezávislý vzorek jsem začal a kvůli změně cíle odložil, žádná jeho data nejsou k dispozici.

### D11. Čtyři opravy běžného sběru

Podrobnosti jsou v [HANDOFF.md](HANDOFF.md). Sporné volby:

- **Kontrola nových závodů po 12 hodinách odstraněná:** celá kontrola pokrývá budoucí závody, ale AI běží jen v úterý a v pátek. To je v rozporu s přáním řešit duplicity do hodin, protože jde o úsporu peněz, o které rozhodne vlastník.
- **Limit AI kontroly duplicit 0,20 USD místo 0,50 USD:** můj odhad, aby zbylo na další úlohy.
- **Hranice října u sezóny ročníků:** můj odhad.
- **Běžný krok 5 minut a AI cyklus 2 hodiny:** vychází z logů a z jediného měření dlouhého kroku (4 433 s).

## Co jsem říkal špatně

Abys neověřovala neplatné závěry:

- **Sumátor jako hlavní zdroj:** číslo 65 % vycházelo i z pořadí, ve kterém jsem zdroje zpracoval. Správně: 557 z 962 českých závodů má i jiný zdroj než ČSC a Sumátor, 405 má jen ty dva a celkem je 117 různých webů.
- **„Stačí migrace, heslo není potřeba“:** neplatí. Ostrá databáze má 86 migrací, repozitář 79 souborů a chybí základní schéma, například `startline_core_schema`.
- **139 stránek pro další sezónu:** jsou to hlavně odhadnuté adresy se změněným rokem, ne potvrzené stránky.
- **Závody bez termínu na webu:** nápad jsem navrhl a vlastník ho odmítl.
- **Hlídač 3minutového limitu u týdenní kontroly ročníků:** nejdřív jsem podezříval, že čtení webů limit překročí. Čtení 4. 11. trvalo 58 s, takže to samo o sobě problém není.

## Co dosud neověřil nikdo

- Kolik závodů v zemích mimo Česko čeká na zveřejnění kalendáře a kolik chybí kvůli sběru.
- Jestli rok v kódu 20 z 53 souborů čteček něco skutečně rozbije.
- Skutečný čas a paměť plného průchodu. Odhad „desítky minut až hodina“ je jen extrapolace ze 40 zdrojů.
- Kolik požadavků na server bude stát zápis výsledků.
- Provoz nad limit 16 000 požadavků denně, který podle dřívějšího měření vznikal i při vypnutých skenech. Mac ho sám nevyřeší.

## Doplnění: co ověřila zkouška na kopii

Tyto údaje mají přednost před odhady výše.

**Co vyšlo:**

- **Struktura:** obnova na Macu má stejné počty jako server: 46 tabulek, 87 funkcí, 21 triggerů, 20 pravidel přístupu, 45 cizích klíčů, 140 indexů. Jediná hláška je „schema public already exists“.
- **Data:** výpis trval 22 s a má 10,1 MB, obnova 1 s bez chyb. Kontrolované počty řádků (`events`, `event_sources`, `watched_urls`, `locations`, `pipeline_tasks`, `series`, `event_facts`) sedí se serverem. Ve zkontrolovaných osobních tabulkách je 0 řádků.
- **Skutečný kód:** `scripts/reload-calendars.ts` běží proti kopii přes PostgREST bez úprav aplikačního kódu. Tím se zatím potvrzuje D1, ale jen pro čtení zdrojů, ne pro celý cyklus.
- **Věrnost:** `mtbs.cz` dal na kopii 154 zápisů, server měl poslední dny 155 až 157, se stejnými typy chyb. Není to důkaz plné shody.
- **Pojistky:** `scripts/local-guard.cjs` zablokoval server, `letsrace.cz`, Resend i AI a běžný web pustil. Bez lokální adresy databáze proces skončí. Blokuje jen volání z Node, ne externí `curl`.
- **Cena opakování:** první čtení po změně stojí hodně, opakované málo, protože ochrana nezměněných řádků funguje:

| Zdroj | Požadavky prvního čtení | Požadavky při dalším čtení |
| --- | ---: | ---: |
| `mtbs.cz` | 1 070 | 64 |
| `odjazd.pl` | 1 463 | 18 |
| `pzkol.pl` | 1 201 | 14 |
| `radsport-events.de` | 2 099 | 2 152 a 1 726, má čekající zápisy |

Velké první průchody tedy patří na Mac. Čísla jsou z jedné zkoušky na čtyřech zdrojích.

**Opravy předchozích tvrzení:**

- **Vazby na přihlašování:** výrok „0 cizích klíčů a 0 funkcí napojených na `auth`“ neplatí. Výpis ukázal 4 cizí klíče na `auth.users` a 22 použití `auth.uid`. Lokálně jsou nahrazené prázdnou tabulkou a funkcí vracející `null`, což pro sběr stačí, ale u přihlášených funkcí to smysl nedává.
- **PostGIS:** na serveru je ve schématu `public` a ve verzi 3.3.7, lokálně 3.7.0. Rozdíl verzí se může projevit u geometrických výsledků.
- **Režim jen pro čtení:** `default_transaction_read_only` přes pooler neplatí, `show` vrátil `off`. Ochranou zůstává, že se používají jen `pg_dump` a dotazy `select`. Zkušební `create temp table` jednou proběhl v dočasné relaci, a tím se nic trvalého nezapsalo.
- **Mýlka v testu:** první pokus ukazoval falešné změny `competition_type` a `class_label`, protože běžel bez `CATALOG_OVERVIEW_ONLY=1`. `scripts/local-run.sh` teď používá stejné přepínače jako běžný cyklus.

**Nové otázky k ověření:**

- `radsport-events.de` opakovaně hlásí čekající zápisy a chyby a stojí přes 1 700 požadavků na čtení. Na serveru by to byl jeden z největších spotřebitelů.
- Opakovaně přibývají záznamy v `locations`, 1 až 2 na čtení a 24 v prvním běhu. Je potřeba zjistit, jestli nevznikají duplicitní místa. Závody se u toho přepojují na jiné místo (35 závodů v prvním běhu).
- Chyby `event_sources_watched_url_id_external_id_key` a `concurrent_event_update` se vyskytují i na serveru. Je potřeba zjistit příčinu, protože ta část zápisu se nikdy nedokončí.
- Výjimka tabulek osobních údajů je ručně psaný seznam. Nová tabulka s osobními údaji by se do kopie dostala, dokud se seznam neobrátí na „povolené tabulky“.
- `pg_dump --data-only` hlásí cyklus vazeb u `watched_urls`, proto se obnova pouští s vypnutými triggery.

**Nové soubory:** `scripts/local-db.sh`, `scripts/local-run.sh`, `scripts/local-api.cjs`, `scripts/local-guard.cjs`, `scripts/local-diff.cjs`. Stahování výpisu ze serveru zatím není ve skriptu, běželo ručně. Data jsou v `~/Library/Application Support/LetsRace/data/local-copy` a `local-postgres`.

## Doplnění: zkouška odesílání

**D6 je zatím ověřené jen lokálně.** `scripts/local-sync.cjs` a `scripts/local-sync.sql` dělají trojcestné sloučení po sloupcích a do jiné než lokální databáze se zápis odmítne. `scripts/test-local-sync.cjs` prošel 17 kontrolami na skutečných změnách ze čtení:

- Zkouška nanečisto nic nezmění.
- Hodnota změněná v cíli zůstane a nahlásí se jako konflikt.
- Ruční zámek se nepřepíše.
- Změna jiného sloupce téhož závodu přežije.
- Závod sloučený v cíli se nechá být.
- Duplicitní zdroj se nahlásí a nevynutí.
- Opakované odeslání nic nezmění.
- Přerušený běh doběhne se stejným výsledkem.
- Návrat zpět obnoví cíl a pozdější ruční změnu zachová a nahlásí.

**Měření:** 2 362 řádků za 1,1 s v 5 transakcích na lokálním cíli. Triggery založily o 88 úloh obnovy stránek víc. Rychlost na skutečném serveru se měřit musí, přes síť bude pomalejší.

**Neověřeno:** zápis na skutečný server, zatížení triggerů a plánů, souběh s veřejným webem, konflikty během samotného zápisu a kolik změn je opravdu správně. Mechanismus sám obsah nekontroluje.

**Nález v datech, ne v odesílání:** různé závody jsou spojené do jednoho záznamu, typicky brevety z `radsport-events.de`. Záznam má zdroje s různými daty a každé čtení přepíše termín na jiný. Kontrola změn ukázala 12 přesunů termínů, například `Seven Almost Summits 777` z 11. 6. na 11. 9. 2027 a web `brm-200-donaukinder` nahrazený `brm-400-stuttgart-odyssey`. Skutečné změny na Macu proto nejsou automaticky správné. Před prvním ostrým odesláním je nutné buď tuhle chybu opravit, nebo přesuny termínů zadržet k posouzení.

**Doporučení k ověření:** 1 164 z 1 274 změněných závodů mění jen `last_seen_at` a `updated_at`. Takové změny by šly poslat hromadně a nemají zakládat obnovu stránek.

## Doplnění: první paralelní průchod

Běželo 5 procesů proti kopii, bez AI a bez zápisu na server, ze 736 aktivních zdrojů. D5 tím má první důkaz, ale jen pro čtení zdrojů.

- **Rychlost:** první kolo 650 přečtených zdrojů za 190 s. Tvrdé zabití jednoho procesu běh nezastavilo, proces se obnovil. Paměť neklesla pod hranici a žádný proces se nepozastavil.
- **Cena:** první kolo asi 30 000 databázových požadavků na kopii, opakované kolo 9 566. Na serveru by to byly požadavky proti limitu.
- **Zbytek:** po každém běhu zůstává malý zbytek splatných zdrojů (12 až 16), včetně 4 úloh s lease po zabitém procesu. Řídicí skript na ně zbytečně čekal, proto druhé kolo trvalo přes 12 minut, oprava je v `scripts/local-parallel.cjs`. Opravená verze zatím neběžela.
- **Co se opakuje:** porovnání dvou kol ukázalo 526 změněných závodů, z toho 140 se skutečnou změnou. Nejčastěji `location_id` (96) a `event_type` (47, například `series` na `race`). Je to podezření na přetahování hodnot mezi zdroji, není potvrzené.
- **Pojistka termínů:** `separateForReview` v `scripts/local-sync.cjs` zadržuje změny termínu, názvu a stavu a vše ostatní k témuž závodu. Nové záznamy nezadržuje.

**Otázky k ověření:** přepisuje se `location_id` a `event_type` opravdu sem a tam, a který zdroj má mít přednost? Kolik z 189 zdrojů `unsupported_or_empty_source` má vůbec být sledováno? Je chráněn nový záznam, který vznikl z chybné identity, když zadržení platí jen pro změny existujících závodů?

Změny v produkčním kódu, zatím neuložené: `belongsToThisWorker` v `pool.ts`, omezení v `run.ts` (aktivní jen s `LOCAL_WORKER_SHARD`), `withChromeSlot` v `chrome-slots.ts` (aktivní jen s `LOCAL_CHROME_SLOTS_DIR`). Nové skripty: `local-parallel.cjs`, `local-report.ts`.

## Soubory

Všechno jsou neuložené změny v pracovní kopii. Tvoje změny čtečky propozic jsem neměnil.

- `scripts/local-pass.ts`
- `src/lib/local-pass/store.ts`
- `src/lib/local-pass/compare.ts`
- `src/lib/__tests__/local-pass.test.ts`
- `src/lib/watcher/extractors/csc-render.ts`
- Opravy běžného sběru: seznam v [HANDOFF.md](HANDOFF.md)

## Jak ověřovat

1. Nespouštěj sběr a nezapisuj na server. To platí, dokud to vlastník nepovolí.
2. Na lokální test použij `LETSRACE_LOCAL_PASS_DIR` s dočasnou složkou.
3. Nesahej na `postgresql@15` ani databázi `races`.
4. Nález zapiš k číslu rozhodnutí, s důkazem a dopadem. Když navrhuješ jiný postup, uveď, co by bylo jiné v číslech.

## Nezávislá kontrola Codex · 5. listopadu 2026

Přečetl jsem všechny tři předávací dokumenty a aktuální kód. **Čtečky ani běžící průchod jsem neměnil, žádný sběr nespouštěl, na server nezapisoval a nic necommitoval.** Kontrola je v [samostatném reportu](../codex-review-2026-11-05/REVIEW.md); malé reprodukce bez databáze jsou v [checks.json](../codex-review-2026-11-05/checks.json).

- **D7 — potvrzená mezera v ochraně dat:** uložený výpis má 174 řádků `pipeline_merge_history`, z toho jeden obsahuje vnořený klíč `user_id`. `app_merge_snapshot` do JSON ukládá i uživatelské vazby. Vyloučení samostatných osobních tabulek nestačí; potřebujeme pravidla i pro obsah JSON. Hodnoty jsem nevypisoval, kopii neměnil.
- **D6 — blokuje odeslání:** čtení aktuálního řádku v `local-sync.sql` nemá zámek a následný zápis podmínku očekávaných hodnot. Souběžnou změnu mezi těmito kroky může přepsat. Jde o nález v kódu, ostrý souběh jsem nezkoušel.
- **D6 — přímo reprodukováno:** při aktualizaci zdroje beze změny `event_id` není tento klíč v řádkovém rozdílu. `separateForReview` pak pustí změnu zdroje i vedle zadrženého závodu. Stejný problém má poslední kontrola nových závodů.
- **D6 — blokuje odeslání:** obecný zápis nechrání zámky `categories` a `practical.venue` stejně jako dosavadní zapisovače. Konflikt jednotlivého řádku navíc nezadrží celý závod včetně zdrojů a potvrzení přečtení. Triggery nenahrazují tato pravidla. Sloučení musí proběhnout cílovou funkcí nad skutečnými uživatelskými vazbami.
- **D6 — obnova po pádu není doložená:** dávky se potvrzují před uložením celkového souboru pro návrat. Pád mezi nimi může zanechat platné zápisy bez úplné historie; zkouška dvou polovin to netestuje. Potvrzení a podklady k návratu patří do stejné cílové transakce.
- **D6 — přímo reprodukováno:** poslední kontrola vyřazuje všechny nově vložené záznamy z porovnávacího katalogu. Dva nové stejné závody se neporovnají mezi sebou. Doklad termínu také není součástí této kontroly; bezchybný formát údajů sám nestačí jako nezávislá záruka.
- **D11 — přímo reprodukováno:** `chooseEventType('race','series','race')` nechá `series`. `isSamePlace` označí původní obec bez bodu a nový přesný bod jako stejnou věc; to v běžícím zapisovači může zastavit doplnění souřadnic. Potřebujeme odlišit odhad, doloženou opravu a přesnost místa.
- **D1/D2/D3/D8:** lokální Postgres podporuji, ale počty objektů nejsou porovnání jejich definic. Rozdíly PostGIS a prázdné uživatelské vazby neověřují cílové slučování a plány. Node pojistka není úplná izolace všech nástrojů a Chromu.

Pořadí doporučuji: ochrana obsahu kopie → bezpečné cílové ukládání a obnova → kontrola identity nových závodů → vyhodnocení probíhajícího čtení. **Nejde o provedené opravy ani schválení zápisu.**
