# Přesun práce na Mac · 5. listopadu 2026

## Co se změnilo pro výsledek

- **12 nových ročníků 2027 je na veřejném webu** (přímo z webů pořadatelů, datum znovu ověřené na stránce): Kráľ Záhoria MTB Maratón, Troi Trek, Rund um die Hohe Esse Halsbrücke, 300 - Tour de Ore, Hammer City Night, Cycling Paradise Sylt, 10. Rennsteigride, Nuff uff die Geishöhe, Klausen Monument, Gran Fondo Alassio, JESOLO 6H MTB, Ultrabiking Sardinia. U pěti stránek ověřeno HTTP 200 a správné datum na `letsrace.cz/cs/zavod/<slug>`. Z Česka v této dávce žádný: u českých závodů většina oznámených termínů už v katalogu je.
- **24 závodů dostalo chybějící údaje, 3 místa souřadnice**, 0 konfliktů.
- Stav 2027 na serveru po dávce: 1 130 veřejných závodů, z toho DE 289, PL 182, AT 180, CZ 119, IT 96, CH 77, SK 25.

## Chyba, kterou předání neuvádělo

Plánovaný běh na Macu **vůbec nečetl zdroje**. Soukromá kopie leží v „Application Support“, cesta v `NODE_OPTIONS` nebyla v uvozovkách a každý proces čtečky hned spadl. Průchod kód 1 bral jako běžnou chybu zdroje a hlásil „Hotovo, 0 přečteno“. Předání to popsalo jako úspěšný prázdný běh. Ve stejný čas bylo splatných 20 zdrojů. Opraveno; pád čtečky je nově chyba, ne prázdný výsledek.

Druhá chyba: kontrola stavu zveřejnění se ptala na neexistující sloupec `event_id`, takže po odeslání vždy spadla. Opraveno; závody tou dobou už byly uložené.

## Jak Mac pracuje teď

| Situace | Co udělá | Změřeno |
| --- | --- | --- |
| Je co dělat | Naváže do 30 s | 30 s po dávce |
| Nic splatného | Nesahá na server, čeká na další práci, nejdéle 6 h | 12 s, další běh za 1,7 h, bez složky a logu |
| Porucha kroku | 5, 10, 20, 40, 60 min | Testy; ostatní kroky doběhnou |
| Snímek serveru | Jen když ho odesílání využije, nejvýš po 3 h | 4,2 MB místo 10,1 MB (komprimovaně) |

Pozor: 12 pomocných adres (výsledky, kontakty, galavečery) zůstává splatných, ale čtečka je záměrně nevybírá. Další běh tedy jednou sáhne po čtečce (asi 10 s) a skončí. Není to nekonečná smyčka.

## Weby pořadatelů

Nový doslovný posuzovač (`src/lib/catalog/next-edition-literal.ts`) jen navrhuje; odpověď dál prochází stejnou branou jako odpověď modelu a před zápisem se stránka znovu načítá. Přečetl jsem všechny první návrhy a podle nalezených chyb pravidla zpřísnil: termín afterparty, „3. und 4. April“ čtené jako 4. dubna, cizí závod ve větě, desetidenní festival, „voraussichtlich“, triatlonový web, fórum, GFNY Dánsko na webu GFNY Bremen, město na kalendáři místo závodu. Jsou v testech.

Stav 3 758 závodů 2026 po přečtení: 173 už má ročník, 1 678 bez oznámení na stránce, 212 čeká, 604 nečitelných, 975 bez webu, 117 jen zmínka roku. **„Bez oznámení“ neznamená, že pořadatel nic neoznámil.** Doslovné čtení bylo změřené na stejných stránkách, podle kterých se ladilo, a nezávislý vzorek správnosti zatím nemáme.

Evidence-only zdroje teď na server putují jako holá pozastavená konfigurace bez čtecího stavu, takže je server nezačne číst a nový ročník se kvůli nim nezadrží.

## Doplňování existujících závodů

Odesílá se pole, které je na serveru prázdné a bylo prázdné i v kopii (nebo závod založil Mac). Odstraněný špatný odkaz se tak nevrátí a nic vyplněného se nepřepíše. Datum, název, místo ani stav se tudy nemění. Nejvýš 30 závodů za průchod a 60 denně, protože každý zařadí kontrolu stránky a server jich zvládne 60 denně.

## Zdroje s opakovanou chybou

Řádek zdroje už byl propojený se závodem, ale závod měl opravenou disciplínu nebo zemi, takže zápis zkoušel založit druhý závod a databáze to odmítla. Teď ho nechá být. Ověřeno na turbo-sport.eu/events, alpen-tour.at a cyklokros.cz/kalendar: všechny tři prošly bez chyby.

## Serverové úlohy

Nasazeno (`03f379a5`): z `vercel.json` zmizely `watch`, `explore`, `source-health`, `geocode`; `catalog` nečte weby závodů. Ověřeno: na Vercelu zbylo 5 cronů. Historie počasí záměrně zůstává (60 s denně, ukládá na server, sdílený rozpočet).

Úsporu na Vercelu a Supabase zatím doložit nelze, potřebuje pár dní provozu. Rozpad Vercel CPU podle tras vyžaduje placený doplněk, ten se nekupoval.

## Ruční čtení čekajících závodů

Přečetl jsem 201 čekajících závodů (Claude v této relaci, bez placeného volání AI). U 42 byl termín jasný a patřil danému závodu. Rozhodnutí jsou v soukromém `organiser-check-2027/reviewed-answers.json` a prošla stejnými kontrolami: 6 nových je na webu, další 4 zastavila kontrola duplicit, protože na serveru už byly. Většina ostatních v katalogu už byla se stejným datem. Zbylých 159 nemá na stránce termín tohoto závodu: je tam soustředění, jiný závod, jiné kolo nebo společný kalendář.

## Nezávislá kontrola

- Doslovné čtení proti závodům, které do katalogu přišly jinudy: 22 shod, 2 rozdíly. Knappenman byla chyba čtení (datum začátku přihlášek), opraveno a v testech. Góry 400 má na stránce 5. 6., katalog 3. 7. spojil jiné kolo.
- Ruční čtení proti katalogu: 25 shod. Saint Gravel: stránka uvádí „Sonntag, 11. September“, 11. září 2027 je sobota, katalog má 12. 9.; nerozhodnuto.
- Omezení: není to náhodný vzorek, katalog sám může být špatně a nikdo to neověřil u pořadatelů.

## Co není hotové

- Měření spotřeby po přesunu.
- Asi 180 čekajících závodů, které ani čtením nejdou rozhodnout, a nové nálezy z dalších průchodů. Placená AI v cyklu neběží.
- Změny již vyplněných hodnot; Wels, Perun, Lakeland, GR8; 43 podezřelých spojení; řádky `identity_review_required`.
- 19 zdrojů z týdenní kontroly hlásí chybu, ale stále uvádí závody; většinou stránky cyclingaustria.at a portál ČSC (`source-health-latest.json`). Neřešeno.
- Dvě úplná čtení a nezávislá kontrola správnosti.
