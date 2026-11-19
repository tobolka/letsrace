# Pipeline: více správných závodů pro konec 2026 a sezonu 2027

Audit 25. 10. 2026. Návrh podle aktuálního kódu, lokálních rozpracovaných změn, uložených pilotů a read-only dotazů do produkční databáze. Produkční data ani běžící procesy nebyly tímto auditem měněny. Číselné podklady a SQL jsou v `baseline.json` vedle tohoto souboru.

## Cíl po upřesnění zadání

LetsRace je nyní přehled závodů. Za dobrý záznam považujeme správně identifikovaný závod/ročník, potvrzený termín, místo a zemi, disciplínu a použitelný odkaz na pořadatele nebo oficiální zdroj. Údaj pro koho závod je doplňovat, pokud je doložený. Přesná souřadnice je důležitá pro mapu, ale nesmí být podmínkou nalezení závodu s doloženým městem.

Podrobné kategorie, délky tratí, převýšení, program, GPX a ceny nejsou podmínkou úplnosti ani prioritou této práce. Ani chybějící dosud neotevřená registrace 2027 nemá z potvrzeného závodu dělat vadný záznam. Návrh `docs/event-detail-depth.md` nyní odložit.

## Co skutečně běží a co je rozpracované

- Doména letsrace.cz je podle Vercelu při auditu na produkčním deploymentu `dpl_5jWuzYncW2gm235CXPNSFqrTvYLd`, commit `1be178a5`. Odpovídá místnímu HEAD a origin/main.
- V produkčním kódu již jsou ochrany identity, důkazů a ročníků, cache extrakcí, bezpečné slučování s historií, doplňování ze zdrojů a opravy vazby názvu na termín. Tyto věci není potřeba navrhovat znovu.
- Necommitnutá část obsahuje `src/lib/discovery/`, OpenAI search, lokální frontu se snapshoty a opakováním, předání do `discovered_links`, opravy URL s parametry, rozsahů termínů a čtečku `pipeline-v7`.
- To, že kód není na Vercelu, neznamená, že nemohl ovlivnit produkční databázi: lokální refresh ji používá. Uložené piloty a dnešní dotaz dokládají tři předané URL ve stavu pending. Audit neurčil přesný commit každého historického lokálního běhu.
- Existující pilot 24. 10. uvádí 82 původních URL OpenAI, 55 dokončených čtení, 27 odložených a 328 dalších úloh. Jde o historický report, ne nově přepočítanou frontu ani počet nových závodů.
- Vybraných 90 testů v 10 souborech nyní prošlo: discovery, benchmark, overflow, OpenAI, termíny, identity, update policy, dedup a daily steps. To není kompletní release kontrola ani měření přesnosti na reálném katalogu.

## Aktuální výchozí stav

Databázový výběr: `visibility=public`, nesloučené řádky, status scheduled/postponed/registration_open, datum začátku 25. 10. 2026 až 31. 12. 2027. Nejde o přesnou simulaci všech filtrů veřejné mapy ani o počet všech existujících závodů na trhu. URL znamená vyplněné pole, nikoli nyní ověřený odkaz správného ročníku.

| Období / země | Záznamů | S webem | Bez disciplíny | Bez souřadnic |
| --- | ---: | ---: | ---: | ---: |
| Konec 2026, všechny země | 373 | 340 | 3 | 12 |
| Konec 2026, CZ | 34 | 34 | 0 | 2 |
| Rok 2027, všechny země | 857 | 814 | 10 | 39 |
| Rok 2027, CZ | 77 | 76 | 6 | 8 |
| Rok 2027, SK | 2 | 2 | 0 | 0 |
| Rok 2027, AT | 158 | 156 | 0 | 2 |
| Rok 2027, DE | 227 | 217 | 0 | 1 |
| Rok 2027, PL | 134 | 133 | 0 | 2 |
| Rok 2027, CH | 58 | 52 | 0 | 1 |

České záznamy 2027 mají všechny vyplněné město; 33 z 77 má explicitně doložené věkové zařazení podle uložené klasifikace. Správnost jednotlivých hodnot nebyla plošně ručně ověřena. Ze dvou slovenských záznamů nelze vyvodit přesné procento pokrytí; je to důvod pro samostatný kontrolní vzorek.

## Priorita 0: odstranit opakování, které nepřináší závody

Za 24 hodin do 25. 10. 2026 09:17 pražského času: 6 069 ingest běhů, 3 987 dokončených úspěšně, 2 082 neúspěšných (34,3 %). Z nich 1 485 hlásilo nedostatek kreditu Anthropic, napříč 501 zdroji; dalších 296 sdílený rozpočtový limit. 16 671 upsertů není 16 671 nových závodů. Běh označený jako chybný mohl přesto zapsat část parserových výsledků.

Uživatel během auditu oznámil dobití Claude kreditu. Historické chyby nejsou důkazem trvajícího blokování po dobití; nový placený požadavek tento audit nespouštěl. Není důvod automaticky zvyšovat nakonfigurovaný rozpočet.

Konkrétní příčina opakování: `scripts/refresh-data.sh` při každém cyklu volá force-poll; `scripts/reload-calendars.ts` přepisuje `next_poll_at` aktivních kalendářových zdrojů. `watcher/run-summary.ts` pozná rozpočtové odložení, nikoli nedostatek kreditu poskytovatele. `watcher/run.ts` u části neúplných čtení používá znovu první stupeň error backoff.

Navrhuji:

1. Sdílený stav dostupnosti poskytovatele: při credit/auth problému zastavit další placené požadavky, zachovat práci ve frontě a pokračovat parsery/cache. Ověření obnovy jen jedním kontrolním požadavkem s odstupem.
2. Běžný refresh má respektovat `next_poll_at`; force-poll použít cíleně při změně čtečky či ručním zásahu. Po změně globální verze rozložit reread do dávek.
3. Rozlišit důvody: bez kreditu, denní limit, měsíční limit, HTTP chyba, render/OCR, konflikt identity. Každý potřebuje jiný způsob a čas návratu.
4. Deadline-skipped kroky započítat jako odložené: současné `step()` při vypršení času vrací 0 bez zvýšení DEFERRED. Uživatel má dostat pravdivý stav dokončení.

Hotovo znamená: během simulovaného výpadku se fronta neztratí, nové placené pokusy se nezopakují pro každý zdroj, po obnově pokračuje odložená práce a bezplatná práce normálně běží.

## Priorita 1: dokončit cestu od nálezu k závodu

`discovery/sync.ts` předává jen URL do pending fronty. `assessment.ts` vrací needs_review nebo out_of_scope, nikoli schválený závod. Nové hledání samo proto katalog nezvětší. Aktuálně čeká celkem 110 odkazů; tři z nezávislého discovery jsou Gracia Orlová, Lesák CUP a Pražská 50.

Navrhuji navázat na existující `discovered_links` a `event_sources`, nikoli založit druhou produkční URL frontu:

- U kandidáta zachovat název, začátek/konec, ročník, místo, citaci, snapshot, autoritu zdroje, navrženou shodu a důvod dalšího kroku. URL review a rozhodnutí o konkrétním závodu musí být propojené.
- Rozhodnutí: nový ověřený ročník / nový zdroj existujícího ročníku / konflikt / čeká na zveřejnění / zamítnuto. Schválení zdroje není automatické schválení všeho na stránce.
- Nejprve dokončit původní perspektivní nálezy a pending zdroje. Další slepé hledání přidávat podle kapacity čtení a ověřování; současných 328 následných úloh ukazuje riziko rozrůstání fronty.
- Udělat zvlášť úlohy pro zbývající 2026 a celé 2027; přidat zimní sezonu 2026/27. Dnešní discovery filtruje podle roku start_date, což není totéž jako sportovní sezona.
- Současný discovery plán je napevno český. Rozšířit parametr země a jazyků nejdřív na SK, pak podle priorit ostatních zemí. Zachovat široké nezávislé hledání a přidat cílené dotazy pro mezery (například BMX, který poslední uložený pilot nepokryl).
- Známé pořadatele sledovat přímo na podstránkách kalendáře, novinek a dalšího ročníku. Starý ročník použít jako vodítko pro hledání; termín 2027 se z něj nesmí odhadnout.

Hotovo znamená: každý z prvních 20 relevantních kandidátů má konečný nebo odůvodněný čekající stav. Report uvádí čistý počet nových veřejných ročníků, přiřazených zdrojů, konfliktů a zamítnutí. Neslibuje 20 nových závodů z 20 URL.

## Priorita 2: správnost základních údajů a ročníků

Našel jsem osm veřejných nesloučených řádků se začátkem v roce 2027 a statusem completed. Jeden navíc nese název `Zeitfahren Hintersee 2026` a datum 17. 5. 2027. To je konkrétní nesoulad k ověření, nikoli podklad pro slepý přepis statusu nebo roku. Příčinu těchto historických zápisů audit neprokázal.

Současná ochrana `watcher/update-policy.ts` už brání agregátoru přepsat existující oficiální základní pole. Chybí ale obecné rozhodování o autoritě jednotlivého tvrzení a jeho platnosti pro ročník. Při konfliktu dvou oficiálních zdrojů nestačí poslední zápis.

Navrhuji:

- Automatické kontroly po importu: completed v budoucnosti, rozpor roku názvu a data, konec před začátkem, jiný stát, generický nadpis místo závodu. Nesoulady ukládat k rozhodnutí s důkazy.
- U data rozlišovat termín závodu, prezenci, uzávěrku přihlášek a datum článku. Zachovat lokální opravy rozsahů a vazby názvu na termín; pilot Gracia Orlová již doložil záměnu prvního a posledního dne.
- Pro hodnotu vybírat důkaz podle ročníku, konkrétnosti a autority; novější stažení staré stránky není nová informace. Opravu data musí podpírat zdroj pro stejnou identitu.
- Prověřit vedlejší zapisovače stejně jako watcher. `catalog/previous-edition.ts` vybírá minulý ročník také při chybějících souřadnicích, u více kandidátů volí nejbližší datum a přímo aktualizuje events bez vlastní kontroly ručních zámků, zápisu event_facts a kontroly chyby update. Databázové triggery events tuto ochranu nedoplňují. Přenos omezit na jednoznačnou identitu, auditovat a respektovat zámky; `previous` nesmí znamenat potvrzeno pro 2027.

Hotovo znamená: osm nalezených nesouladů má zdrojově ověřené rozhodnutí; regresní sada pokryje starý/nový ročník, přeložení termínu, vícedenní závod a rozdílná kola. Žádná hromadná oprava bez konkrétního návrhu změn.

## Priorita 3: z každého zdroje získat víc užitečných základních informací

Cache, source evidence a dossiers již existují. Není potřeba je znovu stavět. Discovery má vlastní dokumentovou cache; jiné čtečky používají další cesty. Sjednotit opakované stahování přes URL + hash dokumentu a výklad přes verzi čtečky + kontext závodu/ročníku. Společný dokument lze přečíst jednou pro více kol, s kontrolou platnosti pro každé z nich.

Zdrojům přidělit úlohu: federace a seriály poskytují pokrytí a kola, pořadatel potvrzuje konkrétní ročník, místo a změny, registrační/časoměrná služba doplňuje konkrétní závod, agregátor přináší nové kandidáty. Dva agregátory přebírající jeden seznam nejsou dva nezávislé důkazy.

Ve frontě preferovat chybějící nebo rozporný základní údaj a slíbené zveřejnění další sezony. U závodů brzy v roce 2026 kontrolovat změny častěji; pro 2027 zajistit vlastní kapacitu, aby nezůstával za současnou sezonou. Statické rozdělení podle země/roku nejprve změřit, poté upravovat podle skutečného přínosu.

Výchozí `catalog/probes.ts` čeká po tichém čtení 30 dní. U oznámení nové sezony může být tato čekací doba příliš dlouhá. Návrat má vyvolat změněný dokument, nový ročník nebo známý termín zveřejnění. Nepotřebné hledání detailů naopak odsunout.

Render a OCR používat cíleně: HTTP čtečka umí textová PDF, ale sken bez textu odmítá a discovery obrázek odkládá. Uložený pilot Malevil dokládá datum na obrázku, jiná nalezená data byla až na podstránkách. Prioritní fallback je proto konkrétní termín/název/místo na relevantním dokumentu, nikoli plošné vision čtení všech obrázků.

## Priorita 4: méně duplicit závodů i duplicitní práce

Současný scorer, kontroly ročníků a merge historie jsou dobrý základ. Neřešit duplicity prostým snížením prahu nebo větším počtem modelových merge rozhodnutí.

- Rozlišit dlouhodobý závod/seriál a konkrétní ročník/kolo/formát. Ukládat aliasy a vazby zdrojových ID k ročníku. Sdílená homepage není identita.
- Nejasnosti z ingestu převést z opakovaného error logu do trvalé položky review. Současná `duplicate_reviews` má při auditu 399 rozhodnutí separate; sama není frontou kandidátů, kterým ještě ani nevznikl event.
- Při opakovaném nálezu stejného kandidáta přidat zdroj a důkaz, ne další závod nebo další nezávislý review úkol. Zamítnuté/pozastavené zdroje automaticky neoživovat.
- Opětovné posouzení má vyvolat nový důkaz či změněná identita, nikoli každý refresh. Pro race–ride a festival–jednotlivý závod zachovat odlišnost.
- Automatické sloučení ponechat jen pro prokazatelné identity; nejasné páry řešit z konkrétního dry-runu. Dnešní jednoduchý SQL test našel tři dvojice se stejným normalizovaným jménem a dnem, ale neprokazuje jejich duplicitu ani celkovou míru duplicit.

## Jak měřit výsledek podle skutečného zadání

`scripts/data-stats.ts` pokrývá jen 180 dní; `audit-data-goal.ts` 365 dní. Ani jedno nyní nepokrývá celý rok 2027. Současný 90% cíl navíc vyžaduje explicitní věkové kategorie, což není totéž jako dobrý přehled závodů.

Nahradit jediný údaj o úplnosti třemi oddělenými pohledy:

1. Pokrytí: ověřené unikátní ročníky 2026-end a 2027 po zemích/disciplinách; kontrola proti nezávislému vzorku oficiálních kalendářů. Počet známých řádků není procento trhu.
2. Kvalita přehledu: název, termín/ročník, místo/země, disciplína, funkční relevantní zdroj. Uvádět chybí / nezveřejněno / předběžné / konflikt. Údaj pro koho je doplňkový, pokud jej pořadatel zveřejnil.
3. Provoz: nové ověřené ročníky, skutečné opravy základních polí, duplicity potvrzené kontrolou, stáří fronty, odložené úlohy podle důvodu, náklady na přijatý závod. Ne počty upsertů nebo samotných URL.

První ověřovací vzorek: 20 kandidátů discovery a 30 existujících závodů rozdělených mezi konec 2026 a 2027, s různými zeměmi a disciplínami. Měřit správnost i záchyt a uvádět jmenovatel. Pilotní cíle: každý případ dohledatelný, žádné chybné sloučení v ověřeném vzorku, žádné vymyšlené datum. Malý vzorek není důkaz nulové chybovosti celého katalogu.

## Doporučené pořadí dodání

1. Dokončit a ověřit lokální opravy čtečky/URL/termínů, provozní rozlišení chyb a metriky pro celý rok 2027. Přidat kontroly základních dat a prověřit osm nesouladů.
2. Dokončit předání a rozhodování stávajících discovery kandidátů až po skutečný zápis ověřeného ročníku. První CZ pilot, poté SK a další země. OpenAI a Claude brát jako možné doplňující zdroje nálezů, jejich přínos porovnávat podle přijatých závodů, ne počtu návrhů.
3. Sjednotit opakovanou práci se zdroji, plánování opakování a chybějící základní údaje; přidat cílené render/OCR fallbacky.
4. Zlepšit aliasy a trvalé řešení identit. Teprve s výsledky vzorku rozhodnout o širší automatizaci.

Závěr: největší přínos očekávám od dokončení cesty nález → ověřený ročník a od lepšího plánování práce. Podrobné závodní detaily nyní nemají soutěžit o kapacitu s pokrytím 2027 a správností základního přehledu.
