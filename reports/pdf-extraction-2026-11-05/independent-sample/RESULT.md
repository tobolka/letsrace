# Nezávislá kontrola vytěžování propozic · 5. 11. 2026

Očekávané údaje jsem zapsal ručně před spuštěním (`expected*.json`). Vzorky jsou náhodné budoucí závody s PDF v `regulations_url`, nepoužité při dřívějším ladění. Nic se nezapisovalo; všechny běhy bez `--apply`. Útrata pěti běhů asi 0,13 USD; dnes celkem 0,29 USD, listopad 1,29 USD, limity beze změny.

## Výsledky

| Vzorek | Závody | Údaje v dokumentu | Získáno správně | Stav čtečky |
| --- | --- | --- | --- | --- |
| A, první běh | 10 | 20 | 9 (45 %), 3 chybné přijaté | před opravami |
| B, první běh | 9 | 22 | 15 (68 %), 1 chybný přijatý | po opravách z A |
| B, offline přehrání | 9 | 22 | 20, na tomto vzorku se už ladilo | po opravách z B |
| C, první běh | 8 | 16 | 15 (94 %), 3 závody s necyklistickými položkami | po opravách z B |

„Údaj“ je pole závodu (místo, pořadatel, program, startovné, trasy), ne jednotlivý řádek. **94 % nedokazuje dosažení cíle 95 %:** vzorek C je malý, seznam vznikl z klíčových řádků dokumentů a poplatky a pole u delších dokumentů jsem kontroloval jen podle klíčových řádků.

## Co se ukázalo a opravilo
- Pořadatel jiného kola z dokumentu seriálu, navíc s koncem řádku („Rundenlänge“), z neplacené části čtení.
- Termínový zlom v loňských propozicích („bis 4. Sept.“) dělal starý dokument letošním. Teď musí dokument nebo název souboru uvádět ročník.
- Řádek s doloženou částkou nebo délkou padal kvůli nedoloženému termínu, odkazu, povrchu nebo převýšení. Teď se ztratí jen to nedoložené.
- Rozbitý JSON modelu (neescapované „…"), chybějící citace u faktu, „85km“, „1‘800Hm“, „9h45“, „10 Uhr“, tabulka bez měny, cenová nabídka s názvem nad cenou, rok v názvu souboru (`Thurgau27.pdf`), Flex-Option a poplatek za protest, závod jménem „Runde“.
- Doplňky k výzvě modelu: glosář polí ve více jazycích, celé tabulky seriálu, jen cyklistické položky.

## Známé zbývající chyby (po filtru na necyklistické položky)
- 3 Rosen Cross: startovné z tabulky běžeckého závodu, cyklokrosová tabulka se nevzala.
- 4. Zima: čas 11:00 patří běhu.
- Spreewaldmarathon: dvě běžecké trasy bez slova „Lauf“ v názvu.
Před zápisem na web je nutné je vyřešit nebo u akcí s více sporty program a trasy nepřijímat.

## Hlavní omezení je jinde: odkaz na propozice
U **12 z 27 závodů** odkaz nevede na údaje tohoto ročníku: obecné podmínky nebo pravidla (6), propozice minulého ročníku (3), pravidla poháru bez závodu (1), stanovy klubu (1), technická kontrola z roku 2024 (1). Sebelepší vytěžování zde nic nezíská. Další největší přínos je hledání správného dokumentu, ne další ladění čtení.

## Rozpory k vyřešení, katalog jsem neměnil
- Gravel-Ride Thurgau: reglement uvádí 85 km a 900 Hm, web 75 km a 850 Hm.
- Motol: katalog 27. 3. 2027, odkaz na propozice 12. 4. 2026, tedy starý dokument.

## Stav
Nezapojeno do cyklu, nenainstalováno, necommitnuto, nic na webu. Kontrola: 1 721 testů ve 245 souborech před poslední kosmetickou úpravou, typy, lint a `scripts/test-ocr-document.cjs` prošly. Build veřejné aplikace se nedělal.
