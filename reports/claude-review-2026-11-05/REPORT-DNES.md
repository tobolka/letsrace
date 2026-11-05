# Co Claude Code dnes udělal · 5. listopadu 2026, stav kolem 13:20

Report pro druhou AI. Pracujeme ve stejné složce. Podrobnosti a důkazy jsou v [DECISIONS.md](DECISIONS.md) a [HANDOFF.md](HANDOFF.md).

## Co potřebuješ vědět hned

1. **Nic z mé dnešní práce není v gitu.** HEAD je `5b6a8eba`. Moje změny leží v pracovní kopii vedle tvých. Commitni jen své soubory, seznam je níže.
2. **Na server jsem nic nezapsal.** Ze serveru jsem jen četl.
3. **Na Macu právě běží ověřovací průchod** proti lokální kopii. Nespouštěj `scripts/local-db.sh restore` ani `reset`, nemaž databáze `letsrace*` a neupravuj během něj čtečky. Stav je v `~/Library/Application Support/LetsRace/data/local-pass-run/status.json`.
4. **Pravidelný sběr se nespouští,** dokud to vlastník nepovolí.
5. **Tvoje čtečky propozic jsem neměnil:** `practical-enrichment.ts`, `practical-extraction.ts`, `practical-details.ts`, jejich testy ani `docs/operations-progress.md`.

## Co vlastník dnes rozhodl

- Cíl: zhruba 90 % loňských závodů a další navíc. Přesná definice zatím není potvrzená.
- Česko je první v pořadí, ne konečný cíl. Řešení musí fungovat i v dalších zemích.
- Žádné falešné závody na mapě. Závod bez potvrzeného termínu se nezobrazuje.
- Velké průchody mají běžet na jeho Macu, paralelně a s plným vytížením. Na server se pošlou jen výsledky.
- Docker raději ne. Lokální databáze proto běží přímo na Macu.
- Sumátor není hlavní zdroj.

## Co jsem udělal

### 1. Kontrola tvé práce a čtyři opravy v `scripts/refresh-data.sh`

- Rychlá kontrola duplicit blokovala celou kontrolu přes společnou značku „hotovo“.
- Jisté duplicity se znovu slučují každý cyklus.
- Výchozí rok hledání ročníků by od 1. 1. 2027 přestal hledat ročník 2027 (`edition-season.ts`).
- Limit 180 s by ukončoval AI kroky a hluboký sběr.

### 2. Lokální kopie katalogu na Macu, bez Dockeru

Postgres 17.11 s PostGIS a PostgREST běží na `127.0.0.1`, porty 54329 až 54331. Skutečný sběrný kód na ní běží bez úprav.

- Struktura: stejné počty tabulek, funkcí, triggerů, pravidel, vazeb a indexů jako na serveru.
- Data: výpis 22 s a 10 MB, tabulky s osobními údaji se nekopírují.
- Pojistka `scripts/local-guard.cjs` blokuje server, `letsrace.cz`, e-maily a AI, ale jen pro volání z Node.

### 3. Kontrolované odesílání výsledků

`scripts/local-sync.cjs` dělá trojcestné sloučení po sloupcích a umí se vrátit zpět. Zatím zapisuje jen do lokálních testovacích databází. `scripts/test-local-sync.cjs` prošel 19 kontrolami.

- Změny termínu, názvu a stavu se zadrží k posouzení i se všemi změnami téhož závodu.
- Nové závody kontroluje `scripts/local-review-new.ts`. Ten je napsaný a má jednotkové testy, ale nad skutečnými daty ještě neběžel.

### 4. Paralelní běh

`scripts/local-parallel.cjs` spouští 5 procesů. Každý web patří jednomu procesu. Chrome má omezený počet oken. Hlídač sleduje paměť a pády.

První zkouška bez AI a bez zápisu na server:

| | První kolo | Opakované kolo |
| --- | ---: | ---: |
| Přečtené zdroje | 650 | 724 |
| Databázové požadavky | asi 30 000 | 9 566 |

První kolo trvalo 190 s, i když skript pak na zbytek čekal zbytečně dlouho. Tvrdé zabití jednoho procesu běh nezastavilo.

### 5. Rozpracované opravy kvality dat

- **Přetahování místa a typu závodu:** opraveno v `run.ts` a `update-policy.ts`. Ověřovací průchod teď běží, výsledek zatím není.
- **Report tichých zdrojů:** přestal počítat nezměněné stránky jako rozbité, nový výpočet ještě neběžel.
- **`bikeboard.at`:** změnil vzhled a čtečka tiše vrací 0 závodů. Stránka přitom ukazuje 83 závodů, 71 pro rok 2027. **Oprava zatím není napsaná,** udělám ji po ověřovacím průchodu.

## Co jsem zjistil a týká se i tebe

- **Stav ročníků 2027 (přísné párování):** Česko 2,9 %, Slovensko 1,8 %, Rakousko 10,6 %, Německo 4,2 %, Polsko 4,0 %, Švýcarsko 6,4 %, Itálie 0,9 %. Čísla podhodnocují přejmenované závody. Tvých „60 z 962“ vzniklo z volnější shody, kterou jsi mezitím odstranil.
- **ČSC:** portál se otevírá s filtrem roku 2026. Rok 2027 má zatím 0 závodů, ale běžný sběr by ho nepřečetl ani po zveřejnění. Volba roku v `renderCscPublicCalendar` existuje, běžný sběr ji nepoužívá.
- **První čtení je drahé, opakované většinou levné:** `mtbs.cz` 1 070 a pak 64 požadavků. `radsport-events.de` zůstává nad 1 700, čeká na zápisy a má chyby identity.
- **Spojené závody:** u 43 budoucích záznamů má jeden závod zdroje s různými daty (28 z `radsport-events.de`). Část může být v pořádku. Každé čtení u nich může změnit termín.
- **Rok v kódu čteček:** 20 z 53 souborů. Kolik z toho skutečně vadí, není ověřené.
- **Tiché zdroje:** `velokal.de`, `ustimtbcup.cz`, `polandbike.pl` a `stevenscup.de` fungují. `soof.sk` správně vrací nulu, protože kalendář 2027 připravují. `eventivsport.com` vrací 401, to už víš.
- **Limit požadavků:** podle tvého měření se překračoval i při vypnutých skenech. Běh na Macu šetří sběr, ale tohle sám nevyřeší.

## Co jsem říkal špatně

- „Sumátor je hlavní zdroj“ a číslo 65 %: vzniklo částečně z pořadí zpracování.
- „Stačí migrace, heslo není potřeba“: v repozitáři chybí základní schéma, proto je v `.env.local` nově `SUPABASE_DB_URL`. Je mimo git.
- „Katalog nemá vazby na přihlašování“: má 4 cizí klíče a 22 použití `auth.uid`.
- „Připojení jen pro čtení přes pooler“: `default_transaction_read_only` tam neplatí. Chrání nás jen to, že posílám čtecí příkazy.
- 139 stránek pro další sezónu jsou hlavně odhadnuté adresy, ne potvrzené stránky.

## Co od tebe potřebuju ověřit

Prosím hlavně o kritiku. Řaď podle dopadu:

1. **Odesílání (`local-sync`):** obchází dosavadní atomické funkce a spoléhá na triggery. Co se tím může rozbít na serveru?
2. **`chooseEventType` a `isSamePlace` v `update-policy.ts`:** nezablokují legitimní opravy typu závodu nebo místa?
3. **Výběr tabulek k odesílání:** chybí něco, nebo něco přebývá? Je tam `TABLES` v `local-sync.cjs`.
4. **Seznam vynechaných osobních tabulek:** je psaný ručně a měl by se změnit na povolený seznam.
5. **Rozdíly proti serveru:** PostGIS 3.7.0 lokálně a 3.3.7 na serveru, náhrada `auth` na kopii.

Sběr při ověřování nespouštěj a na server nezapisuj. Nález zapiš k číslu rozhodnutí v `DECISIONS.md`, s důkazem a dopadem.

## Moje soubory

Upravené:

- `docs/keep-fresh.md`
- `scripts/check-next-editions.ts`, `scripts/judge-duplicates.ts`, `scripts/refresh-data.sh`
- `src/lib/__tests__/refresh-daily-steps.test.ts`
- `src/lib/watcher/extractors/csc-render.ts`, `src/lib/watcher/pool.ts`, `src/lib/watcher/run.ts`, `src/lib/watcher/update-policy.ts`

Nové:

- `reports/claude-review-2026-11-05/`
- `scripts/local-api.cjs`, `local-db.sh`, `local-diff.cjs`, `local-guard.cjs`, `local-parallel.cjs`, `local-pass.ts`, `local-report.ts`, `local-review-new.ts`, `local-run.sh`, `local-sync.cjs`, `local-sync.sql`, `test-local-sync.cjs` (vše ve `scripts/`)
- `src/lib/catalog/edition-season.ts`, `src/lib/local-pass/`, `src/lib/watcher/chrome-slots.ts`
- `src/lib/__tests__/edition-season.test.ts`, `src/lib/__tests__/local-pass.test.ts`

Moje změny v `run.ts` a `pool.ts` jsou zatím bez commitu. Sdílení webů mezi procesy je aktivní jen s `LOCAL_WORKER_SHARD`, ale nová pravidla pro místo a typ závodu platí i pro běžný sběr.

## Co udělám dál

1. Vyhodnotit ověřovací průchod.
2. Přepsat čtečku `bikeboard.at` a pustit kontrolu nových závodů nad skutečnými daty.
3. Místní přehled v prohlížeči.
4. Malé první ostré odeslání, až s potvrzením vlastníka.
