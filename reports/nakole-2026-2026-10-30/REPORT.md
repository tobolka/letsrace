# NaKole: pouze ročník 2026

- Prohlédnuto 6 stran archivu včetně hranice roku; 53 akcí z roku 2026.
- 44 akcí odmítnuto podle typu: vyjížďky, srazy, besedy a další nezávodní akce.
- 9 položek označeno závod; všech 9 ověřeno také v samostatném detailu.
- 3 nové závody: JARNÍ MAUDICUP – typ Road Adventure (11. 4.), Kolem Melechova (11. 7.), Miletínský Scorelauf (5. 9.).
- 6 existujících závodů propojeno se zdrojem NaKole.
- Bike Therapy Fest obsahuje skutečné závody pumptracku, dual slalomu a Whip Off; nejde pouze o společenský festival.
- Miletínský Scorelauf má výslovně cyklistickou soutěž, vedle dalších pěších/běžeckých kategorií; importován závod, nikoliv jiné sporty jako samostatné akce.
- Nevkládány staré registrační stavy, ceny, uzávěrky ani podrobné věkové kategorie.
- Po prvním zápisu opraveny 3 vzniklé duplicity prostřednictvím auditovaného sloučení do původních záznamů. Body obnovy: 4185c7f2-9b07-45bb-a211-3f613b9d4db0, f667c70b-2031-4046-980a-1a15b3a1bbc3, ea4199d5-620d-47fd-a5c8-3b4df05ec769.
- Pražská padesátka propojena s veřejným kanonickým záznamem; skryté záznamy zůstaly skryté.
- Výsledná kontrola: 9 vazeb na 9 veřejných nesloučených závodů, všechny s datem v roce 2026.
- Automatické čtení první stránky archivu nikdy neskrývá závody, které z ní postupně zmizí.

Podklady: accepted.json, excluded.json, reviewed-matches.json, writes.jsonl a archivované zdrojové stránky v pages/. Původní writes.jsonl je audit prvního zápisu; finální kanonické záznamy se po opravě liší.

Ověření: 1 229 testů ve 180 souborech; cílený lint a kontrola TypeScriptu bez starších archivovaných kopií webu v reports/. Běžná celoprojektová kontrola TypeScriptu naráží na dřívější chybějící race-skeleton v archivovaném SEO reportu.

Nasazení: commit `dd3793b7`, produkční deployment `dpl_8qnWfeQc4GPfERtkCdPYDejX8obN` READY, doména letsrace.cz. Místní sběrač aktualizován standardním instalátorem. Ověřovací běžné načtení: strategie adapter:nakole, 2 načtené položky, 2 úspěšné zápisy, 0 nových závodů, 0 selhání. Tři nové veřejné stránky a česká stránka O projektu vracejí HTTP 200; novinka je na webu zobrazena.
