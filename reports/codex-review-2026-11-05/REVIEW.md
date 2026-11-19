# Kontrola Claudovy práce · 5. listopadu 2026

**Závěr:** velké čtení na Macu nad kopií katalogu dává smysl. Odesílání výsledků zatím není připravené pro server. Nejdůležitější je zachovat bezpečné ukládání a správné vazby, nikoliv zrychlit další průchod.

Přečtené podklady: HANDOFF.md, DECISIONS.md, REPORT-DNES.md a aktuální pracovní kód. Níže rozlišuji nález přímo v kódu, malou zkoušku na vymyšlených datech a skutečný obsah uloženého výpisu. Údaje o počtech a rychlosti Claudova sběru nepovažuji za vlastní nové měření.

**Mantinely dodrženy:** žádný nový sběr, žádný zápis na server, žádný zásah do běžícího průchodu ani databází `letsrace*`, žádná úprava čteček a žádný commit. Nespouštěl jsem `test-local-sync.cjs`: obnovuje a maže pojmenované testovací databáze a mohl by zasáhnout do souběžné práce. Běžící průchod jsem pouze ověřil čtením jeho stavového souboru.

## Co blokuje první odeslání

### 1. D7: osobní údaje mohou být uvnitř historie sloučení

**Přímo ověřeno v uloženém výpisu:** `pipeline_merge_history` má 174 řádků a v jednom je vnořený klíč `user_id`. Hodnoty nejsou součástí tohoto reportu. Výpis jsem četl jako soubor, neobnovoval ho a nic v něm neměnil.

Důvod je dohledatelný: `app_merge_snapshot` ukládá celé `event_favorites`, `event_attendance` a `event_overrides` do JSON. Vynechání samostatných uživatelských tabulek proto nestačí. Viz `supabase/migrations/20261023191651_audited_event_merges.sql:29` a `scripts/local-sync.cjs:25`.

**Potřebná změna:** povolený seznam tabulek doplnit pravidly pro jejich sloupce a vnořené hodnoty. Historii sloučení ze serveru do pracovní kopie bez úpravy nepřenášet. Historii nového sloučení vytvářet na cíli ze skutečných cílových vztahů. Existující kopie teď nemažu ani nepřepisuju.

### 2. D6: mezi porovnáním a zápisem lze přepsat novou změnu

**Nález v kódu, souběh nebyl spouštěn:** `local-sync.sql:33` načte řádek bez zámku. Zápis na řádku 107 používá jen primární klíč. Pokud mezi nimi někdo stejný sloupec změní, porovnání proběhlo proti starému stavu a zápis může novou změnu přepsat. Samotná společná transakce to při běžné izolaci neřeší. Podobně nejsou při porovnání zamčené ruční zámky.

**Potřebná změna:** cílové ukládání musí zamknout aktuální řádek a příslušné zámky před kontrolou, nebo provést podmíněný zápis podle očekávaných hodnot a ověřit počet změněných řádků. Pořadí zámků sjednotit s existujícími zapisovacími funkcemi. Předchozí zkouška změny cíle *před* celým importem toto neověřuje.

### 3. D6: ochrany a úplnost musí platit pro celý závod

**Přímo reprodukováno bez databáze:** `plan()` ukládá u aktualizací jen změněné sloupce. Pokud se u zdroje nezmění `event_id`, v návrhu chybí. `separateForReview()` proto nepozná, že změna zdroje patří k zadrženému závodu, a pustí ji dál. Stejná ztráta vazby je v `local-review-new.ts:50`. Výsledek je v `checks.json`.

**Další potvrzení z kódu:**

- `local-sync.sql:76–84` kontroluje jen přesné názvy sloupců v `events`. Nezachytí `categories` pro řádky `event_categories` ani `practical.venue` uvnitř `practical_details`. Existující zapisovače tyto zámky výslovně respektují.
- Konflikt jednoho řádku nebo chyba zdroje nezruší ostatní řádky. Import pokračuje a transakce se potvrdí. Může tedy změnit závod bez jeho zdroje či důkazu, nebo uložit `content_hash` a `page_reads`, přestože příslušná změna závodu neprošla. Další čtení pak může nesprávně považovat práci za dokončenou.
- Historie sloučení není běžná přenositelná tabulka. Lokální kopie nemá skutečné plány uživatelů; jejich přesun musí provést cílové `app_merge_events`, nikoliv pouhé kopírování změněných řádků. Zadržení změny `merged_into_id` je správná dočasná pojistka.

**Potřebná změna:** změny přenášet jako balíček pro konkrétní závod s úplnými vazbami a původem. Cílový zapisovač zkontroluje zámky, identitu a očekávaný stav a uloží závod, zdroje, kategorie a důkazy společně. Potvrzení přečtení zdroje přijmout až podle skutečně uložených výsledků. Sdílená místa a seriály potřebují samostatnou kontrolu všech dotčených závodů.

### 4. D6: obnova po skutečném pádu nemá trvalé potvrzení

**Nález v kódu:** dávka se potvrdí na řádku 129 v `local-sync.cjs`, ale souhrnný soubor pro návrat vznikne až na řádku 147 po všech dávkách. Při pádu nebo chybě pozdější dávky předchozí zápisy zůstanou, zatímco souhrnný soubor nemusí vzniknout. Pracovní soubory se navíc při obsloužené chybě mažou ve `finally`. Zkouška „první polovina + celý soubor“ testuje opakování, ne pád mezi potvrzením transakce a uložením historie.

**Potřebná změna:** cílová databáze uloží identifikátor dávky, výsledek a podklady k návratu v téže transakci jako změny. Po přerušení lze bezpečně zjistit, která dávka platí. Soubor je export potvrzení, nikoliv jediný důkaz. Ověřit pádem právě v tomto místě, později ve vyhrazeném prostředí.

### 5. D6: nové závody se neporovnávají mezi sebou

**Přímo reprodukováno bez databáze:** `local-review-new.ts:31–32` vyřadí z porovnávacího katalogu všechny nové identifikátory. Dva stejné nové záznamy pak každý procházejí proti starému katalogu bez toho druhého. Ve zkoušce kontrola vrací prázdný seznam problémů, zatímco při zahrnutí druhého záznamu správně vrátí `may_already_be_listed`.

Kontrola navíc sama nepožaduje doklad vyhlášeného termínu: vymyšlený závod s názvem, budoucím datem a bodem na mapě projde. To **nedokazuje**, že sběrač takový závod skutečně vytvořil; dokazuje to, že poslední kontrola nezávisle neověřuje slib „žádný falešný závod“. `apply` také nevyžaduje provedení této kontroly ani ověření otisku jejího výsledku.

**Potřebná změna:** porovnání nových závodů navzájem i s aktuálním cílem a doložený termín navázaný na konkrétní identitu. Schválený návrh a jeho otisk musí být podmínkou aplikace.

## Opravy, které mohou zastavit správné doplnění

### D11: `chooseEventType` nepřipouští výslovnou opravu na `race`

`chooseEventType('race', 'series', 'race')` vrací `series`. To brání přetahování výchozích odhadů, ale současně uchová chybný typ i při správném výslovném údaji. Změna opačným směrem povolená je. Viz `update-policy.ts:64` a `checks.json`.

**Doporučení:** oddělit výchozí odhad od doložené opravy a porovnávat původ informací. Neslibovat, že nový helper dovoluje všechny legitimní opravy. Stávající kód jsem neměnil.

### D11: `isSamePlace` může zastavit doplnění souřadnic

Původní Brno bez bodu a nové Brno s přesným bodem vrátí `true`. V `run.ts:2366` se tím může zachovat původní místo bez souřadnic. Při výběru nové lokality totiž předchozí řádek s `lat = null` neprojde souřadnicovým filtrem. Helper navíc nerozlišuje totožnou obec od totožného areálu; i posun zhruba o dva kilometry v obci může vyhodnotit jako stejný. Viz `checks.json`.

**Doporučení:** zachovat stabilní identifikátor stejného místa, ale dovolit bezpečné doplnění chybějícího bodu. Přesný start nesrovnávat jen podle názvu obce a široké vzdálenostní tolerance. Ani toto jsem během běhu neměnil.

## Výběr tabulek a rozdíly prostředí

**D6/D7:** seznam pro odeslání je vhodný začátek, nikoliv kompletní ochrana. `apply` jej znovu nevynucuje. `watched_urls`, `page_reads` a `catalog_probes` nesmějí potvrdit neuloženou práci; `pipeline_candidates` obsahuje i stav publikování a tokeny, které nesmějí migrovat jako běžný obsah; `pipeline_merge_history` se musí vytvářet na cíli. Naopak vynechání cílových `pipeline_tasks` a osobních tabulek z obecného přenosu je správně. Chybějící `event_overrides` se nemají bezmyšlenkovitě přidat: cílové ruční opravy musí mít přednost.

**D1/D2/D3:** Postgres a stejné zapisovací funkce jsou rozumná volba. Stejné počty objektů a řádků nestačí jako důkaz shodných definic. Potřebujeme porovnání definic relevantních funkcí/triggerů a výsledek na stejných vstupech. PostGIS porovnávat přes souřadnice a vzdálenosti s tolerancí, nikoliv přes shodu vnitřní binární reprezentace. Lokální `auth.uid() = null` a prázdné uživatelské tabulky znamenají, že místní zkouška neověřuje skutečné plány, přihlášení ani ruční rozhodování.

**D8:** současná ochrana omezuje přímé požadavky z Node a prázdné klíče jsou užitečné. Není to úplná izolace počítače: externí nástroje a provoz Chromu nejsou touto funkcí obecně pokryté. Ze statické kontroly nevyvozuji, že nějaký zakázaný zápis proběhl. Test budoucího importu musí mít oddělené oprávnění a nesmí být běžně dostupný sběrači.

**D4/D5/D9/D10:** nevyměňoval bych nyní celý crawler. Nejdřív vyhodnotit už běžící průchod. Údaj „0 závodů 2027 na ČSC“ je platný výsledek, pokud byl správně zvolen rok; není to důkaz rozbitého sběru. Výsledky párování 2,9 % nejsou důkazem, že zbývající závody už mají vyhlášený nový termín. Cíl pokrytí musí oddělit oznámené ročníky, dosud neoznámené a nezkontrolované.

## Pořadí další práce

1. Zabránit přenosu vnořených osobních údajů; domluvit bezpečný seznam skutečně přenášeného obsahu.
2. Dokončit cílové ukládání celého závodu, ochranu souběhu, zámků a obnovu po pádu. Hromadný přenos zachovat, neposílat obecné řádkové rozdíly bez těchto pravidel.
3. Ověřit nové závody i proti sobě a dokladům; potom odděleně opravit popsané blokování správných údajů.
4. Vyhodnotit skutečný výsledek Claudova běhu. Teprve pak připravit malou první dávku k odsouhlasení. Tento report není souhlasem s odesláním.

Reprodukce: `node scripts/with-node.cjs tsx reports/codex-review-2026-11-05/checks.ts`. Používá jen vymyšlená data v paměti, nenačítá přístupové údaje, síť ani databázi. Výstup: [checks.json](checks.json).
