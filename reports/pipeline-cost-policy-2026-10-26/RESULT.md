# Levnější pravidelný sběr — 26. 10. 2026

- Stávající místní smyčka běží každé 2 hodiny. `refresh-data.sh` načítá novou politiku při každém spuštění, i když rodičovská smyčka zdědila staré dražší příznaky.
- Běžný cyklus: AI vypnutá, sdílené modelové limity 0 USD, placené hledání vypnuté. Existující adaptéry, JSON-LD, HTML, odkazy a geokódování pokračují.
- V úterý a pátek podle pražského času: cílený AI průchod. Sdílený denní limit 0,50 USD, měsíční 5 USD (schváleno uživatelem). Zámek pro každý z obou dnů brání opakování při každém dvouhodinovém cyklu. Limit zahrnuje již zaznamenanou útratu, takže neobnovuje již vyčerpaný rozpočet. Jeden neúspěšný pokus se automaticky neopakuje v tentýž plánovaný den.
- `PIPELINE_AI_MODE=free` vypíná i pravidelnou AI. `auto` je výchozí; `ai` znamená explicitní omezený AI průchod.
- RaceTime se nyní čte pravidelně bez modelu: `scripts/check-free-calendars.ts`. Změny jdou do existující fronty pro kontrolu, nezměněná tvrzení zachovávají předchozí rozhodnutí. Nové závody se nezveřejňují bez kontroly.

## Ověření

- Skutečný bezplatný obnovovací cyklus 26. 10. dokončil všechny své kroky: 0 neúspěšných, 0 odložených. V tu chvíli nebyly zdroje splatné k novému běžnému čtení; není to důkaz plošného přečtení katalogu.
- Samostatné skutečné čtení RaceTime: 10 aktuálních akcí, 0 modelových volání, 0 vyhledávacích volání. Opakovaný průchod: 0 nových kandidátů.
- Testy politiky ověřují přepsání starého nastavení, nulové rozpočty v běžném režimu a právě jeden úterní a jeden páteční pokus. Kontrola syntaxe shellu, typů a nových souborů.

## Produkce

Také produkční automatika měla model zapnutý. Nastaveno `LLM_CALENDARS=0`, `LLM_BUDGET_USD=0`, `LLM_CALENDAR_BUDGET_USD=0`, `BRAVE_SEARCH_LIMIT=0`.

Nasazena znovu stejná produkční revize `f8d9371264581a929b77ccbbe9deaff6863adef7` s novým nastavením. Původní deployment `dpl_GTyMYYbj1KPqP1eDkUGU68T7DpqK`, nový `dpl_3Ae6AMzGDJdeJm7craXLH99Ee8VG`, stav READY, doména letsrace.cz potvrzena na novém deploymentu. Lokální rozpracované změny nebyly tímto nasazením přeneseny na server. AI dvakrát týdně zajišťuje místní smyčka; Mac musí běžet.

## Další zlepšení bez pravidelné ceny za model

Prioritou jsou další adaptéry pro opakující se strukturované zdroje, jejich RSS/JSON/API a čtení pouze změněných stránek. AI pomáhá u neznámého formátu nebo nejasných údajů. Nové formáty lze po ověření převést na bezplatný parser. Metrika přínosu má být počet ověřených nových/opravovaných závodů na zdroj a cenu, nikoli počet AI dotazů.

## Země

Společný rozsah místního sběru a AI doplňování: CZ, SK, DE, AT, CH, IT, PL. Itálie doplněna také do podporovaných zemí samostatného discovery a jeho zadání. Rozpočet 5 USD je společný pro všechny země. Podpora země není zárukou úplného pokrytí; zvláštní RaceTime čtečka pokrývá pouze svůj slovenský zdroj, zatímco ostatní země používají své existující adaptéry a sledované weby.
