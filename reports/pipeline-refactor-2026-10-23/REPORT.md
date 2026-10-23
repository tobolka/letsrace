# LetsRace: refaktor datové pipeline

Lokální implementace na větvi `codex/pipeline-evidence-refactor`. Žádná migrace,
nasazení, hromadné slučování ani opravy produkčních záznamů nebyly spuštěny.

## Co je implementované

- Objevování dalších stránek na už známých doménách; stránkované načítání známých
  zdrojů; AI výběr existujících odkazů na závody, kalendáře a dokumenty.
- AI čtení neznámých stránek bez podmínky „generický parser našel méně než dva
  závody“. Ověřování citací, ročníků, dat, konkrétních odkazů a názvů seriálů.
- Doplňování výsledků parseru bez zahazování jeho nálezů. Bohatší název stejného
  řádku nezvyšuje počet závodů. Hlavičky kalendářů a useknuté titulky novinek nejsou
  přijímány jako závody.
- Cache podle modelu, promptu a obsahu; lokální disk i neveřejná databázová cache
  pro Vercel. Opakované ověření cache vůči aktuálnímu datu. Pokračování za limitem
  chunků, uchování dokončených částí při chybě a respektování časového rozpočtu.
- PDF s textovou vrstvou ve společné pipeline; omezení velikosti stahovaných dat;
  viditelná chyba pro sken bez textu. Lokální fallback pro tenké JavaScript stránky.
- Kontroly identity před silnými signály URL a fingerprintu; oddělené ročníky,
  různá kola, země a formáty; odložení nerozhodné shody; kontrola opakovaně použitého
  externího id.
- Agregátor nemůže přepsat vyplněné klíčové údaje závodu doloženého oficiálním
  zdrojem. Ruční zámky chrání i související identifikační klíče.
- Neúplné čtení nebo zápis se neoznačí za hotový. AI vynechání není důkaz pro
  skrytí závodu. Verze čtečky je součástí HTTP checkpointu.
- Samostatné počty vytvořených, aktualizovaných, odmítnutých a chybujících zápisů;
  strukturované logy a nová metadata běhů. Změněná pole mají záznam předchozí hodnoty
  a zdroje v evidenci faktů.
- Připravená migrace pro audit a podmíněnou obnovu sloučení v jedné transakci.
  Zachovává vazby na další seriály, zdrojové důkazy i osobní plány. Odmítne obnovu,
  pokud od sloučení došlo k dalším změnám.

## Doložené výsledky

| Kontrola | Před změnou | Po změně |
| --- | ---: | ---: |
| Správně vyřešené regresní případy identity | 4 / 8 | 8 / 8 |
| Chybné sloučení v těchto případech | 4 | 0 |
| Přehlédnutá správná shoda v těchto případech | 0 | 0 |
| Automatické testy | 1 072 ve 153 souborech | 1 103 ve 160 souborech |

Osm případů je rekonstruovaná regresní sada. Nejde o nezávisle označený vzorek
celého katalogu ani o důkaz jeho celkové přesnosti.

Na šesti archivovaných veřejných zdrojích bylo v původních výstupech 18 kandidátů.
Po spojení s ověřeným AI čtením je výsledkem 46 kandidátů: 30 doplněných nálezů a
dva odmítnuté generické titulky. Tyto počty **neznamenají 30 nových závodů**.

Konkrétně:

- Stevens Cup zůstal na 16 závodech. První pokus chybně zvýšil počet na 24 kvůli
  bohatším alternativním názvům; kombinování výsledků bylo opraveno a otestováno.
- Oderský pohár: z nečitelného přehledu se podařilo doložit šest budoucích termínů.
  Většina už existuje z jiných zdrojů; finále v Zábřehu je v katalogu skryté a
  nesmí se automaticky obnovit jako nový záznam.
- dsergebnis.de: místo generického titulku „Termine 2026“ bylo ověřeno 22 budoucích
  termínů, které porovnání identifikovalo jako pravděpodobně již známé závody.
- „Cross im Park“ byl následnou kontrolou dohledán pod delším existujícím názvem.

Prokázaný počet nových závodů v produkčním katalogu: **0**. Zkouška nezapisovala do
katalogu. Potvrzuje lepší čtení, využitelnost zdrojů a ochranu před nafouknutými
počty; skutečný přírůstek bude nutné měřit při kontrolovaném běhu po nasazení.

Odhadované modelové náklady všech tří průzkumných běhů činily **0,0367639 USD**
podle existujícího tokenového účtování. Závěrečné opakování šesti zdrojů použilo
cache a přidalo **0 USD** za modelová volání. Nejde o vyúčtování poskytovatele.

## Ověření a připravenost

- Kompletní testovací sada prošla, stejně jako TypeScript a lint změněných souborů.
- Produkční build prošel.
- Skutečné SQL migrace prošly v odděleném PostgreSQL testu na zmenšeném schématu:
  sloučení, vazby a důkazy, obnova osobních plánů, přesný návrat stavu, odmítnutí
  později změněného stavu, práva anonymního klienta, opakovatelnost a rollback při
  selhání auditního zápisu.
- Výchozí produkční měření je v `baseline.json`; dotaz lze zopakovat z
  `baseline.sql`. Regresní sadu a výsledky obsahují `identity-*.json`.
- Výsledky zdrojů, srovnání s katalogem, citace a náklady jsou v
  `source-comparison.json`. Původní stažené dokumenty zůstávají v místním `tmp/`.

Před produkčním spuštěním musí být schválena a aplikována připravená migrace.
Následovat má omezený běh se sledováním nových veřejných ročníků, změn polí,
odmítnutí a nákladů. Hromadné slučování má nejprve projít náhledem bez zápisu.
Kontrola migrace proti úplnému staging schématu zůstává součástí nasazovacího kroku.

Úplná architektura, provozní příkazy a zbývající omezení jsou v
`docs/pipeline-architecture.md`. Mezi omezení patří zatím neatomický zápis všech
částí jednoho závodu, neúplná hierarchie důvěry zdrojů, absence velké nezávisle
označené sady duplicit a chybějící globální měsíční limit modelových nákladů pro
serverless běhy. Tyto vlastnosti nejsou vydávány za dokončené.
