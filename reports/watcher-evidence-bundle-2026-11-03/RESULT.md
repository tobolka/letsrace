# Společný zápis běžných aktualizací a trvalá upozornění

3. listopadu 2026.

## Opravené příčiny

Běžná aktualizace závodu ukládala hlavní údaje v chráněné transakci, potom zvlášť zdroj, snímek a jednotlivé kategorie. Pozdní chyba tak mohla nechat původ informace nebo kategorii neuloženou. Při souběžném založení stejného závodu navíc sběrač přebíral ID vítěze bez nové přípravy celého obohacení.

Upozornění pro uživatelský plán vznikalo samostatně po zápisu. Chyba se pouze zalogovala a přerušení nemuselo zanechat žádnou práci k dokončení.

## Provedené změny

- `pipeline_update_watcher_bundle` společně ukládá chráněnou aktualizaci, místo, vazby seriálů, zdrojovou identitu, snímek čtení, kontrolní otisk a doplnění kategorií. Respektuje revizi, zámky a platné převzetí zdroje. Existující zdroj nelze převést na jiný závod.
- Stejnou funkci používají existující závody z posouzených kandidátů; logika zápisu není ve dvou samostatných implementacích.
- Souběžně vytvořený závod vyžaduje nový pokus s aktuální revizí a celým plánem. Žádný neúplný náhradní zápis při kolizi.
- Změna skutečně uložených hodnot vytváří ve stejné transakci trvalou práci `plan_changes`. Následný běh používá dosavadní pravidla `detectPlanChanges`; nevymýšlí nové druhy upozornění ani je neodvozuje z odmítnuté navržené hodnoty.
- Upozornění a dokončení jejich práce mají jeden chráněný zápis. Platí stávající jedinečnost `event_id,kind,fingerprint`, takže opakování nevytváří další stejné upozornění.
- Zpracování nejvýše deseti úloh je součástí serverového běhu zveřejnění i bezplatného běhu na Macu. E-maily se z tohoto kroku přímo neodesílají; stávající doručování zůstává oddělené.

## Ověření

- SQL test skutečných migrací ověřil pozdní chybu kategorie, úplný návrat hlavních údajů/zdrojů/snímků/úlohy upozornění, nesprávnou revizi, vlastnictví zdroje, ruční zámky, ztrátu převzetí a chybu při posledním potvrzení upozornění.
- Regrese posouzených kandidátů nad novou společnou funkcí prošla.
- 1 492 testů / 230 souborů prošlo; kontrola typů, cílený lint a produkční sestavení prošly.
- Obě migrace aplikované v produkční databázi. Skutečný transakční scénář ověřil posouzený i běžný zápis, závislosti a trvalé upozornění změny termínu; celý scénář byl vrácen zpět, žádný testovací závod se nezveřejnil.
- První skutečný běh dokončování upozornění vrátil `completed=0, changes=0, deferred=0`; nejde o důkaz zlepšení správnosti katalogu.
- Runtime na Macu aktualizován při nečinném sběrači; hlavní soubory porovnány s pracovním kódem.
- Skutečné opakované načtení Chotěbuze přes nové společné ukládání a platné převzetí: [výsledek](live-replay.json).

## Co tím není dokončené

Příprava metadat seriálů zůstává samostatná. Ostatní přímí zapisovači mimo hlavní sběrač, úplná obnova dříve nahrazených kategorií, automatické posuzování kandidátů, rozhodování o nejasných duplicitách, pokrytí a nezávislé měření zůstávají otevřené. Dříve ztracená upozornění se bez podkladů zpětně nevyrábějí.

## Návrat

Migrace jsou přídavné a trvalé úlohy je třeba zachovat. Nový dokončovací krok lze dočasně vypnout; uložená práce zůstane k obnovení. Nesmí se vypnout vytváření trvalé práce a současně odstranit následný způsob zaznamenání změn. Návrat aplikace před tuto změnu nezaručuje společný zápis závislostí.
