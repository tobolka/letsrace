# Nezávislé hledání závodů · pilot 24. 10. 2026

První funkční verze je implementovaná a otestovaná lokálně. Produkce nebyla nasazena, závody ani zdrojová fronta nebyly během pilotu změněny. Commit ani push neproběhl.

## Co pilot skutečně doložil

- Jedno široké zadání pro webové AI hledání a osm nezávislých dotazů Brave vytvořily **150 trvale uložených zdrojových úloh**. AI provedlo interně šest hledání, vrátilo 59 výsledků a 13 návrhů závodů s adresou doloženou vyhledávačem. Osm dotazů Brave vrátilo po 20 výsledcích. Duplicity URL se zachováním původu byly sjednoceny.

- Hledání neznalo názvy z CSV. Nalezlo stránku **Cyklistickey Race 2027**: pořadatel uvádí 1. května 2027, Choceň, areál koupaliště a MTB formát. Automatická čtečka po opravě předávání titulku zachovala správný název a datum. V načteném katalogu je podle názvu pouze Cyklistickey MTB Race z 2. května 2026. Jde o konkrétní nově nalezený kandidát na ročník 2027; alternativní aliasy zatím nejsou všechny rozhodnuté. [Zdroj pořadatele](https://bavsesportem.cz/cyklistickey-race-2027/).

- Na CSV byla přečtena každá z 38 zadaných zdrojových URL. Tři zůstaly k opakování: dva dynamické detaily UCI a chyba načtení Chotěbuzského článku. Další odvozené odkazy jsou uložené k pozdějšímu čtení.

- Orientační automatické srovnání názvu a data našlo při původním deterministickém čtení shodu u **4 položek**, v posledním AI čtení u **16 položek**. To není měření správnosti všech závodů: CSV není ověřená pravda, názvy se mezi zdroji liší a automatické návrhy mohou zaměňovat varianty. Například MČR — Mladá Boleslav a MČR v cyklokrosu jednoduchý porovnávač nespojí. Číselný cíl 90 % zatím není splněný ani prokázaný.

## Opravené konkrétní ztráty

1. Chotěbuzský `index.php?id=17&...` a WordPress `?p=7288` zachovávají identitu článku.
2. Původní explorer ukládá i odkazy přesahující limit čtení. Chyba zápisu do fronty ukončí běh viditelně.
3. Rok v blízkém sezonním nadpisu lze přiřadit k bezrokovému řádku, ale intervenující jiný ročník vazbu zablokuje. Ověřeno na čtyřech kolech Pražského MTB poháru.
4. Samostatné tabulkové pole Závod lze spojit s následujícím polem Termín. Rusavská 50 tak zůstane Rusavskou 50, nikoli závodem jménem Propozice.
5. Doslovný titulek samostatného závodu se předává modelu a vstupuje do klíče cache. Doloženo na Cyklistickey Race.
6. Každá modelová odmítnutá položka má agregovaný důvod. Neúplné čtení je retry, nikoli hotový prázdný zdroj.

## Stav a cena

- Široké AI hledání: $0.19978; celkový přírůstek sdíleného modelového ledgeru během vývoje a všech opakování: **$0.42254**. Účtování Brave není v této částce. Limity nebyly zvýšeny.
- Aktuální slepá fronta: 438 zdrojových úloh včetně následných odkazů; 430 čekajících úloh celkem. Po změně čtečky byly zdroje vráceny ke čtení. Poslední omezený běh přečetl osm prioritních zdrojů; nynějších 6 extrahovaných tvrzení není počet nových závodů.
- Předchozí čtení slepé fronty zachytilo i zahraniční závody a chybnou necyklistickou položku. Posuzování rozsahu je proto oddělené od extrakce a žádné z těchto čísel se nevydává za počet potvrzených českých závodů.
- Změna čtečky znovu vyhodnotí uložené zdroje, uchová jejich snapshoty a historii a nezopakuje hotové hledání stejného cyklu.
- Během pilotu nebyl použit přepínač `--queue-leads`; napojení na existující frontu je otestované izolovaně. Volitelný krok v refreshi čeká na nastavení `DISCOVERY_SEASON`. Žádná nová automatizace ani dlouhodobý proces neběží.

## Ověření

Prošlo všech **1 134 testů ve 164 souborech**, kontrola typů, lint upravených souborů, kontrola syntaxe refresh skriptu a kontrola whitespace změn. Nové testy pokrývají ztrátu URL, uchování přesahu fronty, chybu jejího zápisu, konkurenční převzetí úloh, vypršený lease, odmítnutí starého výsledku, poškozený stav, neúplné čtení, změnu čtečky, oddělení CSV od hledání, předběžné termíny a ochranu stávající zdrojové fronty.

## Zbývající práce

- Dopracovat geografické a autoritativní ověření kandidátů a rozhodnout jejich vazbu na existující ročníky. Zatím nejsou automaticky ověřené všechny údaje potřebné k veřejnému zápisu.
- Dokončit prioritizované čtení zbytku fronty; nepočítat rozcestníky, zahraniční akce nebo chybné kandidáty jako přínos.
- Změřit skutečné pokrytí závodů na nezávislé sadě. Slepé nalezení stejných CSV URL není totéž jako nalezení všech závodů, které mohou být popsány jinde.
- Automatický veřejný zápis a širší opakovaný provoz zapojit až po ověření kvality. Současná verze je použitelná pro hledání, audit, pokračování fronty a předání zdrojů k posouzení.

## Diagnostika všech 51 položek CSV

Jde o diagnostické návrhy shody. Ani shodné datum samo nepotvrzuje identitu závodu nebo správnost ostatních polí. Úplná data, důvody čtení a návrhy vazeb do katalogu jsou v [pilot.json](pilot.json).

| Položka CSV | Uvedený termín | Výsledek posledního čtení |
| --- | --- | --- |
| MČR v cyklokrosu | 10. 1. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Pražský MTB pohár I. – XCC | 26. 3. | Návrh se shodným dnem; vyžaduje kontrolu identity |
| Pražský MTB pohár II. – XCO | 27. 3. | Návrh se shodným dnem; vyžaduje kontrolu identity |
| Jízda zručnosti Průhoňáci | Duben* | Nejistý vstup CSV. Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Rohálovská 50ka | 1. 5. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| May Divide | 1. 5. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Grand Prix West Bohemia | 1.–2. 5. | Odloženo: dynamic_render_unavailable |
| Závod míru juniorů | 6.–9. 5. | Odloženo: dynamic_render_unavailable |
| Zlivský cyklomaraton | 8. 5. | Návrh se shodným dnem; vyžaduje kontrolu identity |
| Chotěbuzský kopec | 8. 5. | Odloženo: fetch failed |
| Sudety Tour – časovka | 8. 5. | Návrh se shodným dnem; vyžaduje kontrolu identity |
| Sudety Tour – Mediofondo | 9. 5. | Kandidát s odlišným/neurčitým datem; vyžaduje kontrolu |
| Sudety Tour – Granfondo | 9. 5. | Kandidát s odlišným/neurčitým datem; vyžaduje kontrolu |
| 400 Ultra / 200 Hard | 21.–23. 5. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Mamut Tour | 22. 5. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Gravel Epic Šternberk | 22. 5. | Návrh se shodným dnem; vyžaduje kontrolu identity |
| Okolo Stejskala | 22. 5. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Decathlon Cyklomaraton Hradec Králové | 30. 5. | Návrh se shodným dnem; vyžaduje kontrolu identity |
| Lost Ride | 1. 6.* | Nejistý vstup CSV. Návrh se shodným dnem; vyžaduje kontrolu identity |
| Road Stage Orlické hory | 5. 6. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Visegrad 4 – Grand Prix Czech Republic | 5. 6. | Návrh se shodným dnem; vyžaduje kontrolu identity |
| DoKola! / DoKolečka! | 11.–13. 6. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Malevil Cup | 12. 6. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Rusavská 50 | 12. 6. | Návrh se shodným dnem; vyžaduje kontrolu identity |
| Krakonošův cyklomaraton | 12. 6. | Návrh se shodným dnem; vyžaduje kontrolu identity |
| Dětské závody na pumptracku | 13. 6. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| WOLFman | 18. 6. | Návrh se shodným dnem; vyžaduje kontrolu identity |
| L’Etape Czech Republic by Tour de France | 19. 6. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Dolnolhotský BAJK | 19. 6. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| BSK Giro Pičín | 20. 6.* | Nejistý vstup CSV. Návrh se shodným dnem; vyžaduje kontrolu identity |
| Vinařská 50 | 26. 6. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| 1000 Miles Adventure | 4. 7. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Trojmezí | 7. 7. | Návrh se shodným dnem; vyžaduje kontrolu identity |
| Ratajská 40 | 10. 7. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| MČR XCO / XCC | 16.–18. 7. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| V4 | 1. 8. | Návrh se shodným dnem; vyžaduje kontrolu identity |
| Czech Tour | 12.–15. 8. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Cyklozávod ČEZ Kolem Lipna | 15. 8. | Návrh se shodným dnem; vyžaduje kontrolu identity |
| HIGH POINT Galaxy MTB maraton | 21. 8. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Bike Paradise | 21. 8. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Půl Paradise | 21. 8. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Tour de Kosová | 21. 8. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Junior Cup – 9. ročník | 22. 8. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Tour de Jedlová | Srpen* | Nejistý vstup CSV. Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Tour de Zeleňák | 4. 9. | Návrh se shodným dnem; vyžaduje kontrolu identity |
| Road Stage Hradec Králové | 11. 9. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Road Stage Grande Finale | 12. 9. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
| Pražský MTB pohár III. – XCO | 25. 9. | Návrh se shodným dnem; vyžaduje kontrolu identity |
| Pražský MTB pohár IV. – XCO | 26. 9. | Návrh se shodným dnem; vyžaduje kontrolu identity |
| Author Valtické Cyklobraní | Září* | Nejistý vstup CSV. Kandidát s odlišným/neurčitým datem; vyžaduje kontrolu |
| ČT Author Cup | 9. 10. | Bez automatické shody názvu a dne; viz kandidáty a důvody |
