# Nový závod v hlavním sběrači — společný zápis

3. listopadu 2026. Navazuje na otevřený bod v `operations-progress.md`.

## Co se změnilo

`upsertParsedEvent` připraví údaje a pak volá jediný `pipeline_create_watcher_event`. Ve stejné transakci vzniknou:

- nový závod se zachováním databázových výchozích hodnot,
- plánované nové místo nebo doplnění souřadnic již existujícího místa a jeho geometrie,
- původní zdrojový identifikátor a vazba na zdroj,
- celý snímek extrakce a kontrolní otisk čtení,
- kategorie, včetně skutečných krátkých tratí a pojmenovaných kategorií bez známé délky,
- hlavní a další vazby na již vyřešené seriály,
- dosavadní trvalé požadavky na zveřejnění závodu i dotčených seriálů.

Selhání kterékoliv části vrátí všechny tyto změny. Následné kroky už novému záznamu stejné zdroje, kategorie a vedlejší seriály nezapisují znovu. Neznámá délka se netransformuje na trasu 0 km.

Pravidelný čtenář předává své aktuální převzetí uvnitř vlastního asynchronního kontextu. Databáze před vytvořením kontroluje vlastníka, platnost, adresu a typ zdroje. Dva souběžní čtenáři si převzetí nevymění. Souběžná oprava souřadnic vede k odložení, ne k přepsání novějšího místa. Vypršení převzetí se nehlásí jako úspěšný zápis.

Unikátní klíč závodu a identifikátor zdroje dále brání duplicitám. Kolize nesmí zanechat osiřelé místo ani převzít cizí zdrojovou vazbu. Původní opatrné vyhodnocení shody v hlavním sběrači zůstává zachované.

Explicitní dříve zkontrolovaný kandidát může použít svůj pozastavený zdroj s označením `pipeline_review`, aniž by zapnul pravidelné sledování. Ostatní pozastavené či mrtvé zdroje se tímto krokem neoživují. Samostatné servisní/archivní zápisy bez převzetí zůstávají možné pro službu; nejde o tvrzení, že všechny zapisovací cesty už jsou řízeny stejným převzetím.

## Ověření

- `scripts/test-atomic-watcher-create.mjs` používá skutečné migrace v izolované databázi. Úmyslně selže zápis historie, kontrolního otisku, druhé kategorie a pozdní vedlejší vazby. Ve všech případech se vrátí závod, místo, ostatní vazby a publikační fronta. Testuje i kolizi identifikátorů, návrat doplnění sdíleného místa, změnu souřadnic, propadlé převzetí, změnu typu zdroje, pozastavení, jeden hlavní seriál a zákaz veřejného volání.
- Produkční databázová zkouška uvnitř záměrně vrácené transakce potvrdila: **1 závod, 1 místo, 1 zdroj, 2 podklady, 1 kontrolní otisk, 2 kategorie, 2 seriálové vazby a 1 úkol závodu**. Po vrácení nezůstal **žádný** z těchto nových záznamů. Nevznikl žádný skutečný ani veřejný zkušební závod.
- Obě databázové migrace jsou aplikované. Funkce je `SECURITY INVOKER`, přístupná pouze službě; `anon` ani `authenticated` ji volat nemohou. Kontrola Supabase nepřidala nález pro tuto funkci.
- **1 484 testů / 228 souborů prošlo**, sestavení a cílená kontrola kódu prošly. Zkouška asynchronního kontextu kontroluje i dvě souběžně čtené stránky s různými převzetími.
- Skutečný opakovaný běh existující Chotěbuze: **0 nových / 0 změněných / 0 chyb**, bez AI. [Výsledek](existing-replay.json). Nejde o tvrzení, že tímto během prošla větev pro vytvoření nového závodu; ta má zvláštní databázovou zkoušku výše.
- Logy: `tmp/atomic-create-sql.log`, `tmp/atomic-create-tests.log`, `tmp/atomic-create-build.log`, `tmp/atomic-create-typecheck.log`, `tmp/atomic-create-lint.log`.

## Co tato změna nedokončuje

Příprava nebo dohledání samotného seriálu může předcházet transakci; při neúspěchu může zůstat seriál bez nového kola. Změny existujících závodů mají další kroky mimo společný zápis jejich hlavních údajů a historie. Konečný stav kandidáta, oznámení, ostatní přímí zapisovači, vykonávání odpovědí vlastníka, automatické řešení konfliktů/duplicit a nezávislé měření nejsou tímto dokončené. Atomické uložení samo neprokazuje správnost zdrojových údajů ani veřejné zobrazení.

Následná kontrola skutečných odkladů doplnila i [plánované změny místa a vazeb existujícího závodu](EXISTING-DEPENDENCIES.md) do jeho společného zápisu. Zdrojové snímky, kategorie a oznámení existujících závodů stále vyžadují další práci.

Rozpočty, pravidla ročníků a rozsah sportů se nemění. Trialové závody se nepřidávají. Změna je vnitřní oprava spolehlivosti, bez nové veřejné funkce k oznámení v novinkách.
